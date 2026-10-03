import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = readFileSync(
  "src/lib/hockey/family/guardian-access-service.ts",
  "utf8",
);

assert.match(service, /ownerIdentityId/);
assert.match(service, /callerIsOwner/);
assert.match(service, /callerIsTarget/);
assert.match(service, /owner cannot be removed/i);
assert.match(service, /status: "inactive"/);
assert.match(service, /hockeyFamilyEventPlan\.updateMany/);
assert.match(service, /status: "cancelled"/);
assert.match(service, /startsAt: \{ gt: now \}/);
assert.match(service, /hockeyFamilyInvite\.updateMany/);
assert.match(service, /status: "revoked"/);
assert.doesNotMatch(service, /deleteMany\(\{[\s\S]*hockeyFamilyMember/);

const route = readFileSync(
  "src/app/api/hockey/family/[familyId]/guardians/[guardianMemberId]/route.ts",
  "utf8",
);
assert.match(route, /hasValidWriteOrigin/);
assert.match(route, /DELETE/);

console.log("verify-hockey-family-guardian-access: all checks passed");
