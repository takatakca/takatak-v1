// GROUPE TAKATAK Billing — signed ecosystem feed safeguards.
// Pure logic + static source checks. No database, no network.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  BILLING_FEED_APPS,
  billingFeedSecretEnvName,
  billingFeedSignedString,
  signBillingFeedRequest,
  verifyBillingFeedRequest,
} from "../src/lib/billing/invoices/feed-signature";

function pass(label: string): void {
  console.log(`PASS  ${label}`);
}

const SECRET = "feed-secret-for-tests-only-0123456789abcdef";
const OTHER = "another-apps-secret-for-tests-0123456789ab";
const PATH = "/api/integrations/billing/invoice-requests";
const now = Date.parse("2026-10-06T12:00:00Z");
const ts = String(Math.floor(now / 1000));
const body = JSON.stringify({ sourceReference: "order/1", draft: {} });
const secrets: Record<string, string> = { foodhub: SECRET, festi_ice: OTHER };
const secretFor = (app: string) => secrets[app] ?? "";
const signed = signBillingFeedRequest({ app: "foodhub", secret: SECRET, timestamp: ts, method: "POST", path: PATH, rawBody: body });
const base: Parameters<typeof verifyBillingFeedRequest>[0] = { app: "foodhub", timestamp: ts, signature: signed, method: "POST", path: PATH, rawBody: body, nowMs: now, secretFor };

assert.equal(billingFeedSignedString({ app: "foodhub", timestamp: ts, method: "post", path: PATH, rawBody: body }), `v1.foodhub.${ts}.POST.${PATH}.${body}`);
assert.match(signed, /^v1=[a-f0-9]{64}$/);
assert.deepEqual(verifyBillingFeedRequest(base), { ok: true, app: "foodhub" });
pass("a request signed with the app's own secret verifies as that app");

const code = (patch: Partial<typeof base>) => {
  const result = verifyBillingFeedRequest({ ...base, ...patch });
  return result.ok ? "OK" : `${result.status}:${result.code}`;
};
assert.equal(code({ rawBody: body.replace("order/1", "order/2") }), "401:INVALID_BILLING_SIGNATURE", "tampered body");
assert.equal(code({ path: `${PATH}?x=1` }), "401:INVALID_BILLING_SIGNATURE", "different path/query");
assert.equal(code({ method: "GET" }), "401:INVALID_BILLING_SIGNATURE", "different method");
assert.equal(code({ app: "festi_ice" }), "401:INVALID_BILLING_SIGNATURE", "another app's name with this app's signature");
assert.equal(code({ app: "manual" }), "401:UNKNOWN_BILLING_APP", "manual is admin-only");
assert.equal(code({ app: "evil" }), "401:UNKNOWN_BILLING_APP");
assert.equal(code({ app: null }), "401:UNKNOWN_BILLING_APP");
assert.equal(code({ app: "ahmv" }), "503:BILLING_FEED_NOT_CONFIGURED", "no secret configured → closed");
assert.equal(code({ secretFor: () => "short" }), "503:BILLING_FEED_NOT_CONFIGURED");
assert.equal(code({ nowMs: now + 301_000 }), "401:BILLING_TIMESTAMP_OUT_OF_TOLERANCE");
assert.equal(code({ nowMs: now - 301_000 }), "401:BILLING_TIMESTAMP_OUT_OF_TOLERANCE");
assert.equal(code({ timestamp: "abc" }), "401:INVALID_BILLING_TIMESTAMP");
assert.equal(code({ timestamp: null }), "401:INVALID_BILLING_TIMESTAMP");
for (const signature of [null, "", "v1=xyz", signed.toUpperCase(), signed.replace("v1=", "v2="), `${signed},v1=${"0".repeat(64)}`]) {
  assert.equal(code({ signature }), "401:INVALID_BILLING_SIGNATURE");
}
const forged = signBillingFeedRequest({ app: "foodhub", secret: OTHER, timestamp: ts, method: "POST", path: PATH, rawBody: body });
assert.equal(code({ signature: forged }), "401:INVALID_BILLING_SIGNATURE", "another app's secret cannot sign for this app");
pass("tampering, wrong app, wrong secret, stale timestamps and malformed signatures are refused; unconfigured apps fail closed");

assert.equal(BILLING_FEED_APPS.includes("manual" as never), false);
assert.equal(billingFeedSecretEnvName("festi_ice"), "BILLING_FEED_SECRET_FESTI_ICE");
pass("every ecosystem app except manual has its own BILLING_FEED_SECRET_<APP>");

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");
const service = read("src/lib/billing/invoices/feed-service.ts");
assert.ok(service.startsWith('import "server-only";'));
assert.ok(service.includes("sourceApp: app,"), "sourceApp comes from the verified signature");
assert.ok(service.includes('new Set(["sourceReference", "clientId", "draft"])'), "body cannot carry sourceApp or other fields");
assert.ok(service.includes("{ profileId: null }"));
assert.ok(service.includes("sourceApp_sourceReference: { sourceApp: app, sourceReference }"), "status reads are scoped to the verified app");
assert.equal(/submitInvoiceRequest|createFacturationsDraft|facturations\/client/.test(service), false, "the feed never talks to Facturations");
const route = read("src/app/api/integrations/billing/invoice-requests/route.ts");
assert.ok(route.indexOf("verifyBillingFeedHeaders") < route.indexOf("JSON.parse(rawBody)"), "signature verified before JSON parsing");
assert.ok(route.includes("BILLING_FEED_MAX_BODY_BYTES"));
assert.ok(route.includes('rawBody: ""'), "GET signs an empty body");
assert.ok(route.includes("`${url.pathname}${url.search}`"), "query string is signed");
pass("route verifies before parsing, caps the body, signs the query; service is server-only, app-scoped and Facturations-free");

console.log("\nBILLING ECOSYSTEM FEED SAFEGUARDS: ALL PASSED");
