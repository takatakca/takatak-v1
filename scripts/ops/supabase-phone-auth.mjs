#!/usr/bin/env node
// Supabase phone sign-in (SMS through Twilio) for a TAKATAK project.
//
// Read-only by default: prints whether the Phone provider is on and which SMS
// provider fields are set (never the secrets themselves). With --apply it
// turns the Phone provider on with Twilio, using credentials from the
// environment. Uses the Supabase Management API.
//
//   SUPABASE_ACCESS_TOKEN=sbp_...                 (Supabase account → Access Tokens)
//   TWILIO_ACCOUNT_SID=AC...  TWILIO_AUTH_TOKEN=...
//   TWILIO_MESSAGING_SERVICE_SID=MG...            (or TWILIO_VERIFY_SERVICE_SID=VA...)
//
//   node scripts/ops/supabase-phone-auth.mjs --project utuvzrqvivqyziibobvu
//   node scripts/ops/supabase-phone-auth.mjs --project utuvzrqvivqyziibobvu --apply

const KNOWN = {
  utuvzrqvivqyziibobvu: "staging",
  pcjfahhlozsseqqevimi: "production",
};

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function env(name) {
  return process.env[name]?.trim() ?? "";
}

function fail(message) {
  console.error(`[supabase-phone-auth] ${message}`);
  process.exit(1);
}

const project = arg("--project") ?? "";
const apply = process.argv.includes("--apply");
if (!/^[a-z]{20}$/.test(project)) fail("Pass --project <20-letter project ref>.");
const token = env("SUPABASE_ACCESS_TOKEN");
if (!token) fail("SUPABASE_ACCESS_TOKEN is not set (Supabase dashboard → Account → Access Tokens).");

const base = `https://api.supabase.com/v1/projects/${project}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function readConfig() {
  const response = await fetch(base, { headers });
  if (!response.ok) fail(`Reading auth config failed: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

function summary(config) {
  const set = (key) => (config[key] ? "set" : "missing");
  return {
    project: `${project} (${KNOWN[project] ?? "unknown"})`,
    phoneProviderEnabled: Boolean(config.external_phone_enabled),
    smsProvider: config.sms_provider ?? null,
    twilioAccountSid: set("sms_twilio_account_sid"),
    twilioAuthToken: set("sms_twilio_auth_token"),
    twilioMessagingServiceSid: set("sms_twilio_message_service_sid"),
    twilioVerifyServiceSid: set("sms_twilio_verify_message_service_sid"),
    signupsDisabled: Boolean(config.disable_signup),
  };
}

const before = await readConfig();
console.log("Current:", JSON.stringify(summary(before), null, 2));

if (!apply) {
  console.log("\nRead-only. Re-run with --apply to enable the Phone provider with Twilio.");
  process.exit(0);
}

const accountSid = env("TWILIO_ACCOUNT_SID");
const authToken = env("TWILIO_AUTH_TOKEN");
const messagingSid = env("TWILIO_MESSAGING_SERVICE_SID");
const verifySid = env("TWILIO_VERIFY_SERVICE_SID");
if (!/^AC[0-9a-f]{32}$/i.test(accountSid)) fail("TWILIO_ACCOUNT_SID must look like AC + 32 hex characters.");
if (!authToken) fail("TWILIO_AUTH_TOKEN is not set.");
if (!messagingSid && !verifySid) fail("Set TWILIO_MESSAGING_SERVICE_SID (MG...) or TWILIO_VERIFY_SERVICE_SID (VA...).");

const patch = verifySid
  ? {
      external_phone_enabled: true,
      sms_provider: "twilio_verify",
      sms_twilio_verify_account_sid: accountSid,
      sms_twilio_verify_auth_token: authToken,
      sms_twilio_verify_message_service_sid: verifySid,
    }
  : {
      external_phone_enabled: true,
      sms_provider: "twilio",
      sms_twilio_account_sid: accountSid,
      sms_twilio_auth_token: authToken,
      sms_twilio_message_service_sid: messagingSid,
    };

const response = await fetch(base, { method: "PATCH", headers, body: JSON.stringify(patch) });
if (!response.ok) fail(`Update failed: HTTP ${response.status} ${(await response.text()).slice(0, 300)}`);
const after = await readConfig();
console.log("\nUpdated:", JSON.stringify(summary(after), null, 2));
if (!after.external_phone_enabled) fail("The Phone provider is still off after the update.");
console.log("\nPhone sign-in is on. Note: sign-in never creates accounts; the number must belong to an identity in this project.");
