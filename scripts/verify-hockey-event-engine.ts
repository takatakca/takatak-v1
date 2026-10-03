import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { parseAhmvTeamEventEnvelope } from "../src/lib/hockey/events/parser";
import {
  DEFAULT_DEPARTURE_CHECK_MINUTES,
  DEFAULT_SMS_REMINDER_MINUTES,
  deliveryDedupeKey,
  hockeyEventPayloadHash,
  scheduleBefore,
} from "../src/lib/hockey/events/policy";
import { verifyAhmvTeamEventRequest } from "../src/lib/hockey/events/signature";

assert.equal(DEFAULT_SMS_REMINDER_MINUTES, 120);
assert.equal(DEFAULT_DEPARTURE_CHECK_MINUTES, 120);

const raw = JSON.stringify({
  eventId: "evt-ahmv-001",
  type: "hockey.team_event.upsert",
  occurredAt: "2026-10-03T12:00:00.000Z",
  event: {
    sourceEventId: "official-game-123",
    teamId: "M12B:verdun-01",
    eventType: "game",
    title: "Verdun vs Lasalle",
    startsAt: "2026-10-10T23:00:00.000Z",
    endsAt: "2026-10-11T00:30:00.000Z",
    timezone: "America/Toronto",
    arenaName: "Arena test",
    arenaAddress: "123 Test, Montreal, QC",
    arenaLatitude: 45.5,
    arenaLongitude: -73.6,
    status: "confirmed",
    sourceUrl: "https://example.com/official-game-123",
    sourceUpdatedAt: "2026-10-03T11:59:00.000Z"
  }
});

const parsed = parseAhmvTeamEventEnvelope(raw);
assert.equal(parsed.valid, true);
if (!parsed.valid) throw new Error(parsed.error);

const hash = hockeyEventPayloadHash(parsed.envelope.event);
assert.match(hash, /^[a-f0-9]{64}$/);

assert.equal(
  scheduleBefore(
    parsed.envelope.event.startsAt,
    120,
    new Date("2026-10-10T18:00:00.000Z"),
  ).toISOString(),
  "2026-10-10T21:00:00.000Z",
);

const keyA = deliveryDedupeKey({
  identityId: "identity",
  teamEventId: "event",
  kind: "sms_reminder",
  eventRevision: hash,
});
const keyB = deliveryDedupeKey({
  identityId: "identity",
  teamEventId: "event",
  kind: "sms_reminder",
  eventRevision: hash,
});
assert.equal(keyA, keyB);
assert.match(keyA, /^[a-f0-9]{64}$/);

assert.equal(
  parseAhmvTeamEventEnvelope(
    JSON.stringify({
      ...JSON.parse(raw),
      event: { ...JSON.parse(raw).event, sourceUrl: "http://insecure.example" },
    }),
  ).valid,
  false,
);

process.env.AHMV_EVENT_SYNC_ENABLED = "true";
process.env.AHMV_EVENT_SYNC_CLIENT_ID = "ahmv-events";
process.env.AHMV_EVENT_SYNC_WEBHOOK_SECRET = "test-secret";

const now = Date.parse("2026-10-03T12:00:00.000Z");
const timestamp = String(Math.floor(now / 1000));
const signature = createHmac("sha256", "test-secret")
  .update(`${timestamp}.evt-ahmv-001.${raw}`, "utf8")
  .digest("hex");

const headers = new Headers({
  "x-integration-id": "ahmv-events",
  "x-event-id": "evt-ahmv-001",
  "x-timestamp": timestamp,
  "x-signature": `sha256=${signature}`,
});
assert.equal(verifyAhmvTeamEventRequest(raw, headers, now).valid, true);

const bad = new Headers(headers);
bad.set("x-signature", "f".repeat(64));
assert.equal(verifyAhmvTeamEventRequest(raw, bad, now).valid, false);

console.log("verify-hockey-event-engine: all checks passed");
