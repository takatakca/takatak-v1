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
const VIN = /^[A-HJ-NPR-Z0-9]{17}$/i;
const PLATE = /^[A-Z0-9 -]{2,12}$/i;

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

function safePathForOwner(
  value: unknown,
  userId: string,
  carId: string,
): string | null {
  if (typeof value !== "string" || !value) return null;
  const prefix = `${userId}/${carId}/`;
  if (!value.startsWith(prefix) || value.includes("..")) return null;
  if (value.length > 500) return null;
  return value;
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

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 20_000) {
      return json({ error: "Request too large" }, 413);
    }
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const carId = typeof body.carId === "string" ? body.carId : "";
  if (!UUID.test(carId)) return json({ error: "Invalid vehicle" }, 400);

  const rentauto = admin.schema("rentauto");
  const { data: car, error: carError } = await rentauto
    .from("cars")
    .select("id,host_id,vin,plate_number,registration_url,insurance_url,insurance_status,status")
    .eq("id", carId)
    .maybeSingle();

  if (carError) return json({ error: "Could not load vehicle" }, 500);
  if (!car) return json({ error: "Vehicle not found" }, 404);

  const { data: adminRole } = await rentauto
    .from("account_roles")
    .select("id")
    .eq("auth_user_id", authData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  const isAdmin = Boolean(adminRole);
  if (car.host_id !== authData.user.id && !isAdmin) {
    return json({ error: "Forbidden" }, 403);
  }

  const action = typeof body.action === "string" ? body.action : "get";

  if (action === "get") {
    const canSignOwnerPath = (path: string | null) =>
      path && (isAdmin || path.startsWith(`${car.host_id}/${car.id}/`));

    const [registration, insurance] = await Promise.all([
      canSignOwnerPath(car.registration_url)
        ? admin.storage
            .from("rentauto-vehicle-documents")
            .createSignedUrl(car.registration_url, 600)
        : Promise.resolve({ data: null, error: null }),
      canSignOwnerPath(car.insurance_url)
        ? admin.storage
            .from("rentauto-vehicle-documents")
            .createSignedUrl(car.insurance_url, 600)
        : Promise.resolve({ data: null, error: null }),
    ]);

    return json({
      vehicle: {
        carId: car.id,
        vin: car.vin,
        plateNumber: car.plate_number,
        insuranceStatus: car.insurance_status,
        listingStatus: car.status,
        hasRegistrationDocument: Boolean(car.registration_url),
        hasInsuranceDocument: Boolean(car.insurance_url),
        registrationDocumentUrl: registration.data?.signedUrl ?? null,
        insuranceDocumentUrl: insurance.data?.signedUrl ?? null,
      },
    });
  }

  if (action !== "submit") return json({ error: "Invalid action" }, 400);
  if (car.host_id !== authData.user.id) {
    return json({ error: "Only the vehicle owner can submit documents" }, 403);
  }

  const vin =
    typeof body.vin === "string" ? body.vin.trim().toUpperCase() : "";
  const plateNumber =
    typeof body.plateNumber === "string"
      ? body.plateNumber.trim().toUpperCase()
      : "";
  const registrationPath = safePathForOwner(
    body.registrationPath,
    authData.user.id,
    carId,
  );
  const insurancePath = safePathForOwner(
    body.insurancePath,
    authData.user.id,
    carId,
  );

  if (!VIN.test(vin)) {
    return json({ error: "VIN must contain 17 valid characters" }, 400);
  }
  if (!PLATE.test(plateNumber)) {
    return json({ error: "Invalid plate number" }, 400);
  }
  if (!registrationPath || !insurancePath) {
    return json({ error: "Registration and insurance documents are required" }, 400);
  }

  const { data: registrationObject } = await admin.storage
    .from("rentauto-vehicle-documents")
    .list(`${authData.user.id}/${carId}/registration`, {
      limit: 100,
    });
  const { data: insuranceObject } = await admin.storage
    .from("rentauto-vehicle-documents")
    .list(`${authData.user.id}/${carId}/insurance`, {
      limit: 100,
    });

  const registrationName = registrationPath.split("/").at(-1);
  const insuranceName = insurancePath.split("/").at(-1);
  const registrationExists = Boolean(
    registrationObject?.some((object) => object.name === registrationName),
  );
  const insuranceExists = Boolean(
    insuranceObject?.some((object) => object.name === insuranceName),
  );

  if (!registrationExists || !insuranceExists) {
    return json({ error: "Uploaded document could not be verified" }, 400);
  }

  const { error: updateError } = await rentauto
    .from("cars")
    .update({
      vin,
      plate_number: plateNumber,
      registration_url: registrationPath,
      insurance_url: insurancePath,
    })
    .eq("id", carId)
    .eq("host_id", authData.user.id);

  if (updateError) {
    console.error("[rentauto-vehicle-documents] submit failed", updateError.code ?? "unknown");
    return json({ error: "Could not submit vehicle documents" }, 500);
  }

  await rentauto.from("notifications").insert({
    user_id: authData.user.id,
    type: "vehicle_documents_submitted",
    title: "Vehicle documents submitted",
    body: "Your registration and insurance documents are queued for review.",
    link: `/host/cars/${carId}/edit`,
    payload: { carId },
  });

  return json({ ok: true, insuranceStatus: "pending" });
});
