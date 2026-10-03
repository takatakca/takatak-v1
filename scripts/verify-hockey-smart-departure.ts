import assert from "node:assert/strict";

import { buildHockeyDepartureSms } from "../src/lib/hockey/travel/departure-message";
import {
  hockeyLeaveBy,
  nextHockeyDepartureCheck,
  shouldSendHockeyDepartureAlert,
} from "../src/lib/hockey/travel/departure-policy";
import {
  computeHockeyTrafficRoute,
  isHockeySmartDepartureConfigured,
} from "../src/lib/hockey/travel/google-routes";
import {
  decryptHockeyTravelOrigin,
  encryptHockeyTravelOrigin,
  hockeyTravelAad,
} from "../src/lib/hockey/travel/travel-crypto";
import { validateHockeyTravelOriginInput } from "../src/lib/hockey/travel/travel-service";

process.env.HOCKEY_TRAVEL_ACTIVE_KEY_VERSION = "1";
process.env.HOCKEY_TRAVEL_ENCRYPTION_KEY_V1 =
  Buffer.alloc(32, 9).toString("base64");

const aad = hockeyTravelAad({
  identityId: "identity-1",
  profileId: "profile-1",
});
const encrypted = encryptHockeyTravelOrigin(
  { latitude: 45.5017, longitude: -73.5673 },
  aad,
);
assert.notEqual(encrypted.ciphertext, "45.5017");
assert.deepEqual(decryptHockeyTravelOrigin(encrypted, aad), {
  latitude: 45.5017,
  longitude: -73.5673,
});
assert.throws(() => decryptHockeyTravelOrigin(encrypted, aad + ":wrong"));

assert.equal(
  validateHockeyTravelOriginInput({
    latitude: 45.5,
    longitude: -73.6,
    label: "Maison",
  }).success,
  true,
);
assert.equal(
  validateHockeyTravelOriginInput({
    latitude: 999,
    longitude: -73.6,
  }).success,
  false,
);

const startsAt = new Date("2026-10-10T22:00:00.000Z");
const leaveBy = hockeyLeaveBy({
  startsAt,
  arrivalBufferMinutes: 30,
  durationSeconds: 20 * 60,
});
assert.equal(leaveBy.toISOString(), "2026-10-10T21:10:00.000Z");

assert.equal(
  shouldSendHockeyDepartureAlert({
    now: new Date("2026-10-10T20:59:00.000Z"),
    leaveBy,
  }),
  false,
);
assert.equal(
  shouldSendHockeyDepartureAlert({
    now: new Date("2026-10-10T21:01:00.000Z"),
    leaveBy,
  }),
  true,
);

assert.equal(
  nextHockeyDepartureCheck({
    now: new Date("2026-10-10T20:30:00.000Z"),
    leaveBy,
  }).toISOString(),
  "2026-10-10T20:45:00.000Z",
);

const sms = buildHockeyDepartureSms({
  locale: "fr",
  title: "LEAFS VERDUN vs VISITEURS",
  timezone: "America/Toronto",
  leaveBy,
  durationSeconds: 30 * 60,
  trafficDelaySeconds: 10 * 60,
  arenaName: "Auditorium de Verdun",
  sourceUrl: "https://ahmverdun.ca/schedules",
});
assert.match(sms, /pars au plus tard/i);
assert.match(sms, /délai trafic/i);
assert.ok(sms.length <= 600);

process.env.HOCKEY_SMART_DEPARTURE_ENABLED = "true";
process.env.GOOGLE_MAPS_ROUTES_API_KEY = "ci-routes-key";
assert.equal(isHockeySmartDepartureConfigured(), true);

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  assert.equal(
    String(input),
    "https://routes.googleapis.com/directions/v2:computeRoutes",
  );

  const headers = new Headers(init?.headers);
  assert.equal(headers.get("X-Goog-Api-Key"), "ci-routes-key");
  assert.equal(
    headers.get("X-Goog-FieldMask"),
    "routes.duration,routes.staticDuration,routes.distanceMeters",
  );

  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
  assert.equal(body.travelMode, "DRIVE");
  assert.equal(body.routingPreference, "TRAFFIC_AWARE_OPTIMAL");

  return new Response(
    JSON.stringify({
      routes: [
        {
          duration: "1800s",
          staticDuration: "1200s",
          distanceMeters: 15000,
        },
      ],
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}) as typeof fetch;

try {
  const route = await computeHockeyTrafficRoute({
    origin: { latitude: 45.5, longitude: -73.6 },
    destination: {
      address: "4110 boulevard LaSalle, Montréal, QC",
    },
  });
  assert.equal(route.durationSeconds, 1800);
  assert.equal(route.staticDurationSeconds, 1200);
  assert.equal(route.trafficDelaySeconds, 600);
  assert.equal(route.distanceMeters, 15000);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("verify-hockey-smart-departure: all checks passed");
