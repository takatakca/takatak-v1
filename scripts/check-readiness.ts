// Phase 14 — Readiness report. Safe booleans and blockers only — no values.
const bool = (v: string | undefined) => v !== undefined && v !== "";

const supabase = bool(process.env.NEXT_PUBLIC_SUPABASE_URL) && bool(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const database = bool(process.env.DATABASE_URL);
const prodFoundationFlag = process.env.TAKATAK_FOUNDATION_MODE_ENABLED === "true";
const seedOverride = process.env.ALLOW_FOUNDATION_SEED === "true";
const healthDetails = process.env.HEALTH_DETAILS_ENABLED === "true";

console.log("TAKATAK V1 readiness (booleans only — never values)");
console.log("---------------------------------------------------");
console.log("Supabase auth configured:      ", supabase);
console.log("Database configured:           ", database);
console.log("Prod foundation override:      ", prodFoundationFlag, prodFoundationFlag ? " ⚠ unsafe for public production" : "");
console.log("Foundation seed override:      ", seedOverride, seedOverride ? " ⚠ never on customer DB" : "");
console.log("Health details exposed:        ", healthDetails);
console.log("");
console.log("Static status:");
console.log("  Foundation:        complete (Phases 0-13 + checkpoint)");
console.log("  Local development: ready (foundation mode with visible warning)");
console.log("  CI:                ready (.github/workflows/ci.yml)");
console.log("  Staging:           ready AFTER real Supabase project + env vars + RLS 001-007");
console.log("  Production:        BLOCKED — see docs/TAKATAK_V1_PRODUCTION_READINESS.md");
console.log("");
console.log("Phase 15A resolved: server-side tenant scoping ENFORCED (16-check two-tenant test: npm run qa:tenant-isolation).");
console.log("");
console.log("Remaining production blockers (static list — see readiness doc):");
for (const b of [
  "Live Supabase E2E: sign-in -> profile-sync -> membership -> isolation must be verified on a real project (staging)",
  "Owner bootstrap + membership assignment flow must be exercised with real users (npm run bootstrap:owner)",
  "No provider has passed a real credentialed test (Metricool, Upmind endpoints unconfirmed)",
  "No job worker, billing, email/SMS, file storage, monitoring, or backup verification",
]) console.log("  - " + b);
process.exit(0);
