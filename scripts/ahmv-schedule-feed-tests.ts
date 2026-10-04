import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { verifyAhmvScheduleRequest } from "../src/lib/integrations/ahmv/auth";
import { buildAhmvTeamGames } from "../src/lib/integrations/ahmv/team-games";
import {
  filterAhmvScheduleEvents,
  normalizeAhmvScheduleLookup,
  torontoDate,
  validateAhmvScheduleSnapshot,
} from "../src/lib/integrations/ahmv/schedule-contract";

const now = new Date("2026-10-03T16:00:00-04:00");

function payload(overrides: Record<string, unknown> = {}) {
  return {
    status: "active",
    updatedAt: "2026-10-03T15:55:00-04:00",
    sourceUrl: "https://official.example/ahmv/schedule",
    events: [
      {
        id: "evt-1",
        type: "Match",
        team: "M13 A",
        teamId: "2025191400018816",
        category: "M13",
        startsAt: "2026-10-03T20:00:00-04:00",
        endsAt: "2026-10-03T21:30:00-04:00",
        status: "scheduled",
        opponent: "Visiteurs",
        venue: "Auditorium de Verdun",
        venueAddress: "4110 Boulevard LaSalle, Montréal, QC",
        officialUrl: "https://official.example/ahmv/event/evt-1",
      },
      {
        id: "evt-2",
        type: "Pratique",
        team: "Junior",
        category: "Junior",
        startsAt: "2026-10-04T17:00:00-04:00",
        status: "cancelled",
        venue: "Aréna St-Charles",
      },
    ],
    ...overrides,
  };
}

function withTokens<T>(fn: () => T): T {
  const previousRead = process.env.TAKATAK_AHMV_SERVICE_TOKEN;
  const previousIngest = process.env.TAKATAK_AHMV_INGEST_TOKEN;
  process.env.TAKATAK_AHMV_SERVICE_TOKEN =
    "read-secret-123456789012345678901234567890";
  process.env.TAKATAK_AHMV_INGEST_TOKEN =
    "ingest-secret-123456789012345678901234567";
  try {
    return fn();
  } finally {
    if (previousRead === undefined) delete process.env.TAKATAK_AHMV_SERVICE_TOKEN;
    else process.env.TAKATAK_AHMV_SERVICE_TOKEN = previousRead;
    if (previousIngest === undefined) delete process.env.TAKATAK_AHMV_INGEST_TOKEN;
    else process.env.TAKATAK_AHMV_INGEST_TOKEN = previousIngest;
  }
}

const valid = validateAhmvScheduleSnapshot(payload(), now);
assert.ok(valid, "fresh normalized public schedule should validate");
assert.equal(valid.events.length, 2);
assert.equal(valid.events[0]?.id, "evt-1");

assert.equal(
  validateAhmvScheduleSnapshot(
    payload({ sourceUrl: "http://official.example/schedule" }),
    now,
  ),
  null,
  "non-HTTPS provenance must be rejected",
);

assert.equal(
  validateAhmvScheduleSnapshot(
    payload({ updatedAt: "2026-10-03T16:06:00-04:00" }),
    now,
  ),
  null,
  "source timestamps over five minutes in the future must be rejected",
);

assert.equal(
  validateAhmvScheduleSnapshot(
    payload({ status: "active", events: [] }),
    now,
  ),
  null,
  "active snapshots must contain events",
);

assert.ok(
  validateAhmvScheduleSnapshot(
    payload({ status: "no_match", events: [] }),
    now,
  ),
  "an explicit fresh no_match snapshot may be empty",
);

assert.equal(
  validateAhmvScheduleSnapshot(
    payload({
      events: [
        {
          id: "same",
          type: "Match",
          startsAt: "2026-10-03T20:00:00-04:00",
          status: "scheduled",
        },
        {
          id: "same",
          type: "Match",
          startsAt: "2026-10-04T20:00:00-04:00",
          status: "scheduled",
        },
      ],
    }),
    now,
  ),
  null,
  "event ids must be unique inside one authoritative snapshot",
);

assert.equal(normalizeAhmvScheduleLookup("Aréna M13-A"), "ARENAM13A");
assert.equal(
  torontoDate("2026-10-04T01:00:00.000Z"),
  "2026-10-03",
  "date filtering must use America/Toronto rather than UTC date",
);

const filteredTeam = filterAhmvScheduleEvents(valid.events, { team: "m13-a" });
assert.deepEqual(filteredTeam.map((event) => event.id), ["evt-1"]);

const filteredTeamId = filterAhmvScheduleEvents(valid.events, {
  teamId: "2025191400018816",
});
assert.deepEqual(filteredTeamId.map((event) => event.id), ["evt-1"]);

const filteredDate = filterAhmvScheduleEvents(valid.events, {
  date: "2026-10-04",
});
assert.deepEqual(filteredDate.map((event) => event.id), ["evt-2"]);


