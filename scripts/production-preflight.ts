#!/usr/bin/env tsx
import { collectEnvPreflight } from "../src/lib/ops/env-preflight";

const result = collectEnvPreflight();
const missing = result.missingRequired;
const invalid = result.invalid;

console.log("TAKATAK production preflight (names only — never values)");
console.log("required missing:", missing.length ? missing.join(", ") : "none");
console.log("invalid or incomplete:", invalid.length ? invalid.join(", ") : "none");

if (!result.ok) {
  console.error("Preflight failed.");
  process.exit(1);
}

console.log("Environment preflight passed; this is not an authentication delivery test.");
console.log("Supabase connectivity: not tested");
console.log("Supabase Phone provider configuration / SMS delivery: not tested (direct TWILIO_VERIFY variables are not proof)");
console.log("Email OTP delivery: not tested");
console.log("Profile / MasterIdentity / tenant isolation: not tested");
console.log("MIMT telecom: separate service, not tested");
