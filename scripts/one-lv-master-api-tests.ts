import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { assertMasterPayloadSafe } from "../src/lib/integrations/master-api/payload-safety";
import { MasterApiInputError } from "../src/lib/integrations/master-api/errors";
import { verifyMasterApiRequest } from "../src/lib/integrations/master-api/auth";
import { sourceCustomerReference } from "../src/lib/integrations/master-api/events";

const key = "abcdefghijklmnopqrstuvwxyz0123456789ABCD";
process.env.TAKATAK_1LV_API_KEY = key;

assert.equal(
  verifyMasterApiRequest(
    new Headers({ authorization: `Bearer ${key}` }),
  ).valid,
  true,
);
assert.equal(
  verifyMasterApiRequest(
    new Headers({ authorization: "Bearer wrong" }),
  ).valid,
  false,
);

assert.equal(
  sourceCustomerReference({ customer_local_id: "profile-1" }),
  "profile-1",
);
assert.equal(
  sourceCustomerReference({ customer_local_reference: "profile-2" }),
  "profile-2",
);
assert.equal(
  sourceCustomerReference({ guest_reference: "guest:ORDER-1001" }),
  "guest:ORDER-1001",
);
assert.equal(
  sourceCustomerReference({
    customer_local_id: "profile-priority",
    customer_local_reference: "relationship-fallback",
    guest_reference: "guest-fallback",
  }),
  "profile-priority",
);

assert.doesNotThrow(() =>
  assertMasterPayloadSafe({
    source_application: "1lv",
    local_profile_id: "user-1",
    email: "client@example.ca",
    shipping_address: { city: "Montréal", postal_code: "H1H1H1" },
  }),
);

for (const payload of [
  { password: "never" },
  { nested: { refresh_token: "never" } },
  { payment: { cardNumber: "4111111111111111" } },
  { auth: [{ sessionToken: "never" }] },
  { stripe_secret_key: "never" },
]) {
  assert.throws(
    () => assertMasterPayloadSafe(payload),
    MasterApiInputError,
  );
}

const events = readFileSync(
  resolve(process.cwd(), "src/lib/integrations/master-api/events.ts"),
  "utf8",
);
assert.match(
  events,
  /EXPECTED_AGGREGATE\[eventType\] !== aggregateType/,
  "Master event ingestion must bind each event type to its aggregate type.",
);
assert.match(
  events,
  /assertMasterPayloadSafe\(input\.payload\)/,
  "Master event ingestion must reject secret-bearing payloads.",
);


const otpSendRoute = readFileSync(
  resolve(process.cwd(), "src/app/api/v1/auth/otp/send/route.ts"),
  "utf8",
);
const otpVerifyRoute = readFileSync(
  resolve(process.cwd(), "src/app/api/v1/auth/otp/verify/route.ts"),
  "utf8",
);
const phoneAuthority = readFileSync(
  resolve(process.cwd(), "src/lib/integrations/master-api/supabase-phone.ts"),
  "utf8",
);

assert.match(
  otpSendRoute,
  /sendTakatakPhoneOtp/,
  "1LV OTP send must delegate to TAKATAK Supabase Phone Auth.",
);
assert.equal(
  /sendOtpToPhone|sendPhoneOtp/.test(otpSendRoute),
  false,
  "1LV OTP send must not reintroduce a parallel phone OTP authority.",
);
assert.match(
  otpVerifyRoute,
  /verifyTakatakPhoneOtp/,
  "1LV OTP verification must use TAKATAK Supabase Phone Auth.",
);
assert.match(
  otpVerifyRoute,
  /ensureProfileForSupabaseUser/,
  "Verified 1LV phone must synchronize the TAKATAK master identity.",
);
assert.equal(
  /checkOtpFromPhone|verifyPhoneOtp/.test(
    otpVerifyRoute,
  ),
  false,
  "1LV OTP verification must not bypass shared TAKATAK Auth.",
);
assert.match(
  phoneAuthority,
  /signInWithOtp/,
  "TAKATAK master phone authority must use Supabase signInWithOtp.",
);
assert.match(
  phoneAuthority,
  /verifyOtp/,
  "TAKATAK master phone authority must use Supabase verifyOtp.",
);
assert.match(
  phoneAuthority,
  /persistSession:\s*false/,
  "Federated 1LV verification must not persist a TAKATAK session server-side.",
);


const verifyPhoneCall = otpVerifyRoute.indexOf(
  "verifyTakatakPhoneOtp(phone, code)",
);
const resolvePhoneCall = otpVerifyRoute.indexOf(
  "resolveVerifiedPhoneIdentity(phone)",
);

assert.ok(
  verifyPhoneCall >= 0 &&
    resolvePhoneCall >= 0 &&
    verifyPhoneCall < resolvePhoneCall,
  "Supabase verification must happen before phone-only identity resolution.",
);

console.log("1LV master API safeguards: PASS");
