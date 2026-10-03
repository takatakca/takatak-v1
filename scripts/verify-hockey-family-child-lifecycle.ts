import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = readFileSync(
  "src/lib/hockey/family/child-lifecycle-service.ts",
  "utf8",
);

assert.match(service, /ownerIdentityId: identity\.id/);
assert.match(service, /memberType: "child"/);
assert.match(service, /status: "inactive"/);
assert.match(service, /hockeyFamilyEventPlan\.updateMany/);
assert.match(service, /hockeyFamilyEventRsvp\.deleteMany/);
assert.match(service, /startsAt: \{ gt: now \}/);
assert.doesNotMatch(service, /dateOfBirth|medical|school|diagnosis/i);

const route = readFileSync(
  "src/app/api/hockey/family/[familyId]/children/[childMemberId]/route.ts",
  "utf8",
);
assert.match(route, /hasValidWriteOrigin/);
assert.match(route, /PATCH/);
assert.match(route, /DELETE/);

console.log("verify-hockey-family-child-lifecycle: all checks passed");
