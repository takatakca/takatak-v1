import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HOCKEY_FAMILY_RSVP_STATUSES } from "../src/lib/hockey/family/rsvp-service";

assert.deepEqual([...HOCKEY_FAMILY_RSVP_STATUSES], ["going", "not_going", "unsure"]);

const service = readFileSync("src/lib/hockey/family/rsvp-service.ts", "utf8");
assert.match(service, /features\.has\("family_sync"\)/);
assert.match(service, /selectionType: "assigned"/);
assert.match(service, /teamId: event\.teamId/);
assert.match(service, /event\.status === "cancelled"/);
assert.doesNotMatch(service, /medical|reason|note|comment/i);

const migration = readFileSync(
  "prisma/migrations/20261003090000_hockey_family_event_rsvp/migration.sql",
  "utf8",
);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /REVOKE ALL/);
assert.match(migration, /'going','not_going','unsure'/);

const route = readFileSync(
  "src/app/api/hockey/family/[familyId]/events/[teamEventId]/rsvp/route.ts",
  "utf8",
);
assert.match(route, /hasValidWriteOrigin/);

console.log("verify-hockey-family-rsvp: all checks passed");
