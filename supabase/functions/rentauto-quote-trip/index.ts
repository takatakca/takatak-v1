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

function safeExtras(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 20) return null;

  const ids = value.filter(
    (item): item is string => typeof item === "string" && UUID.test(item),
  );

  if (ids.length !== value.length) return null;
  return [...new Set(ids)];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
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
    protectionPlanId === "__invalid__"
  ) {
    return json({ error: "Invalid quote request", code: "INVALID_REQUEST" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Service unavailable" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("rentauto_quote_trip", {
    p_car_id: carId,
    p_start_at: startAt,
    p_end_at: endAt,
    p_selected_extras: extras,
    p_protection_plan_id: protectionPlanId,
  });

  if (error) {
    const message = error.message ?? "";
    if (
      message.includes("dates_not_available") ||
      message.includes("dates_temporarily_held")
    ) {
      return json(
        { error: "Dates not available", code: "DATES_NOT_AVAILABLE" },
        409,
      );
    }
    if (message.includes("vehicle_not_available")) {
      return json(
        { error: "Vehicle not available", code: "VEHICLE_NOT_AVAILABLE" },
        404,
      );
    }
    if (
      message.includes("invalid_trip_dates") ||
      message.includes("trip_duration_too_long") ||
      message.includes("invalid_extra_selection") ||
      message.includes("invalid_protection_plan")
    ) {
      return json({ error: "Invalid quote request", code: "INVALID_REQUEST" }, 400);
    }

    console.error("[rentauto-quote-trip] Quote failed", error.code ?? "unknown");
    return json({ error: "Unable to calculate quote", code: "QUOTE_FAILED" }, 500);
  }

  return json(data, 200);
});
