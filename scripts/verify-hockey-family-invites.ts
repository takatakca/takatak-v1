import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { hashHockeyFamilyInviteTokenForTest } from "../src/lib/hockey/family/guardian-invite-service";

const tokenA = "A".repeat(43);
const tokenB = "B".repeat(43);

const hashA = hashHockeyFamilyInviteTokenForTest(tokenA);
const hashA2 = hashHockeyFamilyInviteTokenForTest(tokenA);
const hashB = hashHockeyFamilyInviteTokenForTest(tokenB);

assert.match(hashA, /^[a-f0-9]{64}$/);
assert.equal(hashA, hashA2);
assert.notEqual(hashA, hashB);
assert.equal(hashA.includes(tokenA), false);

const service = readFileSync(
  "src/lib/hockey/family/guardian-invite-service.ts",
  "utf8",
);
assert.match(service, /randomBytes\(32\)\.toString\("base64url"\)/);
assert.match(service, /MAX_ACTIVE_INVITES_PER_FAMILY = 5/);
assert.match(service, /INVITE_TTL_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
assert.match(service, /status: "accepted"/);
assert.match(service, /expiresAt: \{ gt: now \}/);
assert.match(service, /inviterIdentityId === identity\.id/);
assert.match(service, /features\.has\("family_sync"\)/);
assert.doesNotMatch(service, /primaryEmail/);
assert.doesNotMatch(service, /primaryPhone/);

for (const path of [
  "src/app/api/hockey/family/[familyId]/invites/route.ts",
  "src/app/api/hockey/family/[familyId]/invites/[inviteId]/route.ts",
  "src/app/api/hockey/family/invites/accept/route.ts",
]) {
  const route = readFileSync(path, "utf8");
  assert.match(route, /hasValidWriteOrigin/, path);
}

console.log("verify-hockey-family-invites: all checks passed");
