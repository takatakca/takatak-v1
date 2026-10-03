import assert from "node:assert/strict";

import { parseAhmvTeamEventEnvelope } from "../src/lib/hockey/events/parser";
import {
  ahmvSourcePolicySummary,
  validateAhmvEventSourceUrl,
} from "../src/lib/hockey/events/source-policy";

delete process.env.AHMV_EVENT_ALLOWED_SOURCE_HOSTS;
delete process.env.AHMV_EVENT_REQUIRE_SOURCE_URL;

for (const url of [
  "https://ahmverdun.ca/schedules?teamId=123",
  "https://www.ahmverdun.com/schedules?teamId=123",
  "https://scoresheets.ca/tournament-game-scoresheet.php?gameId=1500",
  "https://www.retroaction.ca/Schedule/intro/example",
]) {
  assert.equal(validateAhmvEventSourceUrl(url).allowed, true, url);
}

assert.equal(
  validateAhmvEventSourceUrl("https://scoresheets.ca.evil.example/game").allowed,
  false,
);
assert.equal(
  validateAhmvEventSourceUrl("http://scoresheets.ca/game").allowed,
  false,
);
assert.equal(validateAhmvEventSourceUrl(null).allowed, true);

process.env.AHMV_EVENT_REQUIRE_SOURCE_URL = "true";
const missing = validateAhmvEventSourceUrl(null);
assert.equal(missing.allowed, false);
if (!missing.allowed) {
  assert.equal(missing.code, "source_required");
}

process.env.AHMV_EVENT_ALLOWED_SOURCE_HOSTS =
  "ahmverdun.ca,scoresheets.ca";
assert.equal(
  validateAhmvEventSourceUrl("https://ahmverdun.ca/game/1").allowed,
  true,
);
assert.equal(
  validateAhmvEventSourceUrl("https://retroaction.ca/game/1").allowed,
  false,
);

const raw = JSON.stringify({
  eventId: "evt-filter-001",
  type: "hockey.team_event.upsert",
  occurredAt: "2026-10-03T12:00:00.000Z",
  event: {
    sourceEventId: "game-001",
    teamId: "2025191400017862",
    eventType: "game",
    title: "LEAFS VERDUN vs VISITEURS",
    startsAt: "2026-10-10T23:00:00.000Z",
    endsAt: "2026-10-11T00:30:00.000Z",
    timezone: "America/Toronto",
    arenaName: "Auditorium de Verdun",
    arenaAddress: "4110 boulevard LaSalle, Montréal, QC",
    arenaLatitude: 45.46,
    arenaLongitude: -73.57,
    status: "confirmed",
    sourceUrl: "https://ahmverdun.ca/schedules?teamId=2025191400017862",
    sourceUpdatedAt: "2026-10-03T11:59:00.000Z",

    // Deliberately injected fields that must never enter the normalized model.
    roster: [{ firstName: "Minor", lastName: "Player" }],
    players: [{ dateOfBirth: "2015-01-01" }],
    guardianEmail: "parent@example.invalid",
    medical: "private",
  },
});

const parsed = parseAhmvTeamEventEnvelope(raw);
assert.equal(parsed.valid, true);
if (!parsed.valid) {
  throw new Error("Expected normalized AHMV event.");
}

const normalized = parsed.envelope.event as unknown as Record<string, unknown>;
for (const forbidden of [
  "roster",
  "players",
  "guardianEmail",
  "medical",
]) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(normalized, forbidden),
    false,
    forbidden,
  );
}

const summary = ahmvSourcePolicySummary();
assert.deepEqual(summary.allowedHosts, ["ahmverdun.ca", "scoresheets.ca"]);
assert.equal(summary.requireSourceUrl, true);

console.log("verify-hockey-source-filter: all checks passed");
