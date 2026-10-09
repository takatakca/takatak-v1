import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { HOCKEY_FAMILY_PLAN_STATUSES } from "../src/lib/hockey/family/game-logistics-service";

assert.deepEqual([...HOCKEY_FAMILY_PLAN_STATUSES], [
  "planned",
  "confirmed",
  "cancelled",
]);

const service = readFileSync(
  "src/lib/hockey/family/game-logistics-service.ts",
  "utf8",
);

assert.match(service, /feature: "parent_rideshare"/);
assert.match(service, /memberType: "child"/);
assert.match(service, /selectionType: "assigned"/);
assert.match(service, /teamId: event\.teamId/);
assert.match(service, /memberType: "guardian"/);
assert.match(service, /linkedIdentityId: \{ not: null \}/);
assert.match(service, /ownerIdentityId/);
assert.doesNotMatch(service, /pickupLatitude|pickupLongitude|routeHistory/);

const route = readFileSync(
  "src/app/api/hockey/family/[familyId]/events/[teamEventId]/responsibility/route.ts",
  "utf8",
);
assert.match(route, /hasValidWriteOrigin/);
assert.match(route, /childMemberId/);
assert.match(route, /driverMemberId/);

console.log("verify-hockey-family-game-logistics: all checks passed");
