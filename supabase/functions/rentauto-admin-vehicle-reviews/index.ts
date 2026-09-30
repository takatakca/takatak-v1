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

type VehicleRow = {
  id: string;
  host_id: string;
  title: string;
  make: string;
  model: string;
  year: number;
  status: string;
  insurance_status: string;
  registration_url: string | null;
  insurance_url: string | null;
  vin: string | null;
  plate_number: string | null;
  updated_at: string;
};

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
  const { data: adminRole } = await rentauto
    .from("account_roles")
    .select("id")
    .eq("auth_user_id", authData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!adminRole) return json({ error: "Forbidden" }, 403);

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
    const carId = typeof body.carId === "string" ? body.carId : "";
    const decision =
      body.decision === "verified" || body.decision === "rejected"
        ? body.decision
        : "";
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : null;

    if (!UUID.test(carId) || !decision) {
      return json({ error: "Invalid review request" }, 400);
    }

    const { data: car, error: carError } = await rentauto
      .from("cars")
      .select("id,host_id,title,insurance_status,status")
      .eq("id", carId)
      .maybeSingle();

    if (carError) return json({ error: "Could not load vehicle." }, 500);
    if (!car) return json({ error: "Vehicle not found." }, 404);
    if (car.insurance_status !== "pending") {
      return json({ error: "Vehicle documents are no longer pending review." }, 409);
    }

    const update =
      decision === "rejected"
        ? { insurance_status: "rejected", status: "paused" }
        : { insurance_status: "verified" };

    const { error: updateError } = await rentauto
      .from("cars")
      .update(update)
      .eq("id", carId)
      .eq("insurance_status", "pending");

    if (updateError) {
      console.error("[rentauto-admin-vehicle-reviews] update failed", updateError.code ?? "unknown");
      return json({ error: "Could not review vehicle documents." }, 500);
    }

    const title =
      decision === "verified"
        ? "Vehicle documents approved"
        : "Vehicle documents need attention";
    const notificationBody =
      decision === "verified"
        ? `Your documents for ${car.title || "your vehicle"} were approved. Complete any remaining listing requirements, then publish the vehicle.`
        : notes
          ? `Your vehicle documents were not approved: ${notes}`
          : "Your vehicle documents were not approved. Review and resubmit the registration and insurance documents.";

    await rentauto.from("notifications").insert({
      user_id: car.host_id,
      type: "vehicle_document_review",
      title,
      body: notificationBody,
      link: `/host/cars/${car.id}/edit`,
      payload: {
        carId: car.id,
        decision,
        reviewedBy: authData.user.id,
      },
    });

    return json({ ok: true, carId, decision });
  }

  if (action !== "list") return json({ error: "Invalid action" }, 400);

  const requestedStatus =
    typeof body.status === "string" ? body.status : "pending";
  const status = ["pending", "verified", "rejected", "all"].includes(requestedStatus)
    ? requestedStatus
    : "pending";

  let query = rentauto
    .from("cars")
    .select(
      "id,host_id,title,make,model,year,status,insurance_status,registration_url,insurance_url,vin,plate_number,updated_at",
    )
    .order("updated_at", { ascending: true })
    .limit(100);

  if (status !== "all") query = query.eq("insurance_status", status);

  const { data: rows, error: rowsError } = await query;
  if (rowsError) return json({ error: "Could not load vehicles." }, 500);

  const vehicles = (rows ?? []) as VehicleRow[];
  const hostIds = [...new Set(vehicles.map((vehicle) => vehicle.host_id))];

  const profilesByUser = new Map<
    string,
    { displayName: string | null; email: string | null }
  >();

  if (hostIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("authUserId,displayName,email")
      .in("authUserId", hostIds);

    for (const profile of profiles ?? []) {
      profilesByUser.set(profile.authUserId, {
        displayName: profile.displayName,
        email: profile.email,
      });
    }
  }

  const signed = await Promise.all(
    vehicles.map(async (vehicle) => {
      const [registration, insurance] = await Promise.all([
        vehicle.registration_url
          ? admin.storage
              .from("rentauto-vehicle-documents")
              .createSignedUrl(vehicle.registration_url, 600)
          : Promise.resolve({ data: null, error: null }),
        vehicle.insurance_url
          ? admin.storage
              .from("rentauto-vehicle-documents")
              .createSignedUrl(vehicle.insurance_url, 600)
          : Promise.resolve({ data: null, error: null }),
      ]);

      return {
        id: vehicle.id,
        hostId: vehicle.host_id,
        title: vehicle.title,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        status: vehicle.status,
        insuranceStatus: vehicle.insurance_status,
        vin: vehicle.vin,
        plateNumber: vehicle.plate_number,
        updatedAt: vehicle.updated_at,
        host: profilesByUser.get(vehicle.host_id) ?? {
          displayName: null,
          email: null,
        },
        registrationDocumentUrl: registration.data?.signedUrl ?? null,
        insuranceDocumentUrl: insurance.data?.signedUrl ?? null,
      };
    }),
  );

  return json({ vehicles: signed });
});
