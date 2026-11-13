// ON2GO scope of the master API (slice 6): keys per scope, 1LV untouched, sources bound to scopes, launch bridge
// helpers. No database: everything here is pure.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { verifyMasterApiRequest } from "../src/lib/integrations/master-api/auth";
import {
  MASTER_API_ROUTE_SCOPES,
  MASTER_API_SCOPE_ENV,
  isMasterApiScope,
  sourceForScope,
} from "../src/lib/integrations/master-api/scope";
import {
  authorizeOn2goExperienceService,
  isLaunchCodeShape,
  on2goCallbackUrl,
  on2goIdentityUsable,
} from "../src/lib/integrations/on2go/experience-access";

const key1lv = "1lv-abcdefghijklmnopqrstuvwxyz0123456789";
const keyOn2go = "on2go-abcdefghijklmnopqrstuvwxyz01234567";
const keyFoodhub = "foodhub-abcdefghijklmnopqrstuvwxyz012345";
process.env.TAKATAK_1LV_API_KEY = key1lv;
process.env.TAKATAK_ON2GO_API_KEY = keyOn2go;
process.env.TAKATAK_FOODHUB_API_KEY = keyFoodhub;

const bearer = (key: string) => new Headers({ authorization: `Bearer ${key}` });

// 1LV only (the default): the ON2GO key is refused even when it is right.
assert.deepEqual(verifyMasterApiRequest(bearer(key1lv)), { valid: true, scope: "1lv" });
assert.equal(verifyMasterApiRequest(bearer(keyOn2go)).valid, false);
assert.equal(verifyMasterApiRequest(bearer(keyFoodhub)).valid, false);

// A route open to the three scopes tells which one matched.
const all = MASTER_API_ROUTE_SCOPES.otpSend;
assert.deepEqual(verifyMasterApiRequest(bearer(keyOn2go), all), { valid: true, scope: "on2go" });
assert.deepEqual(verifyMasterApiRequest(bearer(keyFoodhub), all), { valid: true, scope: "foodhub" });
assert.deepEqual(verifyMasterApiRequest(bearer(key1lv), all), { valid: true, scope: "1lv" });
assert.equal(verifyMasterApiRequest(bearer("wrong"), all).valid, false);
assert.equal(verifyMasterApiRequest(new Headers(), all).valid, false);

// Merchants: 1LV and Food Hub, never on2go.
assert.equal(verifyMasterApiRequest(bearer(keyOn2go), MASTER_API_ROUTE_SCOPES.resolveMerchant).valid, false);
assert.equal(verifyMasterApiRequest(bearer(keyOn2go), MASTER_API_ROUTE_SCOPES.merchantEntitlements).valid, false);
assert.deepEqual(verifyMasterApiRequest(bearer(keyFoodhub), MASTER_API_ROUTE_SCOPES.merchantEntitlements), { valid: true, scope: "foodhub" });

// A missing or short key means "not configured" for that scope, never a weak key.
process.env.TAKATAK_ON2GO_API_KEY = "short";
assert.equal(verifyMasterApiRequest(bearer("short"), ["on2go"]).valid, false);
assert.equal((verifyMasterApiRequest(bearer("short"), ["on2go"]) as { status: number }).status, 503);
assert.deepEqual(verifyMasterApiRequest(bearer(key1lv), all), { valid: true, scope: "1lv" });
process.env.TAKATAK_ON2GO_API_KEY = keyOn2go;

// Sources are bound to scopes.
assert.deepEqual(sourceForScope("on2go", "on2go"), { ok: true, source: "on2go" });
assert.deepEqual(sourceForScope(" ON2GO ", "on2go"), { ok: true, source: "on2go" });
assert.equal(sourceForScope("1lv", "on2go").ok, false);
assert.equal(sourceForScope("on2go", "1lv").ok, false);
assert.equal(sourceForScope(undefined, "foodhub").ok, false);
assert.equal(isMasterApiScope("foodhub"), true);
assert.equal(isMasterApiScope("academy"), false);
assert.deepEqual(Object.values(MASTER_API_SCOPE_ENV), ["TAKATAK_1LV_API_KEY", "TAKATAK_ON2GO_API_KEY", "TAKATAK_FOODHUB_API_KEY"]);

// The 1LV surface did not move: every 1LV-only route still calls the default authorizer.
for (const file of [
  "src/lib/integrations/master-api/identity.ts",
  "src/lib/integrations/master-api/merchant.ts",
  "src/lib/integrations/master-api/events.ts",
]) {
  const text = readFileSync(resolve(process.cwd(), file), "utf8");
  assert.match(text, /sourceForScope\(/, `${file} must bind the payload source to the caller's scope.`);
  assert.doesNotMatch(text, /!== "1lv"\)/, `${file} must not hard-code the 1LV source any more.`);
}
const events = readFileSync(resolve(process.cwd(), "src/lib/integrations/master-api/events.ts"), "utf8");
assert.match(events, /sourceApplication: parsed\.sourceApplication/, "order events look up the customer under the caller's own source.");

// Launch bridge helpers.
process.env.TAKATAK_ON2GO_SERVICE_TOKEN = "service-abcdefghijklmnopqrstuvwxyz0123456";
assert.equal(authorizeOn2goExperienceService(new Request("https://x/", { headers: bearer(process.env.TAKATAK_ON2GO_SERVICE_TOKEN) })), true);
assert.equal(authorizeOn2goExperienceService(new Request("https://x/", { headers: bearer(keyOn2go) })), false);
assert.equal(authorizeOn2goExperienceService(new Request("https://x/")), false);
process.env.TAKATAK_ON2GO_SERVICE_TOKEN = "short";
assert.equal(authorizeOn2goExperienceService(new Request("https://x/", { headers: bearer("short") })), false);

assert.equal(on2goCallbackUrl("https://on2go.ca/connexion/").toString(), "https://on2go.ca/connexion/");
assert.throws(() => on2goCallbackUrl("http://on2go.ca/connexion/"));
assert.throws(() => on2goCallbackUrl(""));
assert.equal(isLaunchCodeShape("a".repeat(43)), true);
assert.equal(isLaunchCodeShape("too-short"), false);
assert.equal(isLaunchCodeShape("bad code with spaces".padEnd(40, "x")), false);

const base = { id: "i", authUserId: "u", accountStatus: "active", firstName: null, lastName: null, locale: null, primaryPhone: "+15145550100", primaryPhoneVerified: true, primaryEmail: null, primaryEmailVerified: false };
assert.equal(on2goIdentityUsable(base), true);
assert.equal(on2goIdentityUsable({ ...base, accountStatus: null }), true);
assert.equal(on2goIdentityUsable({ ...base, accountStatus: "suspended" }), false);
assert.equal(on2goIdentityUsable({ ...base, authUserId: null }), false);
assert.equal(on2goIdentityUsable({ ...base, primaryPhoneVerified: false }), false);
assert.equal(on2goIdentityUsable({ ...base, primaryPhoneVerified: false, primaryEmail: "a@b.ca", primaryEmailVerified: true }), true);
assert.equal(on2goIdentityUsable(null), false);

console.log("on2go master api tests: OK");
