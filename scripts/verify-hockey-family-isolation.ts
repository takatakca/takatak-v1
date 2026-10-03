import assert from "node:assert/strict";

import {
  canUseSelectionType,
  exactTeamEventProjection,
} from "../src/lib/hockey/family/family-isolation-policy";
import { parseAhmvTeamDirectoryEnvelope } from "../src/lib/hockey/family/team-directory-parser";

const childOneTeam = "2025191400017862";
const childTwoTeam = "2025191400017621";
const parentFavorite = "2025191400022838";

const projection = exactTeamEventProjection(
  [
    { memberId: "parent", exactTeamIds: [parentFavorite] },
    { memberId: "child-one", exactTeamIds: [childOneTeam] },
    { memberId: "child-two", exactTeamIds: [childTwoTeam] },
  ],
  [
    { id: "e1", teamId: childOneTeam },
    { id: "e2", teamId: childTwoTeam },
    { id: "e3", teamId: parentFavorite },
    { id: "near-match", teamId: childOneTeam + "9" },
  ],
);

assert.deepEqual(
  projection.get("child-one")?.map((event) => event.id),
  ["e1"],
);
assert.deepEqual(
  projection.get("child-two")?.map((event) => event.id),
  ["e2"],
);
assert.deepEqual(
  projection.get("parent")?.map((event) => event.id),
  ["e3"],
);

const shared = exactTeamEventProjection(
  [
    { memberId: "child-a", exactTeamIds: [childOneTeam] },
    { memberId: "child-b", exactTeamIds: [childOneTeam] },
  ],
  [{ id: "shared-game", teamId: childOneTeam }],
);
assert.equal(shared.get("child-a")?.length, 1);
assert.equal(shared.get("child-b")?.length, 1);

assert.equal(
  canUseSelectionType({ memberType: "child", selectionType: "assigned" }),
  true,
);
assert.equal(
  canUseSelectionType({ memberType: "guardian", selectionType: "assigned" }),
  false,
);
assert.equal(
  canUseSelectionType({ memberType: "guardian", selectionType: "favorite" }),
  true,
);

const directoryRaw = JSON.stringify({
  eventId: "directory-001",
  type: "hockey.team_directory.sync",
  occurredAt: "2026-10-03T12:00:00.000Z",
  mode: "full",
  teams: [
    {
      teamId: childOneTeam,
      categorySlug: "m9",
      level: "A",
      name: "LEAFS VERDUN",
      seasonCode: "2026-2027",
      active: true,

      // Must be ignored: public team registry is not a roster.
      roster: [{ name: "Minor Player" }],
      coachEmail: "private@example.invalid",
    },
    {
      teamId: childTwoTeam,
      categorySlug: "m9",
      level: "B",
      name: "BULLDOGS VERDUN",
      seasonCode: "2026-2027",
      active: true,
    },
  ],
});

const directory = parseAhmvTeamDirectoryEnvelope(directoryRaw);
assert.equal(directory.valid, true);
if (!directory.valid) {
  throw new Error("Expected valid public team directory.");
}
assert.equal(directory.envelope.teams.length, 2);
assert.deepEqual(
  Object.keys(directory.envelope.teams[0]).sort(),
  [
    "active",
    "categorySlug",
    "level",
    "name",
    "seasonCode",
    "teamId",
  ].sort(),
);

const duplicate = parseAhmvTeamDirectoryEnvelope(
  JSON.stringify({
    ...JSON.parse(directoryRaw),
    teams: [
      JSON.parse(directoryRaw).teams[0],
      JSON.parse(directoryRaw).teams[0],
    ],
  }),
);
assert.equal(duplicate.valid, false);

console.log("verify-hockey-family-isolation: all checks passed");
