import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function digest(value: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

async function safeEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = Deno.env.get("RENTAUTO_TRACKING_PROVIDER_SECRET");
  if (!expectedSecret) {
    console.error("[rentauto-tracking-ingest] Provider secret missing");
    return json({ error: "Tracking provider unavailable" }, 503);
  }

  const providedSecret = req.headers.get("x-provider-secret") ?? "";
  if (!providedSecret || !(await safeEqual(providedSecret, expectedSecret))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 2_048) {
    return json({ error: "Payload too large" }, 413);
  }

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 2_048) {
      return json({ error: "Payload too large" }, 413);
    }
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid payload" }, 400);
  }

  const provider =
    typeof body.provider === "string" && body.provider.length <= 100
      ? body.provider.trim()
      : "";
  const deviceIdentifier =
    typeof body.device_identifier === "string" &&
    body.device_identifier.length <= 128
      ? body.device_identifier.trim()
      : "";
  const lat = typeof body.lat === "number" ? body.lat : NaN;
  const lng = typeof body.lng === "number" ? body.lng : NaN;
  const speed =
    body.speed_kmh === undefined || body.speed_kmh === null
      ? null
      : typeof body.speed_kmh === "number"
        ? body.speed_kmh
        : NaN;
  const heading =
    body.heading === undefined || body.heading === null
      ? null
      : typeof body.heading === "number"
        ? body.heading
        : NaN;
  const accuracy =
    body.accuracy_meters === undefined || body.accuracy_meters === null
      ? null
      : typeof body.accuracy_meters === "number"
        ? body.accuracy_meters
        : NaN;
  const recordedAt =
    typeof body.recorded_at === "string" ? body.recorded_at : new Date().toISOString();

  if (
    !provider ||
    !deviceIdentifier ||
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180 ||
    (speed !== null && (!Number.isFinite(speed) || speed < 0 || speed >= 400)) ||
    (heading !== null &&
      (!Number.isFinite(heading) || heading < 0 || heading >= 360)) ||
    (accuracy !== null &&
      (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100_000)) ||
    Number.isNaN(Date.parse(recordedAt))
  ) {
    return json({ error: "Invalid payload" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Service unavailable" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("rentauto_ingest_location", {
    p_provider: provider,
    p_device_identifier: deviceIdentifier,
    p_lat: lat,
    p_lng: lng,
    p_speed_kmh: speed,
    p_heading: heading,
    p_accuracy_meters: accuracy,
    p_recorded_at: recordedAt,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("tracking_device_not_registered")) {
      return json({ error: "Device not registered" }, 404);
    }
    if (
      message.includes("invalid_tracking_payload") ||
      message.includes("invalid_tracking_timestamp") ||
      message.includes("invalid_tracking_device")
    ) {
      return json({ error: "Invalid payload" }, 400);
    }

    console.error(
      "[rentauto-tracking-ingest] Ingest failed",
      error.code ?? "unknown",
    );
    return json({ error: "Tracking event could not be processed" }, 500);
  }

  return json(data, 200);
});
