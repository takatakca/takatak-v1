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
const BUCKET = "rentauto-driver-documents";

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

type DriverVerificationRow = {
  id: string;
  user_id: string;
  license_front_url: string | null;
  license_back_url: string | null;
  selfie_url: string | null;
  license_country: string;
  license_region: string | null;
  license_expires_on: string | null;
  status: string;
  reviewer_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
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
    if (new TextEncoder().encode(raw).byteLength > 12_000) {
      return json({ error: "Request too large" }, 413);
    }
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "list";

  if (action === "review") {
    const verificationId =
      typeof body.verificationId === "string" ? body.verificationId : "";
    const decision =
      body.decision === "approved" || body.decision === "rejected"
        ? body.decision
        : "";
    const notes =
      typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;

    if (!UUID.test(verificationId) || !decision) {
      return json({ error: "Invalid review request" }, 400);
    }

    if (decision === "rejected" && !notes) {
      return json({ error: "A rejection reason is required." }, 400);
    }

    const { data: verification, error: verificationError } = await rentauto
      .from("driver_verifications")
      .select(
        "id,user_id,status,license_expires_on,license_front_url,license_back_url,selfie_url",
      )
      .eq("id", verificationId)
      .maybeSingle();

    if (verificationError) return json({ error: "Could not load verification." }, 500);
    if (!verification) return json({ error: "Verification not found." }, 404);
    if (verification.status !== "pending") {
      return json({ error: "Verification is no longer pending." }, 409);
    }

    if (
      decision === "approved" &&
      (!verification.license_front_url ||
        !verification.license_back_url ||
        !verification.selfie_url ||
        !verification.license_expires_on ||
        new Date(`${verification.license_expires_on}T23:59:59Z`).getTime() < Date.now())
    ) {
      return json({ error: "Driver documents are incomplete or expired." }, 409);
    }

    const { error: updateError } = await rentauto
      .from("driver_verifications")
      .update({
        status: decision,
        reviewer_notes: notes,
        reviewer_user_id: authData.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", verificationId)
      .eq("status", "pending");

    if (updateError) {
      console.error("[rentauto-admin-driver-verifications] review failed", updateError.code ?? "unknown");
      return json({ error: "Could not review driver verification." }, 500);
    }

    await rentauto.from("notifications").insert({
      user_id: verification.user_id,
      type: "driver_verification_review",
      title:
        decision === "approved"
          ? "Driver verification approved"
          : "Driver verification needs attention",
      body:
        decision === "approved"
          ? "Your driver verification is approved. You can now reserve and pay for eligible Rentauto trips."
          : `Your driver verification was not approved: ${notes}`,
      link: "/dashboard/documents",
      payload: {
        verificationId,
        decision,
        reviewedBy: authData.user.id,
      },
    });

    return json({ ok: true, verificationId, decision });
  }

  if (action !== "list") return json({ error: "Invalid action" }, 400);

  const requestedStatus =
    typeof body.status === "string" ? body.status : "pending";
  const status = ["pending", "approved", "rejected", "all"].includes(requestedStatus)
    ? requestedStatus
    : "pending";

  let query = rentauto
    .from("driver_verifications")
    .select(
      "id,user_id,license_front_url,license_back_url,selfie_url,license_country,license_region,license_expires_on,status,reviewer_notes,submitted_at,reviewed_at,updated_at",
    )
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .limit(100);

  if (status !== "all") query = query.eq("status", status);

  const { data: rows, error: rowsError } = await query;
  if (rowsError) return json({ error: "Could not load driver verifications." }, 500);

  const verifications = (rows ?? []) as DriverVerificationRow[];
  const userIds = [...new Set(verifications.map((row) => row.user_id))];
  const profilesByUser = new Map<
    string,
    { displayName: string | null; email: string | null; phone: string | null }
  >();

  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("authUserId,displayName,email,phone")
      .in("authUserId", userIds);

    for (const profile of profiles ?? []) {
      profilesByUser.set(profile.authUserId, {
        displayName: profile.displayName,
        email: profile.email,
        phone: profile.phone,
      });
    }
  }

  const signed = await Promise.all(
    verifications.map(async (verification) => {
      const [front, back, selfie] = await Promise.all([
        verification.license_front_url
          ? admin.storage
              .from(BUCKET)
              .createSignedUrl(verification.license_front_url, 600)
          : Promise.resolve({ data: null, error: null }),
        verification.license_back_url
          ? admin.storage
              .from(BUCKET)
              .createSignedUrl(verification.license_back_url, 600)
          : Promise.resolve({ data: null, error: null }),
        verification.selfie_url
          ? admin.storage
              .from(BUCKET)
              .createSignedUrl(verification.selfie_url, 600)
          : Promise.resolve({ data: null, error: null }),
      ]);

      return {
        id: verification.id,
        userId: verification.user_id,
        status: verification.status,
        licenseCountry: verification.license_country,
        licenseRegion: verification.license_region,
        licenseExpiresOn: verification.license_expires_on,
        reviewerNotes: verification.reviewer_notes,
        submittedAt: verification.submitted_at,
        reviewedAt: verification.reviewed_at,
        updatedAt: verification.updated_at,
        profile: profilesByUser.get(verification.user_id) ?? {
          displayName: null,
          email: null,
          phone: null,
        },
        licenseFrontUrl: front.data?.signedUrl ?? null,
        licenseBackUrl: back.data?.signedUrl ?? null,
        selfieUrl: selfie.data?.signedUrl ?? null,
      };
    }),
  );

  return json({ verifications: signed });
});
