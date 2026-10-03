import assert from "node:assert/strict";

import {
  collectAhmvBackendReadiness,
  summarizeAhmvBackendReadiness,
} from "../src/lib/hockey/ops/readiness";

const disabled = collectAhmvBackendReadiness({
  NODE_ENV: "production",
});
assert.equal(disabled.ready, true);
assert.equal(disabled.productionSafe, true);
assert.equal(disabled.checks.every((check) => !check.enabled), true);

const incomplete = collectAhmvBackendReadiness({
  NODE_ENV: "production",
  HOCKEY_MEMBERSHIP_SELF_SERVE_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_test_example",
});
assert.equal(incomplete.ready, false);
const stripe = incomplete.checks.find(
  (check) => check.capability === "stripe_membership",
);
assert.ok(stripe);
assert.ok(stripe.missing.includes("STRIPE_HOCKEY_WEBHOOK_SECRET"));
assert.ok(stripe.missing.includes("STRIPE_PRICE_HOCKEY_MEMBER_WEEKLY_10"));

const secretMarker = "do-not-print-this-secret-value";
const report = summarizeAhmvBackendReadiness(
  collectAhmvBackendReadiness({
    NODE_ENV: "production",
    AHMV_EVENT_SYNC_ENABLED: "true",
    AHMV_EVENT_SYNC_CLIENT_ID: "ahmv-events",
    AHMV_EVENT_SYNC_WEBHOOK_SECRET: secretMarker.repeat(2),
    AHMV_EVENT_REQUIRE_SOURCE_URL: "false",
  }),
);
assert.equal(JSON.stringify(report).includes(secretMarker), false);
assert.equal(report.ready, false);

const badSourceList = collectAhmvBackendReadiness({
  NODE_ENV: "production",
  AHMV_EVENT_SYNC_ENABLED: "true",
  AHMV_EVENT_SYNC_CLIENT_ID: "ahmv-events",
  AHMV_EVENT_SYNC_WEBHOOK_SECRET: "e".repeat(40),
  AHMV_EVENT_REQUIRE_SOURCE_URL: "true",
  AHMV_EVENT_ALLOWED_SOURCE_HOSTS: "*.ahmverdun.ca,https://scoresheets.ca",
});
const eventSync = badSourceList.checks.find(
  (check) => check.capability === "event_sync",
);
assert.ok(eventSync);
assert.ok(eventSync.invalid.includes("AHMV_EVENT_ALLOWED_SOURCE_HOSTS"));

const incompleteTeamFeed = collectAhmvBackendReadiness({
  AHMV_TEAM_FEED_ENABLED: "true",
  AHMV_TEAM_FEED_SHARED_TOKEN: "too-short",
});
const teamFeed = incompleteTeamFeed.checks.find(
  (check) => check.capability === "team_feed",
);
assert.ok(teamFeed);
assert.ok(teamFeed.invalid.includes("AHMV_TEAM_FEED_SHARED_TOKEN"));

const incompleteDeparture = collectAhmvBackendReadiness({
  HOCKEY_SMART_DEPARTURE_ENABLED: "true",
  GOOGLE_MAPS_ROUTES_API_KEY: "routes-key",
});
const departure = incompleteDeparture.checks.find(
  (check) => check.capability === "smart_departure",
);
assert.ok(departure);
assert.ok(departure.missing.includes("HOCKEY_TRAVEL_ENCRYPTION_KEY_V1"));
assert.ok(departure.missing.includes("HOCKEY_SMS_ENABLED"));
assert.ok(departure.missing.includes("HOCKEY_DELIVERY_WORKER_ENABLED"));

const complete = collectAhmvBackendReadiness({
  NODE_ENV: "production",

  HOCKEY_MEMBERSHIP_SELF_SERVE_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_HOCKEY_WEBHOOK_SECRET: "whsec_" + "x".repeat(40),
  STRIPE_PRICE_HOCKEY_MEMBER_WEEKLY_10: "price_test",

  AHMV_SUPPORTER_SYNC_ENABLED: "true",
  AHMV_SUPPORTER_SYNC_CLIENT_ID: "ahmv-supporter",
  AHMV_SUPPORTER_SYNC_WEBHOOK_SECRET: "s".repeat(40),

  AHMV_EVENT_SYNC_ENABLED: "true",
  AHMV_EVENT_SYNC_CLIENT_ID: "ahmv-events",
  AHMV_EVENT_SYNC_WEBHOOK_SECRET: "e".repeat(40),
  AHMV_EVENT_REQUIRE_SOURCE_URL: "true",
  AHMV_EVENT_ALLOWED_SOURCE_HOSTS:
    "ahmverdun.ca,scoresheets.ca,page.spordle.com,www.wllv.org",

  HOCKEY_SMS_ENABLED: "true",
  HOCKEY_DELIVERY_WORKER_ENABLED: "true",
  TWILIO_ACCOUNT_SID: "AC" + "1".repeat(32),
  TWILIO_AUTH_TOKEN: "t".repeat(32),
  TWILIO_MESSAGING_SERVICE_SID: "MG" + "2".repeat(32),
  HOCKEY_DELIVERY_WORKER_SECRET: "w".repeat(40),

  HOCKEY_GOOGLE_CALENDAR_ENABLED: "true",
  GOOGLE_HOCKEY_CLIENT_ID: "client.apps.googleusercontent.com",
  GOOGLE_HOCKEY_CLIENT_SECRET: "google-secret",
  GOOGLE_HOCKEY_REDIRECT_URI:
    "https://takatak.ca/api/hockey/calendar/google/callback",
  HOCKEY_TOKEN_ENCRYPTION_KEY_V1: Buffer.alloc(32, 1).toString("base64"),

  HOCKEY_SMART_DEPARTURE_ENABLED: "true",
  GOOGLE_MAPS_ROUTES_API_KEY: "routes-api-key",
  HOCKEY_TRAVEL_ENCRYPTION_KEY_V1:
    Buffer.alloc(32, 2).toString("base64"),

  AHMV_TEAM_FEED_ENABLED: "true",
  AHMV_TEAM_FEED_SHARED_TOKEN: "f".repeat(40),
});
assert.equal(complete.ready, true);
assert.equal(complete.productionSafe, true);
assert.equal(complete.checks.every((check) => check.ready), true);

const badRedirect = collectAhmvBackendReadiness({
  HOCKEY_GOOGLE_CALENDAR_ENABLED: "true",
  GOOGLE_HOCKEY_CLIENT_ID: "client",
  GOOGLE_HOCKEY_CLIENT_SECRET: "secret",
  GOOGLE_HOCKEY_REDIRECT_URI: "http://example.com/wrong",
  HOCKEY_TOKEN_ENCRYPTION_KEY_V1: Buffer.alloc(32, 1).toString("base64"),
});
const calendar = badRedirect.checks.find(
  (check) => check.capability === "google_calendar",
);
assert.ok(calendar);
assert.ok(calendar.invalid.includes("GOOGLE_HOCKEY_REDIRECT_URI"));

console.log("verify-hockey-backend-readiness: all checks passed");
