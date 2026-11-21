// Claude (Anthropic) · 2026-11-21 — checks for the native app API helpers (src/lib/mobile/mobile-session.ts).
import assert from "node:assert/strict";

import {
  normalizeEmailCode,
  normalizeRefreshToken,
  readBearerToken,
  readWorkspaceHeader,
  toMobileSession,
} from "../src/lib/mobile/mobile-session";

const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlLXZhbHVl";
assert.equal(readBearerToken(`Bearer ${jwt}`), jwt);
assert.equal(readBearerToken(`bearer   ${jwt}`), jwt);
assert.equal(readBearerToken(jwt), null, "the scheme is required");
assert.equal(readBearerToken("Bearer not-a-jwt"), null);
assert.equal(readBearerToken(`Bearer ${jwt} extra`), null);
assert.equal(readBearerToken(null), null);

assert.equal(readWorkspaceHeader("0F8FAD5B-D9CB-469F-A165-70867728950E"), "0f8fad5b-d9cb-469f-a165-70867728950e");
assert.equal(readWorkspaceHeader("../../admin"), null);
assert.equal(readWorkspaceHeader(""), null);

assert.deepEqual(toMobileSession({ access_token: "a", refresh_token: "r", expires_at: 100 }), { accessToken: "a", refreshToken: "r", expiresAt: 100 });
assert.deepEqual(toMobileSession({ access_token: "a", refresh_token: "r", expires_in: 60 }, 1000), { accessToken: "a", refreshToken: "r", expiresAt: 1060 });
assert.equal(toMobileSession({ access_token: "a" }), null);
assert.equal(toMobileSession(null), null);

assert.equal(normalizeEmailCode(" 123 456 "), "123456");
assert.equal(normalizeEmailCode("12345"), null);
assert.equal(normalizeEmailCode("abcdef"), null);
assert.equal(normalizeEmailCode(123456), null);

assert.equal(normalizeRefreshToken("v1.abcDEF_123-x"), "v1.abcDEF_123-x");
assert.equal(normalizeRefreshToken("short"), null);
assert.equal(normalizeRefreshToken("has space inside"), null);

console.log("mobile-api-tests: all checks passed");
