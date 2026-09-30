import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[rentauto-bootstrap-account] Server configuration missing");
    return json({ error: "Service unavailable" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const token = authHeader.slice(7);
  const { data: userData, error: userError } = await admin.auth.getUser(token);

  if (userError || !userData.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const { data, error } = await admin.rpc("bootstrap_rentauto_account", {
    p_auth_user_id: userData.user.id,
  });

  if (error) {
    if (
      error.message?.includes("verified_master_identity_required")
    ) {
      return json(
        {
          error: "Email verification required",
          code: "EMAIL_VERIFICATION_REQUIRED",
        },
        409,
      );
    }

    console.error(
      "[rentauto-bootstrap-account] Bootstrap failed",
      error.code ?? "unknown",
    );

    return json(
      {
        error: "Rentauto account could not be prepared",
        code: "RENTAUTO_BOOTSTRAP_FAILED",
      },
      500,
    );
  }

  return json({
    ok: true,
    account: data,
  });
});
