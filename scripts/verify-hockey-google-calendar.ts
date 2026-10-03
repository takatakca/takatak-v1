import assert from "node:assert/strict";

process.env.HOCKEY_TOKEN_ACTIVE_KEY_VERSION = "1";
process.env.HOCKEY_TOKEN_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 7).toString("base64");
process.env.GOOGLE_HOCKEY_CLIENT_ID = "client-id";
process.env.GOOGLE_HOCKEY_CLIENT_SECRET = "client-secret";
process.env.GOOGLE_HOCKEY_REDIRECT_URI =
  "https://takatak.ca/api/hockey/calendar/google/callback";

const crypto = await import("../src/lib/hockey/calendar/crypto");
const config = await import("../src/lib/hockey/calendar/google-config");

const state = crypto.createHockeyOAuthState();
assert.ok(state.length >= 32);
assert.equal(
  crypto.verifyHockeyOAuthState(state, crypto.hashHockeyOAuthState(state)),
  true,
);
assert.equal(
  crypto.verifyHockeyOAuthState(
    state + "x",
    crypto.hashHockeyOAuthState(state),
  ),
  false,
);

const verifier = crypto.createHockeyPkceVerifier();
const challenge = crypto.createHockeyPkceChallenge(verifier);
assert.ok(verifier.length >= 43);
assert.ok(challenge.length >= 43);

const aad = crypto.calendarConnectionAad({
  identityId: "identity-1",
  connectionId: "connection-1",
});
const encrypted = crypto.encryptHockeyGoogleTokenPayload(
  {
    accessToken: "access-secret",
    refreshToken: "refresh-secret",
    tokenType: "Bearer",
    scopes: ["openid", "https://www.googleapis.com/auth/calendar.events"],
    externalAccountId: "google-user",
    issuedAt: "2026-10-03T12:00:00.000Z",
  },
  aad,
);
assert.ok(!encrypted.ciphertext.includes("access-secret"));

const decrypted = crypto.decryptHockeyGoogleTokenPayload(encrypted, aad);
assert.equal(decrypted.accessToken, "access-secret");
assert.equal(decrypted.refreshToken, "refresh-secret");

assert.throws(() =>
  crypto.decryptHockeyGoogleTokenPayload(
    encrypted,
    crypto.calendarConnectionAad({
      identityId: "identity-2",
      connectionId: "connection-1",
    }),
  ),
);

const authorizationUrl = new URL(
  config.buildHockeyGoogleAuthorizationUrl({
    state,
    codeChallenge: challenge,
  }),
);
assert.equal(authorizationUrl.hostname, "accounts.google.com");
assert.equal(authorizationUrl.searchParams.get("state"), state);
assert.equal(
  authorizationUrl.searchParams.get("code_challenge_method"),
  "S256",
);
assert.match(
  authorizationUrl.searchParams.get("scope") ?? "",
  /calendar\.events/,
);
assert.equal(authorizationUrl.searchParams.get("access_type"), "offline");
assert.equal(authorizationUrl.searchParams.get("prompt"), "consent");

console.log("verify-hockey-google-calendar: all checks passed");
