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

  const { data, error } = await admin.rpc("rentauto_submit_host_application", {
    p_user_id: authData.user.id,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("verified_master_identity_required")) {
      return json(
        { error: "Verify your email before applying to host.", code: "EMAIL_VERIFICATION_REQUIRED" },
        409,
      );
    }
    console.error("[rentauto-host-application] submit failed", error.code ?? "unknown");
    return json({ error: "Could not submit host application." }, 500);
  }

  return json({ ok: true, application: data }, 200);
});
