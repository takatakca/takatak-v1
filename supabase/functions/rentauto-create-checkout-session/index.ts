import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

type CheckoutContext = {
  tripId: string;
  bookingReference: string;
  guestId: string;
  carId: string;
  vehicleName: string;
  photoUrl: string | null;
  startAt: string;
  endAt: string;
  totalCents: number;
  currency: string;
  stripeSessionId: string | null;
  holdId: string;
  holdExpiresAt: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { tripId?: unknown };
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 5_000) {
      return json({ error: "Request too large" }, 413);
    }
    body = JSON.parse(raw) as { tripId?: unknown };
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const tripId = typeof body.tripId === "string" ? body.tripId : "";
  if (!UUID.test(tripId)) {
    return json({ error: "Invalid trip", code: "INVALID_TRIP" }, 400);
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!stripeKey) {
    return json(
      {
        error: "Payment provider is not configured",
        code: "PAYMENT_NOT_CONFIGURED",
      },
      503,
    );
  }
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Service unavailable" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authHeader.slice(7);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const holdExpiresAt = new Date(Date.now() + 35 * 60 * 1000).toISOString();
  const { data: prepared, error: prepareError } = await admin.rpc(
    "rentauto_prepare_checkout",
    {
      p_trip_id: tripId,
      p_user_id: authData.user.id,
      p_hold_expires_at: holdExpiresAt,
    },
  );

  if (prepareError || !prepared) {
    const message = prepareError?.message ?? "";
    if (
      message.includes("booking_hold_expired") ||
      message.includes("trip_not_payable")
    ) {
      return json(
        { error: "Booking hold expired", code: "BOOKING_HOLD_EXPIRED" },
        409,
      );
    }
    if (message.includes("trip_not_found")) {
      return json({ error: "Trip not found", code: "TRIP_NOT_FOUND" }, 404);
    }

    console.error(
      "[rentauto-create-checkout-session] Prepare failed",
      prepareError?.code ?? "unknown",
    );
    return json(
      { error: "Payment session could not be prepared", code: "CHECKOUT_FAILED" },
      500,
    );
  }

  const context = prepared as CheckoutContext;
  if (
    !Number.isSafeInteger(context.totalCents) ||
    context.totalCents < 0 ||
    typeof context.currency !== "string" ||
    context.currency.length !== 3
  ) {
    return json({ error: "Invalid booking total", code: "INVALID_TOTAL" }, 500);
  }

  const stripe = new Stripe(stripeKey);

  if (context.stripeSessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(
        context.stripeSessionId,
      );
      if (existing.status === "open" && existing.url) {
        return json({
          url: existing.url,
          bookingReference: context.bookingReference,
          holdExpiresAt: context.holdExpiresAt,
          reused: true,
        });
      }
    } catch {
      // A stale/expired provider session is replaced below.
    }
  }

  const publicAppUrl =
    Deno.env.get("RENTAUTO_PUBLIC_APP_URL") ||
    Deno.env.get("PUBLIC_APP_URL") ||
    "https://rentauto.ca";

  let canonicalOrigin: string;
  try {
    const parsed = new URL(publicAppUrl);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      return json({ error: "Payment redirect is not configured" }, 503);
    }
    canonicalOrigin = parsed.origin;
  } catch {
    return json({ error: "Payment redirect is not configured" }, 503);
  }

  const successUrl = new URL(`/trips/${context.tripId}`, canonicalOrigin);
  successUrl.searchParams.set("payment", "success");
  successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");

  const cancelUrl = new URL(`/checkout/${context.tripId}`, canonicalOrigin);
  cancelUrl.searchParams.set("payment", "cancelled");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_creation: "always",
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    line_items: [
      {
        price_data: {
          currency: context.currency.toLowerCase(),
          unit_amount: context.totalCents,
          product_data: {
            name: context.vehicleName || "Rentauto booking",
            description: `Booking ${context.bookingReference}`,
            images:
              context.photoUrl?.startsWith("https://")
                ? [context.photoUrl]
                : undefined,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      vertical: "rentauto",
      trip_id: context.tripId,
      guest_id: authData.user.id,
      booking_reference: context.bookingReference,
      hold_id: context.holdId,
      expected_total_cents: String(context.totalCents),
      currency: context.currency.toUpperCase(),
    },
    success_url: successUrl
      .toString()
      .replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}"),
    cancel_url: cancelUrl.toString(),
  });

  if (!session.url) {
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch {
      // Best-effort cleanup.
    }
    return json({ error: "Payment session unavailable" }, 502);
  }

  const { error: recordError } = await admin.rpc(
    "rentauto_record_checkout_session",
    {
      p_trip_id: context.tripId,
      p_user_id: authData.user.id,
      p_session_id: session.id,
    },
  );

  if (recordError) {
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch {
      // Database consistency is primary.
    }

    console.error(
      "[rentauto-create-checkout-session] Session persistence failed",
      recordError.code ?? "unknown",
    );
    return json(
      { error: "Payment session could not be saved", code: "CHECKOUT_FAILED" },
      500,
    );
  }

  return json({
    url: session.url,
    bookingReference: context.bookingReference,
    holdExpiresAt: context.holdExpiresAt,
    reused: false,
  });
});
