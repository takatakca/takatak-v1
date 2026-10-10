import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log("PASS:", message);
}

const service = read("src/lib/experiences/revers-experience-access.ts");
const launch = read("src/app/api/experiences/revers/launch/route.ts");
const exchange = read("src/app/api/experiences/revers/exchange/route.ts");
const eventRoute = read("src/app/api/v1/integrations/revers/events/route.ts");
const signature = read("src/lib/integrations/revers/signature.ts");
const migration = read("prisma/migrations/20261010050000_revers_product_access/migration.sql");
const nonceMigration = read("prisma/migrations/20261010051000_integration_request_nonces/migration.sql");

assert(service.includes('REVERS_PRODUCT_CODE = "revers"'), "REVERS product code is fixed");
assert(service.includes('REVERS_ACCESS_ENTITLEMENT = "revers_access"'), "REVERS entitlement is fixed");
assert(service.includes("randomBytes(32)"), "launch codes use cryptographic randomness");
assert(service.includes("hashLaunchCode"), "launch codes are hashed at rest");
assert(service.includes("LAUNCH_TTL_MS = 90_000"), "launch codes expire after 90 seconds");
assert(service.includes("usedAt: null"), "launch codes are one-time");
assert(service.includes('status !== "active"'), "suspended/canceled access is rejected");
assert(launch.includes("/login?next=%2Fapi%2Fexperiences%2Frevers%2Flaunch"), "launch uses the existing TAKATAK login flow");
assert(exchange.includes("authorizeReversExperienceService"), "exchange is service-token protected");
assert(eventRoute.includes("X-TAKATAK-Signature"), "REVERS event receiver uses the current HMAC contract");
assert(signature.includes("sha256Hex(input.body)"), "HMAC contract hashes the request body");
assert(eventRoute.includes("IntegrationRequestNonce"), "REVERS events use nonce replay protection");
assert(eventRoute.includes("sourceApplication: REVERS_INTEGRATION_ID"), "events are stored under the REVERS integration");
assert(migration.includes("revers_access"), "REVERS access entitlement is seeded");
assert(migration.includes("ENABLE ROW LEVEL SECURITY"), "REVERS membership is server-only");
assert(nonceMigration.includes("integration_request_nonces"), "nonce ledger migration exists");

console.log("REVERS TAKATAK bridge verification passed.");
