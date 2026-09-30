import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

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

function safeExtras(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 20) return null;
  const ids = value.filter(
    (item): item is string => typeof item === "string" && UUID.test(item),
  );
  if (ids.length !== value.length) return null;
  return [...new Set(ids)];
}

function safeLocation(value: unknown): string | null | "__invalid__" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 500) return "__invalid__";
  return value.trim() || null;
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

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 10_000) {
    return json({ error: "Request too large" }, 413);
  }

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 10_000) {
      return json({ error: "Request too large" }, 413);
    }
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const carId = typeof body.carId === "string" ? body.carId : "";
  const startAt = typeof body.startAt === "string" ? body.startAt : "";
  const endAt = typeof body.endAt === "string" ? body.endAt : "";
  const extras = safeExtras(body.selectedExtras);
  const pickupLocation = safeLocation(body.pickupLocation);
  const returnLocation = safeLocation(body.returnLocation);
  const protectionPlanId =
    body.protectionPlanId === null || body.protectionPlanId === undefined
      ? null
      : typeof body.protectionPlanId === "string" &&
          UUID.test(body.protectionPlanId)
        ? body.protectionPlanId
        : "__invalid__";

  if (
    !UUID.test(carId) ||
    !startAt ||
    !endAt ||
    Number.isNaN(Date.parse(startAt)) ||
    Number.isNaN(Date.parse(endAt)) ||
    extras === null ||
    pickupLocation === "__invalid__" ||
    returnLocation === "__invalid__" ||
    protectionPlanId === "__invalid__"
  ) {
    return json({ error: "Invalid booking request", code: "INVALID_REQUEST" }, 400);
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

  const { data, error } = await admin.rpc("rentauto_create_booking_draft", {
    p_user_id: authData.user.id,
    p_car_id: carId,
    p_start_at: startAt,
    p_end_at: endAt,
    p_selected_extras: extras,
    p_protection_plan_id: protectionPlanId,
    p_pickup_location: pickupLocation,
    p_return_location: returnLocation,
  });

  if (error) {
    const message = error.message ?? "";
    if (
      message.includes("dates_not_available") ||
      message.includes("dates_temporarily_held") ||
      message.includes("rentauto_booking_holds_active_no_overlap")
    ) {
      return json(
        { error: "Dates are no longer available", code: "DATES_NOT_AVAILABLE" },
        409,
      );
    }
    if (message.includes("host_cannot_book_own_vehicle")) {
      return json(
        { error: "You cannot book your own vehicle", code: "OWN_VEHICLE" },
        403,
      );
    }
    if (
      message.includes("verified_master_identity_required") ||
      message.includes("rentauto_account_not_active")
    ) {
      return json(
        { error: "Account verification required", code: "ACCOUNT_NOT_READY" },
        409,
      );
    }
    if (message.includes("vehicle_not_available")) {
      return json(
        { error: "Vehicle not available", code: "VEHICLE_NOT_AVAILABLE" },
        404,
      );
    }

    console.error(
      "[rentauto-create-booking-draft] Booking creation failed",
      error.code ?? "unknown",
    );
    return json(
      { error: "Could not start booking", code: "BOOKING_START_FAILED" },
      500,
    );
  }

  return json(data, 201);
});
