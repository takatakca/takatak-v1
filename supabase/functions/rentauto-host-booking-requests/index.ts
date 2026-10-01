import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Service unavailable" }, 503);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } =
    await admin.auth.getUser(authHeader.slice(7));
  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  const rentauto = admin.schema("rentauto");

  const { data: hostRole } = await rentauto
    .from("account_roles")
    .select("role")
    .eq("auth_user_id", authData.user.id)
    .in("role", ["host", "admin"])
    .limit(1)
    .maybeSingle();

  if (!hostRole) return json({ error: "Host access required" }, 403);

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 10_000) {
      return json({ error: "Request too large" }, 413);
    }
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "list";

  if (action === "review") {
    const tripId = typeof body.tripId === "string" ? body.tripId : "";
    const decision =
      body.decision === "approved" || body.decision === "declined"
        ? body.decision
        : "";

    if (!UUID.test(tripId) || !decision) {
      return json({ error: "Invalid booking request review" }, 400);
    }

    const { data, error } = await admin.rpc("rentauto_review_booking_request", {
      p_host_user_id: authData.user.id,
      p_trip_id: tripId,
      p_decision: decision,
    });

    if (error) {
      const message = error.message ?? "";
      if (message.includes("booking_request_not_found")) {
        return json({ error: "Booking request not found." }, 404);
      }
      if (message.includes("booking_request_not_pending")) {
        return json({ error: "This request is no longer pending." }, 409);
      }
      if (
        message.includes("dates_not_available") ||
        message.includes("dates_temporarily_held") ||
        message.includes("rentauto_booking_holds_active_no_overlap")
      ) {
        return json(
          {
            error: "These dates are no longer available for approval.",
            code: "DATES_NOT_AVAILABLE",
          },
          409,
        );
      }
      if (message.includes("driver_verification_required")) {
        return json(
          {
            error: "The guest driver verification is no longer valid.",
            code: "DRIVER_VERIFICATION_REQUIRED",
          },
          409,
        );
      }

      console.error(
        "[rentauto-host-booking-requests] review failed",
        error.code ?? "unknown",
      );
      return json({ error: "Could not review booking request." }, 500);
    }

    return json({ ok: true, result: data });
  }

  if (action !== "list") return json({ error: "Invalid action" }, 400);

  const { data: cars, error: carsError } = await rentauto
    .from("cars")
    .select("id,title,make,model,year")
    .eq("host_id", authData.user.id);

  if (carsError) return json({ error: "Could not load host vehicles." }, 500);

  const carIds = (cars ?? []).map((car) => car.id);
  if (carIds.length === 0) return json({ requests: [] });

  const { data: trips, error: tripsError } = await rentauto
    .from("trips")
    .select(
      "id,car_id,guest_id,booking_reference,status,start_at,end_at,total_cents,currency,created_at",
    )
    .in("car_id", carIds)
    .eq("status", "requested")
    .order("created_at", { ascending: true })
    .limit(100);

  if (tripsError) return json({ error: "Could not load booking requests." }, 500);

  const guestIds = [...new Set((trips ?? []).map((trip) => trip.guest_id))];
  const profilesById = new Map<
    string,
    {
      display_name: string | null;
      first_name: string | null;
      rating_avg: number | null;
      trips_count: number;
    }
  >();

  if (guestIds.length > 0) {
    const { data: profiles } = await rentauto
      .from("profiles_public")
      .select("id,display_name,first_name,rating_avg,trips_count")
      .in("id", guestIds);

    for (const profile of profiles ?? []) {
      profilesById.set(profile.id, profile);
    }
  }

  const carsById = new Map((cars ?? []).map((car) => [car.id, car]));

  return json({
    requests: (trips ?? []).map((trip) => {
      const car = carsById.get(trip.car_id);
      const guest = profilesById.get(trip.guest_id);
      const requestedAt = new Date(trip.created_at);
      const expiresAt = new Date(requestedAt.getTime() + 24 * 60 * 60 * 1000);

      return {
        id: trip.id,
        bookingReference: trip.booking_reference,
        startAt: trip.start_at,
        endAt: trip.end_at,
        totalCents: trip.total_cents,
        currency: trip.currency,
        requestedAt: trip.created_at,
        requestExpiresAt: expiresAt.toISOString(),
        expired: expiresAt.getTime() <= Date.now(),
        vehicle: car
          ? {
              id: car.id,
              label:
                car.title?.trim() ||
                [car.year, car.make, car.model].filter(Boolean).join(" "),
            }
          : { id: trip.car_id, label: "Rentauto vehicle" },
        guest: {
          id: trip.guest_id,
          displayName:
            guest?.display_name?.trim() ||
            guest?.first_name?.trim() ||
            "Verified Rentauto guest",
          ratingAvg: guest?.rating_avg ?? null,
          tripsCount: guest?.trips_count ?? 0,
        },
      };
    }),
  });
});