const gameSnapshot = validateAhmvScheduleSnapshot(
  payload({
    events: [
      {
        id: "game-next",
        type: "Match",
        team: "M13 A",
        teamId: "2025191400018816",
        startsAt: "2026-10-03T20:00:00-04:00",
        status: "scheduled",
        homeTeam: "COYOTES VERDUN",
        awayTeam: "VISITEURS",
        venue: "Auditorium de Verdun",
        venueAddress: "4110 Boulevard LaSalle, Montréal, QC",
        officialUrl: "https://official.example/game-next",
      },
      {
        id: "game-final",
        type: "Match",
        team: "M13 A",
        teamId: "2025191400018816",
        startsAt: "2026-10-03T14:00:00-04:00",
        status: "final",
        homeTeam: "COYOTES VERDUN",
        awayTeam: "VISITEURS",
        homeScore: 4,
        awayScore: 2,
        officialUrl: "https://official.example/game-final",
        scoresheetUrl: "https://official.example/scoresheet/game-final",
      },
    ],
  }),
  now,
);
assert.ok(gameSnapshot, "explicit official team games should validate");
const projectedGames = buildAhmvTeamGames(gameSnapshot.events, now);
assert.equal(projectedGames.nextGame?.id, "game-next");
assert.equal(projectedGames.latestResult?.id, "game-final");
assert.equal(projectedGames.latestResult?.homeScore, 4);
assert.equal(projectedGames.recentResults.length, 1);

assert.equal(
  validateAhmvScheduleSnapshot(
    payload({
      events: [
        {
          id: "bad-final",
          type: "Match",
          teamId: "2025191400018816",
          startsAt: "2026-10-03T14:00:00-04:00",
          status: "final",
          homeTeam: "COYOTES VERDUN",
          awayTeam: "VISITEURS",
          homeScore: 4,
        },
      ],
    }),
    now,
  ),
  null,
  "final games must include both official scores",
);

withTokens(() => {
  const readHeaders = new Headers({
    authorization: ["Bearer", "read-secret-123456789012345678901234567890"].join(" "),
    "x-ahmv-tenant": "ahmverdun",
  });
  assert.deepEqual(verifyAhmvScheduleRequest(readHeaders, "read"), {
    valid: true,
  });

  assert.equal(
    verifyAhmvScheduleRequest(readHeaders, "ingest").valid,
    false,
    "read token must never authorize ingestion",
  );

  const ingestHeaders = new Headers({
    authorization: ["Bearer", "ingest-secret-123456789012345678901234567"].join(" "),
    "x-ahmv-tenant": "ahmverdun",
  });
  assert.deepEqual(verifyAhmvScheduleRequest(ingestHeaders, "ingest"), {
    valid: true,
  });

  const wrongTenant = new Headers({
    authorization: ["Bearer", "read-secret-123456789012345678901234567890"].join(" "),
    "x-ahmv-tenant": "other",
  });
  const rejected = verifyAhmvScheduleRequest(wrongTenant, "read");
  assert.equal(rejected.valid, false);
  if (rejected.valid) {
    throw new Error("Wrong tenant unexpectedly authorized.");
  }
  assert.equal(rejected.status, 403);
});

const migration = readFileSync(
  "prisma/migrations/20261003194500_ahmv_schedule_snapshot/migration.sql",
  "utf8",
);
assert.match(migration, /ahmv_schedule_snapshots/i);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
assert.match(migration, /jsonb_typeof\("events"\) = 'array'/i);
assert.doesNotMatch(
  migration,
  /CREATE POLICY/i,
  "schedule snapshots must remain backend-only with zero browser RLS policies",
);

const store = readFileSync(
  "src/lib/integrations/ahmv/schedule-store.ts",
  "utf8",
);
assert.match(store, /TransactionIsolationLevel\.Serializable/);
assert.match(store, /incoming < previous/);
assert.match(store, /Same source timestamp arrived with different schedule content/);
assert.match(store, /ahmvScheduleMaxAgeMinutes/);

const readRoute = readFileSync(
  "src/app/api/integrations/ahmv/schedule/route.ts",
  "utf8",
);
const ingestRoute = readFileSync(
  "src/app/api/integrations/ahmv/schedule/ingest/route.ts",
  "utf8",
);
const teamGamesRoute = readFileSync(
  "src/app/api/integrations/ahmv/team-games/route.ts",
  "utf8",
);
assert.match(readRoute, /verifyAhmvScheduleRequest\(request\.headers, "read"\)/);
assert.match(ingestRoute, /verifyAhmvScheduleRequest\(request\.headers, "ingest"\)/);
assert.match(readRoute, /Retry-After/);
assert.match(ingestRoute, /MAX_BODY_BYTES/);
assert.match(teamGamesRoute, /verifyAhmvScheduleRequest\(request\.headers, "read"\)/);
assert.match(teamGamesRoute, /x-ahmv-team-id/);
assert.match(teamGamesRoute, /buildAhmvTeamGames/);

console.log("AHMV schedule feed safeguards passed.");
