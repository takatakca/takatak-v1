import assert from "node:assert/strict";

import {
  AHMV_PUBLIC_TEAMS,
  AHMV_PUBLIC_TEAM_SOURCE,
} from "../src/lib/hockey/public-team-directory";

assert.equal(AHMV_PUBLIC_TEAM_SOURCE.sourceApplication, "ahmverdun");
assert.equal(AHMV_PUBLIC_TEAM_SOURCE.seasonCode, "2026-2027");
assert.equal(AHMV_PUBLIC_TEAM_SOURCE.canonicalDomain, "https://ahmverdun.ca");
assert.equal(AHMV_PUBLIC_TEAM_SOURCE.legacyScheduleOrigin, "https://ahmverdun.com");
assert.equal(AHMV_PUBLIC_TEAMS.length, 24);

const ids = AHMV_PUBLIC_TEAMS.map((team) => team.teamId);
assert.equal(new Set(ids).size, ids.length, "public team IDs must be unique");

for (const team of AHMV_PUBLIC_TEAMS) {
  assert.match(team.teamId, /^\d{8,24}$/);
  assert.ok(team.name.trim().length > 0);
  assert.ok(team.categorySlug.trim().length > 0);
  assert.ok(team.level.trim().length > 0);
}

const duplicateLeafsM11 = AHMV_PUBLIC_TEAMS.filter(
  (team) =>
    team.categorySlug === "m11" &&
    team.level === "A" &&
    team.name === "LEAFS VERDUN",
);
assert.equal(duplicateLeafsM11.length, 2);
assert.notEqual(duplicateLeafsM11[0]?.teamId, duplicateLeafsM11[1]?.teamId);

console.log("AHMV public team directory verification: PASS");
