import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  SUPPORTER_THANK_YOU_WEEKS,
  isActiveSupporterGrant,
  shouldActivateSupporterGrantImmediately,
  supporterGrantExpiresAt,
} from "../src/lib/billing/hockey/premium-grant-policy";
import { parseAhmvSupporterCreditEvent } from "../src/lib/integrations/ahmv-supporter/parser";
import { verifyAhmvSupporterRequest } from "../src/lib/integrations/ahmv-supporter/signature";

assert.equal(SUPPORTER_THANK_YOU_WEEKS, 4);

const started = new Date("2026-10-03T12:00:00.000Z");
assert.equal(
  supporterGrantExpiresAt(started).toISOString(),
  "2026-10-31T12:00:00.000Z",
);

assert.equal(
  shouldActivateSupporterGrantImmediately({
    paidMembershipAccess: false,
    hasActiveComplimentaryGrant: false,
  }),
  true,
);
assert.equal(
  shouldActivateSupporterGrantImmediately({
    paidMembershipAccess: true,
    hasActiveComplimentaryGrant: false,
  }),
  false,
);
assert.equal(
  shouldActivateSupporterGrantImmediately({
    paidMembershipAccess: false,
    hasActiveComplimentaryGrant: true,
  }),
  false,
);

assert.equal(
  isActiveSupporterGrant(
    {
      status: "active",
      activatedAt: new Date("2026-10-03T00:00:00.000Z"),
      expiresAt: new Date("2026-10-31T00:00:00.000Z"),
      revokedAt: null,
    },
    new Date("2026-10-10T00:00:00.000Z"),
  ),
  true,
);
assert.equal(
  isActiveSupporterGrant(
    {
      status: "active",
      activatedAt: new Date("2026-10-03T00:00:00.000Z"),
      expiresAt: new Date("2026-10-04T00:00:00.000Z"),
      revokedAt: null,
    },
    new Date("2026-10-10T00:00:00.000Z"),
  ),
  false,
);

const event = {
  eventId: "evt-supporter-001",
  type: "supporter.credit.granted",
  occurredAt: "2026-10-03T12:00:00.000Z",
  identityId: "123e4567-e89b-42d3-a456-426614174000",
  sourcePaymentId: "pay_supporter_001",
};
const raw = JSON.stringify(event);
const parsed = parseAhmvSupporterCreditEvent(raw);
assert.equal(parsed.valid, true);

assert.equal(
  parseAhmvSupporterCreditEvent(
    JSON.stringify({ ...event, type: "supporter.credit.revoked" }),
  ).valid,
  false,
);

process.env.AHMV_SUPPORTER_SYNC_ENABLED = "true";
process.env.AHMV_SUPPORTER_SYNC_CLIENT_ID = "ahmv-supporter";
process.env.AHMV_SUPPORTER_SYNC_WEBHOOK_SECRET = "test-secret";

const now = Date.parse("2026-10-03T12:00:00.000Z");
const timestamp = String(Math.floor(now / 1000));
const signature = createHmac("sha256", "test-secret")
  .update(`${timestamp}.${event.eventId}.${raw}`, "utf8")
  .digest("hex");

const headers = new Headers({
  "x-integration-id": "ahmv-supporter",
  "x-event-id": event.eventId,
  "x-timestamp": timestamp,
  "x-signature": `sha256=${signature}`,
});

assert.deepEqual(verifyAhmvSupporterRequest(raw, headers, now), {
  valid: true,
  eventId: event.eventId,
});

const stale = new Headers(headers);
stale.set("x-timestamp", String(Math.floor((now - 6 * 60 * 1000) / 1000)));
assert.equal(verifyAhmvSupporterRequest(raw, stale, now).valid, false);

const tampered = new Headers(headers);
tampered.set("x-signature", "0".repeat(64));
assert.equal(verifyAhmvSupporterRequest(raw, tampered, now).valid, false);

console.log("verify-hockey-supporter-credit: all checks passed");
