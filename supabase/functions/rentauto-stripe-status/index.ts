import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

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


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Service unavailable" }, 503);
  if (!stripeKey) {
    return json({
      stripe_account_id: null,
      charges_enabled: false,
      payouts_enabled: false,
      onboarding_status: "not_started",
      payment_provider_configured: false,
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authHeader.slice(7);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  const db = admin.schema("rentauto");
  const { data: account } = await db
    .from("stripe_accounts")
    .select("stripe_account_id, charges_enabled, payouts_enabled, onboarded_at")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (!account?.stripe_account_id) {
    return json({
      stripe_account_id: null,
      charges_enabled: false,
      payouts_enabled: false,
      onboarding_status: "not_started",
      payment_provider_configured: true,
    });
  }

  const stripe = new Stripe(stripeKey);
  try {
    const live = await stripe.accounts.retrieve(account.stripe_account_id);
    const chargesEnabled = live.charges_enabled ?? false;
    const payoutsEnabled = live.payouts_enabled ?? false;
    const complete = chargesEnabled && payoutsEnabled;

    await db
      .from("stripe_accounts")
      .update({
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        onboarded_at: complete && !account.onboarded_at
          ? new Date().toISOString()
          : account.onboarded_at,
      })
      .eq("user_id", authData.user.id);

    return json({
      stripe_account_id: account.stripe_account_id,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
      onboarding_status: complete ? "complete" : "pending",
      payment_provider_configured: true,
    });
  } catch (error) {
    console.error("[rentauto-stripe-status] Stripe status failed", error instanceof Error ? error.message : "unknown");
    return json({
      stripe_account_id: account.stripe_account_id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      onboarding_status: "error",
      payment_provider_configured: true,
    });
  }
});
