#!/usr/bin/env node
// Read-only Twilio check for TAKATAK SMS (sign-in codes through Supabase and
// Growth review requests). Verifies the credentials, the Messaging Service or
// sender number, and the Verify service if one is used. Sends nothing.
//
//   TWILIO_ACCOUNT_SID=AC...  TWILIO_AUTH_TOKEN=...
//   TWILIO_MESSAGING_SERVICE_SID=MG... and/or TWILIO_SMS_FROM=+1... and/or TWILIO_VERIFY_SERVICE_SID=VA...
//   node scripts/ops/twilio-check.mjs

function env(name) {
  return process.env[name]?.trim() ?? "";
}

const sid = env("TWILIO_ACCOUNT_SID");
const token = env("TWILIO_AUTH_TOKEN");
if (!sid || !token) {
  console.error("[twilio-check] TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required.");
  process.exit(1);
}
const auth = { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` };
let problems = 0;

async function get(url) {
  const response = await fetch(url, { headers: auth });
  return { status: response.status, json: response.ok ? await response.json() : null };
}

function report(ok, label, detail = "") {
  if (!ok) problems += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
}

const account = await get(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`);
report(account.status === 200, "credentials", account.json ? `${account.json.friendly_name} (${account.json.status}, ${account.json.type})` : `HTTP ${account.status}`);
if (account.json && account.json.type === "Trial") {
  console.log("     Trial accounts only text verified numbers. Upgrade before real customers sign in.");
}

const messaging = env("TWILIO_MESSAGING_SERVICE_SID");
if (messaging) {
  const service = await get(`https://messaging.twilio.com/v1/Services/${messaging}`);
  report(service.status === 200, "messaging service", service.json ? service.json.friendly_name : `HTTP ${service.status}`);
  const senders = await get(`https://messaging.twilio.com/v1/Services/${messaging}/PhoneNumbers?PageSize=20`);
  const numbers = senders.json?.phone_numbers ?? [];
  report(numbers.length > 0, "messaging service has a sender number", numbers.map((n) => n.phone_number).join(", ") || "none attached");
}

const from = env("TWILIO_SMS_FROM");
if (from) {
  const owned = await get(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(from)}`);
  const match = owned.json?.incoming_phone_numbers?.[0];
  report(Boolean(match), "TWILIO_SMS_FROM belongs to this account", match ? `${match.phone_number} sms=${match.capabilities?.sms}` : from);
}

const verify = env("TWILIO_VERIFY_SERVICE_SID");
if (verify) {
  const service = await get(`https://verify.twilio.com/v2/Services/${verify}`);
  report(service.status === 200, "verify service", service.json ? service.json.friendly_name : `HTTP ${service.status}`);
}

if (!messaging && !from && !verify) {
  report(false, "sender", "set TWILIO_MESSAGING_SERVICE_SID, TWILIO_SMS_FROM or TWILIO_VERIFY_SERVICE_SID");
}
console.log(problems ? `\n${problems} problem(s).` : "\nTwilio is ready to send.");
process.exit(problems ? 1 : 0);
