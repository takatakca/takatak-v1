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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Service unavailable" }, 503);
  if (!stripeKey) return json({ error: "Payment provider is not configured", code: "PAYMENT_NOT_CONFIGURED" }, 503);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authHeader.slice(7);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  const db = admin.schema("rentauto");
  const { data: role } = await db
    .from("account_roles")
    .select("id")
    .eq("auth_user_id", authData.user.id)
    .eq("role", "host")
    .maybeSingle();

  const { data: adminRole } = await db
    .from("account_roles")
    .select("id")
    .eq("auth_user_id", authData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!role && !adminRole) return json({ error: "Host role required" }, 403);

  const stripe = new Stripe(stripeKey);
  const { data: existing } = await db
    .from("stripe_accounts")
    .select("id, stripe_account_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  let stripeAccountId = existing?.stripe_account_id ?? null;
  if (!stripeAccountId) {
    const stripeAccount = await stripe.accounts.create({
      type: "standard",
      country: "CA",
      metadata: {
        vertical: "rentauto",
        auth_user_id: authData.user.id,
      },
    });
    stripeAccountId = stripeAccount.id;

    if (existing?.id) {
      const { error } = await db
        .from("stripe_accounts")
        .update({ stripe_account_id: stripeAccountId })
        .eq("id", existing.id);
      if (error) throw new Error("stripe_account_persistence_failed");
    } else {
      const { error } = await db
        .from("stripe_accounts")
        .insert({
          user_id: authData.user.id,
          stripe_account_id: stripeAccountId,
        });
      if (error) throw new Error("stripe_account_persistence_failed");
    }
  }

  const publicAppUrl =
    Deno.env.get("RENTAUTO_PUBLIC_APP_URL") ||
    Deno.env.get("PUBLIC_APP_URL") ||
    "https://rentauto.ca";

  let origin: string;
  try {
    const parsed = new URL(publicAppUrl);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      return json({ error: "Host onboarding redirect is not configured" }, 503);
    }
    origin = parsed.origin;
  } catch {
    return json({ error: "Host onboarding redirect is not configured" }, 503);
  }

  const returnUrl = new URL("/host?stripe=return", origin).toString();
  const refreshUrl = new URL("/host?stripe=refresh", origin).toString();

  const link = await stripe.accountLinks.create({
    account: stripeAccountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: "account_onboarding",
  });

  return json({ onboarding_url: link.url });
});
