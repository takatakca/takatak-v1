import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(
  "src/app/api/admin/ahmv/readiness/route.ts",
  "utf8",
);
const readiness = readFileSync(
  "src/lib/hockey/ops/operational-readiness.ts",
  "utf8",
);

assert.match(route, /requireAdminApiAccess/);
assert.match(route, /Cache-Control/);
assert.match(route, /no-store/);
assert.match(route, /X-Robots-Tag/);
assert.match(route, /collectAhmvOperationalReadiness/);

assert.match(readiness, /sourceApplication: "ahmverdun"/);
assert.match(readiness, /\^\\d\{8,24\}\$/);
assert.match(readiness, /ahmvScheduleFreshUntil/);
assert.match(readiness, /validateAhmvScheduleSnapshot/);
assert.match(readiness, /tenant: "ahmverdun"/);
assert.match(readiness, /code: "ahmv"/);
assert.match(readiness, /publisher\.domain === "ahmverdun\.ca"/);
assert.match(readiness, /serviceType: "social_media"/);
assert.match(readiness, /publicTeamIds/);
assert.match(readiness, /taggedContentCount > 0/);
assert.doesNotMatch(readiness, /accessToken|refreshToken|providerToken|TWILIO_AUTH_TOKEN/);

console.log("AHMV operational readiness safeguards: PASS");
