import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    console.error("[identity-context] Supabase server configuration missing");
    return json({ error: "Service unavailable" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const token = authHeader.slice(7);
  const { data: authData, error: authError } = await admin.auth.getUser(token);

  if (authError || !authData.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const authUserId = authData.user.id;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select(
      "id,authUserId,email,displayName,firstName,lastName,phone,role,status,language,timezone",
    )
    .eq("authUserId", authUserId)
    .maybeSingle();

  if (profileError) {
    console.error("[identity-context] Profile lookup failed");
    return json({ error: "Unable to resolve identity" }, 500);
  }

  if (!profile) {
    return json({
      authenticated: true,
      linked: false,
      authUserId,
      profile: null,
      masterIdentity: null,
      sourceApplications: [],
      memberships: [],
    });
  }

  const [{ data: identity, error: identityError }, { data: memberships, error: membershipsError }] =
    await Promise.all([
      admin
        .from("master_identities")
        .select(
          "id,profileId,primaryEmailVerified,primaryPhoneVerified,locale,accountStatus",
        )
        .eq("profileId", profile.id)
        .maybeSingle(),
      admin
        .from("client_memberships")
        .select("clientId,role,status,clients(id,name,status)")
        .eq("profileId", profile.id),
    ]);

  if (identityError || membershipsError) {
    console.error("[identity-context] Identity relationship lookup failed");
    return json({ error: "Unable to resolve identity" }, 500);
  }

  let sourceApplications: Array<{
    sourceApplication: string;
    externalUserId: string;
    accountStatus: string | null;
    lastSynchronizedAt: string;
  }> = [];

  if (identity?.id) {
    const { data: sources, error: sourcesError } = await admin
      .from("source_profiles")
      .select(
        "sourceApplication,externalUserId,accountStatus,lastSynchronizedAt",
      )
      .eq("identityId", identity.id)
      .order("sourceApplication");

    if (sourcesError) {
      console.error("[identity-context] Source profile lookup failed");
      return json({ error: "Unable to resolve identity" }, 500);
    }

    sourceApplications = sources ?? [];
  }

  return json({
    authenticated: true,
    linked: Boolean(identity),
    authUserId,
    profile: {
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      role: profile.role,
      status: profile.status,
      language: profile.language,
      timezone: profile.timezone,
    },
    masterIdentity: identity
      ? {
          id: identity.id,
          primaryEmailVerified: identity.primaryEmailVerified,
          primaryPhoneVerified: identity.primaryPhoneVerified,
          locale: identity.locale,
          accountStatus: identity.accountStatus,
        }
      : null,
    sourceApplications,
    memberships: (memberships ?? []).map((membership) => ({
      clientId: membership.clientId,
      role: membership.role,
      status: membership.status,
      client: membership.clients,
    })),
  });
});
