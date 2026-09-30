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

type ApplicationRow = {
  id: string;
  user_id: string;
  status: string;
  applied_at: string;
  reviewed_at: string | null;
  reviewer_notes: string | null;
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
    const applicationId =
      typeof body.applicationId === "string" ? body.applicationId : "";
    const decision =
      body.decision === "approved" || body.decision === "rejected"
        ? body.decision
        : "";
    const notes =
      typeof body.notes === "string" ? body.notes.slice(0, 2000) : null;

    if (!UUID.test(applicationId) || !decision) {
      return json({ error: "Invalid review request" }, 400);
    }

    const { data, error } = await admin.rpc(
      "rentauto_review_host_application",
      {
        p_admin_user_id: authData.user.id,
        p_application_id: applicationId,
        p_decision: decision,
        p_notes: notes,
      },
    );

    if (error) {
      const message = error.message ?? "";
      if (message.includes("host_application_not_pending")) {
        return json({ error: "Application is no longer pending." }, 409);
      }
      if (message.includes("host_application_not_found")) {
        return json({ error: "Application not found." }, 404);
      }
      console.error("[rentauto-admin-host-applications] review failed", error.code ?? "unknown");
      return json({ error: "Could not review application." }, 500);
    }

    return json({ ok: true, application: data });
  }

  if (action !== "list") return json({ error: "Invalid action" }, 400);

  const requestedStatus =
    typeof body.status === "string" ? body.status : "pending";
  const status =
    ["pending", "approved", "rejected", "withdrawn", "all"].includes(requestedStatus)
      ? requestedStatus
      : "pending";

  let query = rentauto
    .from("host_applications")
    .select("id,user_id,status,applied_at,reviewed_at,reviewer_notes")
    .order("applied_at", { ascending: true })
    .limit(100);

  if (status !== "all") query = query.eq("status", status);

  const { data: rows, error: rowsError } = await query;
  if (rowsError) return json({ error: "Could not load applications." }, 500);

  const applications = (rows ?? []) as ApplicationRow[];
  const userIds = [...new Set(applications.map((row) => row.user_id))];

  const profilesByUser = new Map<
    string,
    { displayName: string | null; email: string | null }
  >();
  const verificationByUser = new Map<string, string>();
  const stripeByUser = new Map<
    string,
    { chargesEnabled: boolean; payoutsEnabled: boolean }
  >();

  if (userIds.length > 0) {
    const [{ data: profiles }, { data: verifications }, { data: stripeAccounts }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("authUserId,displayName,email")
          .in("authUserId", userIds),
        rentauto
          .from("host_verifications")
          .select("user_id,verification_status")
          .in("user_id", userIds),
        rentauto
          .from("stripe_accounts")
          .select("user_id,charges_enabled,payouts_enabled")
          .in("user_id", userIds),
      ]);

    for (const profile of profiles ?? []) {
      profilesByUser.set(profile.authUserId, {
        displayName: profile.displayName,
        email: profile.email,
      });
    }
    for (const verification of verifications ?? []) {
      verificationByUser.set(
        verification.user_id,
        verification.verification_status,
      );
    }
    for (const stripeAccount of stripeAccounts ?? []) {
      stripeByUser.set(stripeAccount.user_id, {
        chargesEnabled: stripeAccount.charges_enabled,
        payoutsEnabled: stripeAccount.payouts_enabled,
      });
    }
  }

  return json({
    applications: applications.map((application) => ({
      ...application,
      profile: profilesByUser.get(application.user_id) ?? {
        displayName: null,
        email: null,
      },
      verificationStatus:
        verificationByUser.get(application.user_id) ?? "not_started",
      payoutStatus: stripeByUser.get(application.user_id) ?? {
        chargesEnabled: false,
        payoutsEnabled: false,
      },
    })),
  });
});
