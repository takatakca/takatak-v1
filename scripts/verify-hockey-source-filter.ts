import assert from "node:assert/strict";

import { parseAhmvTeamEventEnvelope } from "../src/lib/hockey/events/parser";
import {
  ahmvSourcePolicySummary,
  validateAhmvEventSourceUrl,
} from "../src/lib/hockey/events/source-policy";

delete process.env.AHMV_EVENT_ALLOWED_SOURCE_HOSTS;
delete process.env.AHMV_EVENT_REQUIRE_SOURCE_URL;
delete process.env.AHMV_EVENT_SYNC_ENABLED;

// No implicit trust list: an event without provenance is rejected even while
// the connector is disabled.
let decision = validateAhmvEventSourceUrl(null);
assert.equal(decision.allowed, false);
if (!decision.allowed) {
  assert.equal(decision.code, "source_required");
}

// If someone enables the signed connector before configuring exact hosts, the
// endpoint fails closed instead of falling back to hard-coded domains.
process.env.AHMV_EVENT_SYNC_ENABLED = "true";
decision = validateAhmvEventSourceUrl(
  "https://ahmverdun.com/schedules?teamId=123",
);
assert.equal(decision.allowed, false);
if (!decision.allowed) {
  assert.equal(decision.code, "source_allowlist_unconfigured");
  assert.equal(decision.status, 503);
}

process.env.AHMV_EVENT_REQUIRE_SOURCE_URL = "true";
process.env.AHMV_EVENT_ALLOWED_SOURCE_HOSTS =
  "ahmverdun.com,scoresheets.ca,page.spordle.com,www.wllv.org";

for (const url of [
  "https://ahmverdun.com/schedules?teamId=123",
  "https://scoresheets.ca/tournament.php?id=17",
  "https://page.spordle.com/fr/ahm-de-verdun/register",
  "https://www.wllv.org/schedules",
]) {
  assert.equal(validateAhmvEventSourceUrl(url).allowed, true, url);
}

// Canonical AHMV presentation domain is not automatically treated as the
// authoritative schedule source. It can be explicitly added later if the
// approved data flow changes.
assert.equal(
  validateAhmvEventSourceUrl(
    "https://ahmverdun.ca/schedules?teamId=123",
  ).allowed,
  false,
);

for (const unsafe of [
  "https://scoresheets.ca.evil.example/game",
  "http://scoresheets.ca/game",
  "https://user:pass@scoresheets.ca/game",
  "https://scoresheets.ca:8443/game",
  "https://retroaction.ca/Schedule/intro/example",
]) {
  assert.equal(validateAhmvEventSourceUrl(unsafe).allowed, false, unsafe);
}

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
    sourceUrl:
      "https://ahmverdun.com/schedules?teamId=2025191400017862",
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
assert.deepEqual(summary.allowedHosts, [
  "ahmverdun.com",
  "page.spordle.com",
  "scoresheets.ca",
  "www.wllv.org",
]);
assert.equal(summary.allowlistConfigured, true);
assert.equal(summary.requireSourceUrl, true);

console.log("verify-hockey-source-filter: all checks passed");
