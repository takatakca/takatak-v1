import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { HOCKEY_FAMILY_RSVP_RESPONSES } from "../src/lib/hockey/family/event-rsvp-service";

assert.deepEqual([...HOCKEY_FAMILY_RSVP_RESPONSES], [
  "going",
  "maybe",
  "not_going",
]);

const service = readFileSync(
  "src/lib/hockey/family/event-rsvp-service.ts",
  "utf8",
);
assert.match(service, /features\.has\("family_sync"\)/);
assert.match(service, /memberType: "child"/);
assert.match(service, /selectionType: "assigned"/);
assert.match(service, /teamId: event\.teamId/);
assert.match(service, /status === "cancelled"/);
assert.doesNotMatch(service, /notes|medical|diagnos|pickupLatitude|pickupLongitude/i);

const route = readFileSync(
  "src/app/api/hockey/family/[familyId]/events/[teamEventId]/rsvp/route.ts",
  "utf8",
);
assert.match(route, /hasValidWriteOrigin/);
assert.match(route, /memberId/);
assert.match(route, /response/);

console.log("verify-hockey-family-event-rsvp: all checks passed");
