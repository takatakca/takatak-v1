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

type VerificationRow = {
  id: string;
  user_id: string;
  id_front_url: string | null;
  id_back_url: string | null;
  selfie_url: string | null;
  verification_status: string;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  created_at: string;
  updated_at: string;
};

function ownerPath(path: string | null, userId: string): string | null {
  if (!path) return null;
  if (!path.startsWith(`${userId}/`) || path.includes("..") || path.length > 500) {
    return null;
  }
  return path;
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

    const { data: verification, error: verificationError } = await rentauto
      .from("host_verifications")
      .select("id,user_id,verification_status")
      .eq("id", verificationId)
      .maybeSingle();

    if (verificationError) return json({ error: "Could not load verification." }, 500);
    if (!verification) return json({ error: "Verification not found." }, 404);
    if (verification.verification_status !== "pending") {
      return json({ error: "Verification is no longer pending." }, 409);
    }

    const { data: updated, error: updateError } = await rentauto
      .from("host_verifications")
      .update({
        verification_status: decision,
        reviewed_at: new Date().toISOString(),
        reviewer_notes: notes,
      })
      .eq("id", verificationId)
      .eq("verification_status", "pending")
      .select("id,user_id,verification_status,reviewed_at,reviewer_notes")
      .maybeSingle();

    if (updateError || !updated) {
      console.error(
        "[rentauto-admin-host-verifications] review failed",
        updateError?.code ?? "no_row_updated",
      );
      return json({ error: "Could not review identity verification." }, 500);
    }

    const notificationTitle =
      decision === "approved"
        ? "Identity verification approved"
        : "Identity verification needs attention";
    const notificationBody =
      decision === "approved"
        ? "Your Rentauto identity verification is approved."
        : notes
          ? `Your Rentauto identity verification was not approved: ${notes}`
          : "Your Rentauto identity verification was not approved. Review your documents and submit them again.";

    await rentauto.from("notifications").insert({
      user_id: updated.user_id,
      type: "host_identity_verification",
      title: notificationTitle,
      body: notificationBody,
      link: "/host/onboarding",
      payload: {
        verificationId: updated.id,
        decision,
        reviewedBy: authData.user.id,
      },
    });

    return json({ ok: true, verification: updated });
  }

  if (action !== "list") return json({ error: "Invalid action" }, 400);

  const requestedStatus =
    typeof body.status === "string" ? body.status : "pending";
  const status =
    ["pending", "approved", "rejected", "not_started", "all"].includes(requestedStatus)
      ? requestedStatus
      : "pending";

  let query = rentauto
    .from("host_verifications")
    .select(
      "id,user_id,id_front_url,id_back_url,selfie_url,verification_status,reviewed_at,reviewer_notes,created_at,updated_at",
    )
    .order("updated_at", { ascending: true })
    .limit(100);

  if (status !== "all") query = query.eq("verification_status", status);

  const { data: rows, error: rowsError } = await query;
  if (rowsError) return json({ error: "Could not load identity verifications." }, 500);

  const verifications = (rows ?? []) as VerificationRow[];
  const userIds = [...new Set(verifications.map((row) => row.user_id))];

  const profilesByUser = new Map<
    string,
    { displayName: string | null; email: string | null }
  >();

  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("authUserId,displayName,email")
      .in("authUserId", userIds);

    for (const profile of profiles ?? []) {
      profilesByUser.set(profile.authUserId, {
        displayName: profile.displayName,
        email: profile.email,
      });
    }
  }

  const results = await Promise.all(
    verifications.map(async (verification) => {
      const idFrontPath = ownerPath(verification.id_front_url, verification.user_id);
      const idBackPath = ownerPath(verification.id_back_url, verification.user_id);
      const selfiePath = ownerPath(verification.selfie_url, verification.user_id);

      const [front, back, selfie] = await Promise.all([
        idFrontPath
          ? admin.storage.from("rentauto-ids-private").createSignedUrl(idFrontPath, 600)
          : Promise.resolve({ data: null, error: null }),
        idBackPath
          ? admin.storage.from("rentauto-ids-private").createSignedUrl(idBackPath, 600)
          : Promise.resolve({ data: null, error: null }),
        selfiePath
          ? admin.storage.from("rentauto-ids-private").createSignedUrl(selfiePath, 600)
          : Promise.resolve({ data: null, error: null }),
      ]);

      return {
        id: verification.id,
        userId: verification.user_id,
        verificationStatus: verification.verification_status,
        reviewedAt: verification.reviewed_at,
        reviewerNotes: verification.reviewer_notes,
        createdAt: verification.created_at,
        updatedAt: verification.updated_at,
        profile: profilesByUser.get(verification.user_id) ?? {
          displayName: null,
          email: null,
        },
        documents: {
          idFrontUrl: front.data?.signedUrl ?? null,
          idBackUrl: back.data?.signedUrl ?? null,
          selfieUrl: selfie.data?.signedUrl ?? null,
          complete: Boolean(idFrontPath && idBackPath && selfiePath),
        },
      };
    }),
  );

  return json({ verifications: results });
});
