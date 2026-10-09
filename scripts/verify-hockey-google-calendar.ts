import assert from "node:assert/strict";

import {
  calendarConnectionAad,
  createHockeyOAuthState,
  createHockeyPkceChallenge,
  createHockeyPkceVerifier,
  decryptHockeyGoogleTokenPayload,
  encryptHockeyGoogleTokenPayload,
  hashHockeyOAuthState,
  verifyHockeyOAuthState,
} from "../src/lib/hockey/calendar/crypto";
import {
  HOCKEY_GOOGLE_SCOPES,
  buildHockeyGoogleAuthorizationUrl,
  getHockeyGoogleRedirectUri,
} from "../src/lib/hockey/calendar/google-config";

process.env.HOCKEY_TOKEN_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 7).toString("base64");
process.env.HOCKEY_TOKEN_ACTIVE_KEY_VERSION = "1";
process.env.GOOGLE_HOCKEY_CLIENT_ID = "calendar-client.apps.googleusercontent.com";
process.env.GOOGLE_HOCKEY_CLIENT_SECRET = "ci-client-secret";
process.env.GOOGLE_HOCKEY_REDIRECT_URI =
  "https://takatak.ca/api/hockey/calendar/google/callback";

const state = createHockeyOAuthState();
assert.ok(state.length >= 32);
const hash = hashHockeyOAuthState(state);
assert.match(hash, /^[a-f0-9]{64}$/);
assert.equal(verifyHockeyOAuthState(state, hash), true);
assert.equal(verifyHockeyOAuthState(state + "x", hash), false);

const verifier = createHockeyPkceVerifier();
const challenge = createHockeyPkceChallenge(verifier);
assert.ok(verifier.length >= 43);
assert.ok(challenge.length >= 40);

assert.equal(
  getHockeyGoogleRedirectUri(),
  "https://takatak.ca/api/hockey/calendar/google/callback",
);

const authUrl = new URL(
  buildHockeyGoogleAuthorizationUrl({
    state,
    codeChallenge: challenge,
  }),
);
assert.equal(authUrl.origin, "https://accounts.google.com");
assert.equal(authUrl.searchParams.get("access_type"), "offline");
assert.equal(authUrl.searchParams.get("prompt"), "consent");
const requestedScopes = authUrl.searchParams.get("scope")?.split(" ") ?? [];
for (const scope of HOCKEY_GOOGLE_SCOPES) {
  assert.ok(requestedScopes.includes(scope));
}

const aad = calendarConnectionAad({
  identityId: "123e4567-e89b-42d3-a456-426614174000",
  connectionId: "223e4567-e89b-42d3-a456-426614174000",
});
const encrypted = encryptHockeyGoogleTokenPayload(
  {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    tokenType: "Bearer",
    scopes: [...HOCKEY_GOOGLE_SCOPES],
    externalAccountId: "parent@example.com",
    issuedAt: "2026-10-03T00:00:00.000Z",
  },
  aad,
);
assert.notEqual(encrypted.ciphertext, "access-token");
const decrypted = decryptHockeyGoogleTokenPayload(encrypted, aad);
assert.equal(decrypted.accessToken, "access-token");
assert.equal(decrypted.refreshToken, "refresh-token");
assert.equal(decrypted.externalAccountId, "parent@example.com");

assert.throws(() =>
  decryptHockeyGoogleTokenPayload(encrypted, aad + ":wrong"),
);

console.log("verify-hockey-google-calendar: all checks passed");
