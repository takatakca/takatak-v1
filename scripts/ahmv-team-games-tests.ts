import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  filterAhmvScheduleEvents,
  validateAhmvScheduleSnapshot,
} from "../src/lib/integrations/ahmv/schedule-contract";
import { buildAhmvTeamGames } from "../src/lib/integrations/ahmv/team-games";

const now = new Date("2026-10-04T12:00:00-04:00");
const teamId = "2025191400017305";

const snapshot = validateAhmvScheduleSnapshot(
  {
    status: "active",
    updatedAt: "2026-10-04T11:55:00-04:00",
    sourceUrl: "https://official.example/ahmv/schedule",
    events: [
      {
        id: "final-1",
        type: "Match",
        team: "DUCKS M7-0 VERDUN",
        teamId,
        category: "M7",
        startsAt: "2026-10-03T18:00:00-04:00",
        status: "final",
        homeTeam: "DUCKS M7-0 VERDUN",
        awayTeam: "OPPONENT A",
        homeScore: 4,
        awayScore: 2,
        venue: "Auditorium de Verdun",
        officialUrl: "https://official.example/game/final-1",
        scoresheetUrl: "https://official.example/scoresheet/final-1",
      },
      {
        id: "next-1",
        type: "Match",
        team: "DUCKS M7-0 VERDUN",
        teamId,
        category: "M7",
        startsAt: "2026-10-05T18:30:00-04:00",
        status: "scheduled",
        homeTeam: "OPPONENT B",
        awayTeam: "DUCKS M7-0 VERDUN",
        venue: "Aréna Denis-Savard",
        venueAddress: "4110 Boulevard LaSalle, Montréal, QC",
        officialUrl: "https://official.example/game/next-1",
      },
      {
        id: "not-exact-team",
        type: "Match",
        team: "OTHER TEAM",
        teamId: "2025191400019999",
        category: "M7",
        startsAt: "2026-10-05T19:00:00-04:00",
        status: "scheduled",
        homeTeam: "OTHER TEAM",
        awayTeam: "OPPONENT C",
      },
      {
        id: "no-home-away",
        type: "Match",
        team: "DUCKS M7-0 VERDUN",
        teamId,
        category: "M7",
        startsAt: "2026-10-06T18:30:00-04:00",
        status: "scheduled",
        opponent: "OPPONENT D",
      },
    ],
  },
  now,
);

assert.ok(snapshot, "team game public fields should validate in the authoritative snapshot");
assert.equal(snapshot.events[0]?.status, "final");
assert.equal(snapshot.events[0]?.scoresheetUrl, "https://official.example/scoresheet/final-1");

const exactEvents = filterAhmvScheduleEvents(snapshot.events, { teamId });
assert.deepEqual(
  exactEvents.map((event) => event.id),
  ["final-1", "next-1", "no-home-away"],
  "exact public team ID must be the join boundary",
);

const games = buildAhmvTeamGames(exactEvents, now);
assert.equal(games.nextGame?.id, "next-1");
assert.equal(games.latestResult?.id, "final-1");
assert.deepEqual(games.recentResults.map((game) => game.id), ["final-1"]);
assert.equal(
  games.recentResults.some((game) => game.id === "no-home-away"),
  false,
  "team games must never infer home/away sides from team + opponent",
);

assert.equal(
  validateAhmvScheduleSnapshot(
    {
      status: "active",
      updatedAt: "2026-10-04T11:55:00-04:00",
      sourceUrl: "https://official.example/ahmv/schedule",
      events: [
        {
          id: "bad-score",
          type: "Match",
          teamId,
          startsAt: "2026-10-03T18:00:00-04:00",
          status: "final",
          homeTeam: "HOME",
          awayTeam: "AWAY",
          homeScore: 3,
        },
      ],
    },
    now,
  ),
  null,
  "one-sided score data must be rejected rather than guessed",
);

const route = readFileSync(
  "src/app/api/integrations/ahmv/team-games/route.ts",
  "utf8",
);
assert.match(route, /verifyAhmvScheduleRequest\(request\.headers, "read"\)/);
assert.match(route, /x-ahmv-team-id/);
assert.match(route, /scopedTeamId !== teamId/);
assert.match(route, /readAhmvScheduleSnapshot\(\{ teamId \}\)/);
assert.match(route, /Retry-After/);
assert.doesNotMatch(route, /opponent.*homeTeam|opponent.*awayTeam/);

console.log("AHMV exact-team games safeguards passed.");
