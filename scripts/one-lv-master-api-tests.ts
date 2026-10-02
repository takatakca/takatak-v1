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
  sourceCustomerReference({ guest_reference: "order:ORDER-1001" }),
  "order:ORDER-1001",
);
assert.equal(
  sourceCustomerReference({
    customer_local_reference: "guest:ORDER-1002",
    customer_is_guest: true,
  }),
  "order:ORDER-1002",
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
assert.match(
  otpSendRoute,
  /rawIntent !== "login" && rawIntent !== "signup"/,
  "TAKATAK OTP send must validate login versus signup intent.",
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
  /resolveVerifiedPhoneIdentity\(\s*phone,\s*verifiedUser\.id,/,
  "Verified 1LV phone must resolve the TAKATAK master identity from the exact verified Auth user.",
);
assert.equal(
  /ensureProfileForSupabaseUser|user\.user_metadata\?\.email/.test(
    otpVerifyRoute,
  ),
  false,
  "1LV OTP verification must not trust an unverified metadata email.",
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
  /shouldCreateUser:\s*intent === "signup"/,
  "TAKATAK login OTP must never create an Auth user; only signup may create.",
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
assert.equal(
  /metadata\.email|\.\.\.\(metadata\.email/.test(phoneAuthority),
  false,
  "1LV phone OTP must never write an unverified email into TAKATAK Auth metadata.",
);
assert.equal(
  /body\["email"\]|normalizeEmail|validateEmail/.test(otpSendRoute),
  false,
  "The 1LV master OTP endpoint must ignore unverified email input.",
);


const verifyPhoneCall = otpVerifyRoute.indexOf(
  "verifyTakatakPhoneOtp(phone, code)",
);
const resolvePhoneCall = otpVerifyRoute.indexOf(
  "resolveVerifiedPhoneIdentity(",
);

assert.ok(
  verifyPhoneCall >= 0 &&
    resolvePhoneCall >= 0 &&
    verifyPhoneCall < resolvePhoneCall,
  "Supabase verification must happen before phone-only identity resolution.",
);
assert.match(
  otpVerifyRoute,
  /verifiedUserPhone !== phone \|\| !verifiedUser\.phone_confirmed_at/,
  "OTP verification must prove the Supabase user has the exact confirmed phone.",
);
assert.match(
  otpVerifyRoute,
  /verifiedUser\.id/,
  "Phone identity resolution must be bound to the verified Supabase Auth user.",
);

const identityResolver = readFileSync(
  resolve(process.cwd(), "src/lib/integrations/master-api/identity.ts"),
  "utf8",
);
assert.match(
  identityResolver,
  /where: \{ authUserId: verifiedAuthUserId \}/,
  "Verified phone resolution must look up the durable Supabase Auth UUID first.",
);
assert.match(
  identityResolver,
  /identity\.authUserId && identity\.authUserId !== verifiedAuthUserId/,
  "A verified phone must not take over a master identity bound to another Supabase Auth user.",
);
assert.match(
  identityResolver,
  /authUserId: verifiedAuthUserId/,
  "The verified Supabase Auth UUID must be persisted on the master identity.",
);
assert.match(
  identityResolver,
  /profile\.authUserId !== verifiedAuthUserId/,
  "Phone-profile fallback must require the same verified Supabase Auth user.",
);
assert.match(
  identityResolver,
  /primaryEmailVerified \? identity\.primaryEmail : null/,
  "1LV OTP responses must never expose an unverified TAKATAK email.",
);
assert.match(
  identityResolver,
  /resolveExplicitIdentity/,
  "1LV source events may link an existing master identity only by explicit master UUID.",
);
assert.equal(
  /async function resolveCandidate/.test(identityResolver),
  false,
  "Unverified source email/phone must never select a global master identity.",
);
assert.match(
  identityResolver,
  /Unverified source identifiers stay only in SourceProfile/,
  "Unverified 1LV identifiers must remain source-scoped.",
);
assert.match(
  identityResolver,
  /sourceOnlyIdentity/,
  "A source-only placeholder must be explicitly promoted after TAKATAK verification.",
);
assert.match(
  identityResolver,
  /sourceProfileCount !== 1/,
  "Placeholder promotion must fail closed when the old identity is shared.",
);

const masterApiAuth = readFileSync(
  resolve(process.cwd(), "src/lib/integrations/master-api/auth.ts"),
  "utf8",
);
assert.match(
  masterApiAuth,
  /TAKATAK_1LV_API_KEY/,
  "1LV must use an application-scoped TAKATAK server credential.",
);
assert.equal(
  /process\.env\.TAKATAK_MASTER_API_KEY/.test(masterApiAuth),
  false,
  "TAKATAK must not expose a single global child-application API credential.",
);

const bridgeMigration = readFileSync(
  resolve(
    process.cwd(),
    "prisma/migrations/20261001155500_1lv_master_bridge/migration.sql",
  ),
  "utf8",
);
assert.match(
  bridgeMigration,
  /ADD COLUMN IF NOT EXISTS "authUserId" uuid/,
  "The production bridge migration must persist the verified Supabase Auth UUID.",
);
assert.match(
  bridgeMigration,
  /master_identities_authUserId_key/,
  "The master Auth UUID binding must be unique.",
);

const productionReconciliation = readFileSync(
  resolve(process.cwd(), "scripts/reconcile-production-migrations.mjs"),
  "utf8",
);
assert.match(
  productionReconciliation,
  /TARGET_SUPABASE_HISTORY_NAMES/,
  "Production reconciliation must recognize verified Supabase history aliases for the 1LV bridge.",
);
assert.match(
  productionReconciliation,
  /targetAppliedOutsidePrisma/,
  "Production reconciliation must distinguish SQL already applied outside Prisma.",
);
assert.match(
  productionReconciliation,
  /runPrisma\(\["resolve", "--applied", TARGET_MIGRATION\]/,
  "An already-applied bridge must be recorded in Prisma without replaying its SQL.",
);
assert.match(
  productionReconciliation,
  /Target migration SQL in Supabase history does not match the repository/,
  "Supabase history must match repository SQL before resolve-only reconciliation.",
);

const merchantResolver = readFileSync(
  resolve(process.cwd(), "src/lib/integrations/master-api/merchant.ts"),
  "utf8",
);
assert.match(
  merchantResolver,
  /explicitId && explicitId !== existing\.merchantId/,
  "An existing 1LV merchant source link must fail closed on master-ID mismatch.",
);

console.log("1LV master API safeguards: PASS");
