import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("RENTAUTO_STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceKey) {
    console.error("[rentauto-stripe-webhook] Required configuration missing");
    return json({ error: "Webhook unavailable" }, 503);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return json({ error: "Missing signature" }, 400);
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > 2_000_000) {
    return json({ error: "Payload too large" }, 413);
  }

  const stripe = new Stripe(stripeKey);
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch {
    return json({ error: "Invalid signature" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: claim, error: claimError } = await admin.rpc(
    "rentauto_claim_stripe_event",
    {
      p_event_id: event.id,
      p_event_type: event.type,
    },
  );

  if (claimError) {
    console.error("[rentauto-stripe-webhook] Event claim failed");
    return json({ error: "Webhook processing unavailable" }, 500);
  }

  const claimRecord =
    claim && typeof claim === "object"
      ? (claim as { shouldProcess?: boolean; status?: string })
      : null;

  if (!claimRecord?.shouldProcess) {
    if (claimRecord?.status === "processed") {
      return json({ received: true, duplicate: true }, 200);
    }
    return json({ error: "Event is already processing" }, 503);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tripId = session.metadata?.trip_id;
        const guestId = session.metadata?.guest_id;
        const amountTotal = session.amount_total;
        const currency = session.currency?.toUpperCase();
        const expectedAmount = Number(session.metadata?.expected_total_cents);
        const expectedCurrency = session.metadata?.currency?.toUpperCase();

        if (
          !tripId ||
          !guestId ||
          session.payment_status !== "paid" ||
          typeof amountTotal !== "number" ||
          !Number.isSafeInteger(amountTotal) ||
          !currency ||
          !Number.isSafeInteger(expectedAmount) ||
          expectedAmount !== amountTotal ||
          expectedCurrency !== currency
        ) {
          throw new Error("invalid_completed_checkout_session");
        }

        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null;

        if (!paymentIntentId) {
          throw new Error("payment_intent_missing");
        }

        const { error: finalizeError } = await admin.rpc(
          "rentauto_finalize_paid_booking",
          {
            p_trip_id: tripId,
            p_stripe_session_id: session.id,
            p_payment_intent_id: paymentIntentId,
            p_amount_total: amountTotal,
            p_currency: currency,
            p_event_id: event.id,
            p_event_created_at: new Date(event.created * 1000).toISOString(),
          },
        );

        if (finalizeError) {
          console.error(
            "[rentauto-stripe-webhook] Booking finalization failed",
            finalizeError.code ?? "unknown",
          );
          throw new Error("booking_finalization_failed");
        }
        break;
      }

      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tripId = session.metadata?.trip_id;
        if (tripId) {
          const { error: failError } = await admin.rpc(
            "rentauto_fail_checkout_session",
            {
              p_trip_id: tripId,
              p_stripe_session_id: session.id,
              p_event_type: event.type,
            },
          );
          if (failError) {
            throw new Error("checkout_failure_transition_failed");
          }
        }
        break;
      }

      case "payment_intent.succeeded":
      case "payment_intent.payment_failed":
      case "charge.dispute.created":
      case "charge.refunded":
        // Checkout session completion remains the booking-payment authority.
        // Refund/dispute projection is added in the settlement slice.
        break;

      default:
        break;
    }

    const { error: markError } = await admin.rpc(
      "rentauto_mark_stripe_event_processed",
      { p_event_id: event.id },
    );

    if (markError) {
      throw new Error("webhook_mark_processed_failed");
    }

    return json({ received: true }, 200);
  } catch (cause) {
    const safeError =
      cause instanceof Error ? cause.message : "webhook_processing_failed";

    await admin.rpc("rentauto_mark_stripe_event_failed", {
      p_event_id: event.id,
      p_error: safeError,
    });

    console.error(
      "[rentauto-stripe-webhook] Processing failed",
      event.id,
      safeError,
    );
    return json({ error: "Webhook processing failed" }, 500);
  }
});
