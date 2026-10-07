#!/usr/bin/env node
// Read-only readiness probe for a live TAKATAK deployment. Sends no email and
// no SMS, reads no data, and needs no secrets.
//
//   node scripts/ops/live-readiness.mjs --origin https://staging.takatak.ca
//
// Checks: health; email sign-in configuration (by asking for a code for an
// address that cannot exist: a configured server answers "not found", an
// unconfigured one "not configured"); Supabase phone sign-in (public auth
// settings of the project the login page uses); Growth Suite routes and their
// configuration (each answers "not configured" until its secrets are set).

import { randomUUID } from "node:crypto";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

let origin;
try {
  origin = new URL(arg("--origin") ?? "").origin;
} catch {
  console.error("Pass --origin https://your-domain");
  process.exit(1);
}

const results = [];
function line(state, label, detail) {
  results.push(state);
  console.log(`${state.padEnd(7)} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function request(path, init = {}) {
  try {
    const response = await fetch(`${origin}${path}`, { redirect: "manual", signal: AbortSignal.timeout(15_000), ...init });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: response.status, json, text };
  } catch (error) {
    return { status: 0, json: null, text: String(error) };
  }
}

console.log(`TAKATAK readiness: ${origin}\n`);

const ready = await request("/api/health/ready");
line(ready.json?.ok ? "OK" : "FAIL", "health", ready.json ? JSON.stringify(ready.json.checks ?? ready.json) : `HTTP ${ready.status}`);

// Email sign-in: an address that cannot exist never receives anything.
const probe = await request("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json", Origin: origin, Referer: `${origin}/login` },
  body: JSON.stringify({ email: `readiness-${randomUUID().slice(0, 8)}@example.com` }),
});
if (probe.json?.code === "configuration_unavailable") line("FAIL", "email sign-in", "EMAIL_USER / EMAIL_PASSWORD (or SendGrid) missing on this server");
else if (probe.json?.code === "email_not_found") line("OK", "email sign-in", "mail provider configured");
else line("WARN", "email sign-in", `unexpected answer HTTP ${probe.status} ${probe.json?.code ?? ""}`);

// Phone sign-in: the login page's Supabase project and its public auth settings.
const login = await request("/login");
const chunks = [...new Set((login.text.match(/\/_next\/static\/[^"']+\.js/g) ?? []))];
let supabaseUrl = null;
let publicKey = null;
for (const chunk of chunks) {
  const js = (await request(chunk)).text;
  supabaseUrl ??= js.match(/https:\/\/[a-z]{20}\.supabase\.co/)?.[0] ?? null;
  publicKey ??= js.match(/sb_publishable_[A-Za-z0-9_-]+|eyJhbGciOi[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0] ?? null;
  if (supabaseUrl && publicKey) break;
}
if (!login.text.includes("TAKATAK SMS") && !chunks.length) {
  line("INFO", "phone sign-in", "no SMS login on this deployment");
} else if (!supabaseUrl || !publicKey) {
  line("INFO", "phone sign-in", "this deployment's login page does not use Supabase phone sign-in");
} else {
  try {
    const settings = await (await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: publicKey }, signal: AbortSignal.timeout(15_000) })).json();
    const ref = supabaseUrl.slice(8, 28);
    if (settings.external?.phone) line("OK", "phone sign-in", `Supabase ${ref}: Phone provider on (${settings.sms_provider})`);
    else line("FAIL", "phone sign-in", `Supabase ${ref}: Phone provider OFF — run scripts/ops/supabase-phone-auth.mjs --project ${ref} --apply`);
  } catch {
    line("WARN", "phone sign-in", "could not read Supabase auth settings");
  }
}

// Growth Suite (present only once the branch is deployed).
const script = await request("/takatak-analytics.js");
if (script.status !== 200) {
  line("INFO", "Growth Suite", "not deployed on this origin yet");
} else {
  line("OK", "Growth embeds", "takatak-analytics.js served");
  const gateway = await request("/api/ai/credits/balance?clientId=00000000-0000-4000-8000-000000000000");
  line(gateway.status === 401 ? "OK" : gateway.status === 503 ? "TODO" : "WARN", "AI gateway API", gateway.status === 503 ? "TAKATAK_AI_GATEWAY_TOKEN not set" : `HTTP ${gateway.status}`);
  const cron = await request("/api/cron/growth-agents");
  line(cron.status === 401 ? "OK" : "WARN", "growth cron", cron.status === 401 ? "protected (needs CRON_SECRET)" : `HTTP ${cron.status}`);
  for (const [path, label] of [
    ["/api/billing/ai-credits/webhook", "Stripe credits webhook"],
    ["/api/billing/growth/webhook", "Stripe plans webhook"],
  ]) {
    const hook = await request(path, { method: "POST", body: "{}" });
    line(hook.status === 400 ? "OK" : hook.status === 503 ? "TODO" : "WARN", label, hook.status === 503 ? "webhook secret not set" : `HTTP ${hook.status} (rejects unsigned calls)`);
  }
}

const failed = results.filter((r) => r === "FAIL").length;
console.log(failed ? `\n${failed} blocking problem(s).` : "\nNo blocking problem found.");
process.exit(failed ? 1 : 0);
