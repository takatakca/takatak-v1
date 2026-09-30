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

const ACTIONS = new Set([
  "start_check_in",
  "complete_check_in",
  "start_check_out",
  "complete_check_out",
]);

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

  let body: {
    action?: unknown;
    trip_id?: unknown;
    payload?: unknown;
  };

  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 25_000) {
      return json({ error: "Request too large" }, 413);
    }
    body = JSON.parse(raw) as typeof body;
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "";
  const tripId = typeof body.trip_id === "string" ? body.trip_id : "";
  const payload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? body.payload
      : {};

  if (!ACTIONS.has(action) || !UUID.test(tripId)) {
    return json({ error: "Invalid trip transition request" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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

  const { data, error } = await admin.rpc("rentauto_transition_trip", {
    p_user_id: authData.user.id,
    p_trip_id: tripId,
    p_action: action,
    p_payload: payload,
  });

  if (error) {
    const message = error.message ?? "";

    if (message.includes("trip_not_found") || message.includes("vehicle_not_found")) {
      return json({ error: "Trip not found", code: "TRIP_NOT_FOUND" }, 404);
    }

    if (
      message.includes("trip_forbidden") ||
      message.includes("guest_check_in_required")
    ) {
      return json({ error: "Forbidden", code: "FORBIDDEN" }, 403);
    }

    if (
      message.includes("invalid_trip_transition") ||
      message.includes("pickup_confirmation_required") ||
      message.includes("return_confirmation_required") ||
      message.includes("invalid_odometer") ||
      message.includes("invalid_fuel_level") ||
      message.includes("invalid_photo") ||
      message.includes("tracking_consent_required") ||
      message.includes("checkout_odometer_before_checkin")
    ) {
      return json(
        { error: "Trip transition requirements are not satisfied", code: "INVALID_TRANSITION" },
        409,
      );
    }

    console.error(
      "[rentauto-trip-transition] Transition failed",
      error.code ?? "unknown",
    );
    return json({ error: "Trip could not be updated", code: "TRANSITION_FAILED" }, 500);
  }

  return json(data, 200);
});
