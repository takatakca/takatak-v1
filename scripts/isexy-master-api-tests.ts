import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { verifyMasterApiRequest } from "../src/lib/integrations/master-api/auth";

const oneLvKey = "1lv-abcdefghijklmnopqrstuvwxyz0123456789";
const isexyKey = "isexy-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const bearer = (k: string) => new Headers({ authorization: `Bearer ${k}` });

// --- Fails closed when nothing is configured -------------------------------
delete process.env.TAKATAK_1LV_API_KEY;
delete process.env.TAKATAK_ISEXY_API_KEY;
{
  const r = verifyMasterApiRequest(bearer(isexyKey), ["1lv", "isexy"]);
  assert.equal(r.valid, false);
  assert.equal(!r.valid && r.status, 503);
}

// --- Short keys are never accepted ------------------------------------------
process.env.TAKATAK_ISEXY_API_KEY = "too-short";
assert.equal(verifyMasterApiRequest(bearer("too-short"), ["isexy"]).valid, false);

process.env.TAKATAK_1LV_API_KEY = oneLvKey;
process.env.TAKATAK_ISEXY_API_KEY = isexyKey;

// --- Each key authenticates as its own application ---------------------------
{
  const r = verifyMasterApiRequest(bearer(isexyKey), ["1lv", "isexy"]);
  assert.equal(r.valid, true);
  assert.equal(r.valid && r.application, "isexy");
}
{
  const r = verifyMasterApiRequest(bearer(oneLvKey), ["1lv", "isexy"]);
  assert.equal(r.valid, true);
  assert.equal(r.valid && r.application, "1lv");
}

// --- Default scope stays 1LV-only (events, merchants) ------------------------
assert.equal(verifyMasterApiRequest(bearer(isexyKey)).valid, false);
assert.equal(verifyMasterApiRequest(bearer(oneLvKey)).valid, true);

// --- Wrong / missing credentials --------------------------------------------
{
  const r = verifyMasterApiRequest(bearer("x".repeat(40)), ["1lv", "isexy"]);
  assert.equal(r.valid, false);
  assert.equal(!r.valid && r.status, 401);
}
assert.equal(verifyMasterApiRequest(new Headers(), ["1lv", "isexy"]).valid, false);

// --- Route wiring (static) ---------------------------------------------------
const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

for (const route of [
  "src/app/api/v1/auth/otp/send/route.ts",
  "src/app/api/v1/auth/otp/verify/route.ts",
  "src/app/api/v1/identity/resolve-person/route.ts",
]) {
  assert.match(read(route), /authorizeMasterApplication\(\s*request,\s*\["1lv", "isexy"\]/, `${route} must admit exactly 1LV and ISEXY`);
}

for (const route of [
  "src/app/api/v1/events/route.ts",
  "src/app/api/v1/identity/resolve-merchant/route.ts",
]) {
  const source = read(route);
  assert.match(source, /authorizeMasterRequest\(request\)/, `${route} must stay 1LV-only`);
  assert.equal(/"isexy"/.test(source), false, `${route} must not admit ISEXY`);
}

const resolvePerson = read("src/app/api/v1/identity/resolve-person/route.ts");
assert.match(
  resolvePerson,
  /resolveMasterPerson\(\s*body as MasterPersonPayload,\s*application,\s*\)/,
  "resolve-person must bind writes to the authenticated application",
);

const identity = read("src/lib/integrations/master-api/identity.ts");
assert.match(
  identity,
  /source !== authenticatedApplication/,
  "A child application may only write source profiles for itself",
);

const auth = read("src/lib/integrations/master-api/auth.ts");
assert.match(auth, /isexy: "TAKATAK_ISEXY_API_KEY"/);
assert.equal(/TAKATAK_MASTER_API_KEY/.test(auth), false, "No global master key");

console.log("ISEXY master API safeguards: PASS");
