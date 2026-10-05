import assert from "node:assert/strict";

import { buildHockeySms } from "../src/lib/hockey/delivery/sms-message";
import { verifyHockeyDeliveryWorker } from "../src/lib/hockey/delivery/worker-auth";

const event = {
  teamId: "M12B:verdun-01",
  title: "Verdun vs Lasalle",
  startsAt: new Date("2026-10-10T23:00:00.000Z"),
  timezone: "America/Toronto",
  arenaName: "Aréna Test",
  arenaAddress: "123 Test, Montréal",
  status: "confirmed",
  sourceUrl: "https://example.com/game",
};

const fr = buildHockeySms({ kind: "sms_reminder", locale: "fr", event });
assert.match(fr, /Rappel AHMV/i);
assert.match(fr, /Aréna Test/i);
assert.ok(fr.length <= 600);

const en = buildHockeySms({
  kind: "sms_event_change",
  locale: "en",
  event: { ...event, status: "cancelled" },
});
assert.match(en, /CANCELLED/);

const es = buildHockeySms({
  kind: "sms_event_change",
  locale: "es",
  event: { ...event, status: "cancelled" },
});
assert.match(es, /CANCELADO/);

process.env.HOCKEY_DELIVERY_WORKER_ENABLED = "true";
process.env.HOCKEY_DELIVERY_WORKER_SECRET = "ci-worker-token";

assert.equal(
  verifyHockeyDeliveryWorker(
    new Request("https://takatak.ca/api/internal/hockey/delivery/run", {
      method: "POST",
      headers: { Authorization: "Bearer ci-worker-token" },
    }),
  ).valid,
  true,
);

assert.equal(
  verifyHockeyDeliveryWorker(
    new Request("https://takatak.ca/api/internal/hockey/delivery/run", {
      method: "POST",
      headers: { Authorization: "Bearer invalid-token" },
    }),
  ).valid,
  false,
);

console.log("verify-hockey-sms-worker: all checks passed");
