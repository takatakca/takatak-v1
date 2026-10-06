// Growth Suite safeguards: catalog integrity, honest status vocabulary and the
// site-audit SSRF guard. Pure checks, no network and no database.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { AI_AGENTS, AI_CREDIT_ACTIONS, AI_CREDIT_PACKS, AI_PROVIDERS } from "../src/lib/growth/ai-engine";
import { CONNECTORS, CONNECTOR_CATEGORY_ORDER, connectorByKey } from "../src/lib/growth/connectors";
import { GROWTH_MODULES } from "../src/lib/growth/modules";
import { GROWTH_STAGES, SERVICE_PLANS } from "../src/lib/growth/plans";
import { getAiEngineStatus, getConnectorStatuses } from "../src/lib/growth/status";
import {
  classifyDevice,
  isBotUserAgent,
  normalizeSiteDomain,
  originAllowed,
  originsForDomain,
  parseAudienceRule,
  parseCollectPayload,
} from "../src/lib/analytics/parse";
import { parsePublicRatingInput, parseReviewProfileInput } from "../src/lib/reputation/validation";
import { normalizeAuditUrl } from "../src/lib/seo/site-audit";

function pass(label: string): void {
  console.log(`PASS  ${label}`);
}

function routeExists(href: string): boolean {
  const clean = href.split("?")[0].replace(/\/$/, "");
  return fs.existsSync(path.join("src/app", clean, "page.tsx"));
}

function unique(values: string[], label: string): void {
  assert.equal(new Set(values).size, values.length, `${label} keys must be unique`);
}

function verifyCatalog(): void {
  unique(CONNECTORS.map((c) => c.key), "connector");
  unique(AI_PROVIDERS.map((p) => p.key), "AI provider");
  unique(AI_AGENTS.map((a) => a.key), "agent");
  unique(AI_CREDIT_ACTIONS.map((a) => a.key), "credit action");
  unique(SERVICE_PLANS.map((p) => p.key), "service plan");
  pass("catalog keys are unique");

  for (const c of CONNECTORS) {
    assert.ok(CONNECTOR_CATEGORY_ORDER.includes(c.category), `${c.key} has an ordered category`);
    if (c.kind === "external") assert.ok(c.env.length > 0, `${c.key} external connector lists env vars`);
    else assert.equal(c.env.length, 0, `${c.key} non-external connector needs no env`);
    for (const name of c.env) assert.match(name, /^[A-Z][A-Z0-9_]+$/, `${c.key} env name ${name}`);
    if (c.managedIn) assert.ok(routeExists(c.managedIn), `${c.key} managedIn route ${c.managedIn} exists`);
    if (c.docsUrl) assert.ok(c.docsUrl.startsWith("https://"), `${c.key} docs url is https`);
  }
  pass("connectors are well-formed and link to real routes");

  assert.equal(AI_PROVIDERS.length, 13, "AI roster has 13 engines");
  for (const agent of AI_AGENTS) {
    for (const key of agent.connectorKeys) assert.ok(connectorByKey(key), `${agent.key} uses known connector ${key}`);
    for (const key of agent.creditActionKeys) {
      assert.ok(AI_CREDIT_ACTIONS.some((a) => a.key === key), `${agent.key} uses known credit action ${key}`);
    }
  }
  for (const stage of GROWTH_STAGES) {
    assert.ok(routeExists(stage.href), `stage ${stage.key} route exists`);
    for (const key of stage.connectorKeys) assert.ok(connectorByKey(key), `stage ${stage.key} uses known connector ${key}`);
  }
  for (const m of GROWTH_MODULES) assert.ok(routeExists(m.href), `module route ${m.href} exists`);
  pass("agents, stages and modules reference real connectors and routes");

  for (const a of AI_CREDIT_ACTIONS) assert.ok(Number.isInteger(a.credits) && a.credits > 0, `${a.key} credits`);
  for (const p of AI_CREDIT_PACKS) assert.ok(p.credits > 0 && p.priceCad > 0, `${p.key} pack`);
  for (const p of SERVICE_PLANS) {
    assert.ok(p.monthlyCad > 0, `${p.key} price`);
    assert.ok(GROWTH_STAGES.some((s) => s.key === p.stage), `${p.key} stage`);
  }
  pass("credits and prices are positive and staged");
}

function verifyHonestStatuses(): void {
  const saved = { ...process.env };
  try {
    for (const c of CONNECTORS) for (const name of c.env) delete process.env[name];
    for (const p of AI_PROVIDERS) delete process.env[p.env];
    delete process.env.TAKATAK_AI_GATEWAY_URL;
    delete process.env.TAKATAK_AI_GATEWAY_TOKEN;

    const empty = getConnectorStatuses();
    for (const s of empty) {
      if (s.kind === "external") {
        assert.equal(s.state, "not_configured", `${s.key} not configured without env`);
        assert.deepEqual(s.missing, s.env);
      }
    }
    assert.equal(getAiEngineStatus().configuredCount, 0);
    assert.equal(getAiEngineStatus().gateway.configured, false);

    process.env.SEMRUSH_API_KEY = "   ";
    assert.equal(getConnectorStatuses().find((s) => s.key === "semrush")?.state, "not_configured", "whitespace is not a credential");
    process.env.SEMRUSH_API_KEY = "x";
    assert.equal(getConnectorStatuses().find((s) => s.key === "semrush")?.state, "configured_untested");

    const states = new Set(getConnectorStatuses().map((s) => s.state as string));
    assert.ok(!states.has("connected"), "presence checks never claim connected");
    pass("statuses are presence-only and never claim connected");
  } finally {
    process.env = saved;
  }
}

function rejects(raw: string): void {
  assert.throws(() => normalizeAuditUrl(raw), Error, `should reject ${raw}`);
}

function verifyAuditUrlGuard(): void {
  assert.equal(normalizeAuditUrl("example.com").toString(), "https://example.com/");
  assert.equal(normalizeAuditUrl("http://example.com/a#frag").toString(), "http://example.com/a");
  assert.equal(normalizeAuditUrl("https://example.com:443/").hostname, "example.com");
  pass("audit accepts public http(s) URLs and strips fragments");

  for (const raw of [
    "",
    "ftp://example.com",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "http://localhost",
    "http://localhost:3000",
    "http://intranet",
    "http://printer.local",
    "http://db.internal",
    "http://user:pass@example.com",
    "http://example.com:8080",
    "http://127.0.0.1",
    "http://10.0.0.5",
    "http://172.16.3.4",
    "http://192.168.1.1",
    "http://169.254.169.254/latest/meta-data",
    "http://100.64.0.1",
    "http://0.0.0.0",
    "http://[::1]",
    "http://[fd00::1]",
    "http://[fe80::1]",
    "http://[::ffff:127.0.0.1]",
  ]) {
    rejects(raw);
  }
  pass("audit rejects private, local, credentialed and non-web targets");
}

function verifyAnalyticsParsing(): void {
  const key = "tk_abcdefghijklmnopqrstuvwx";
  const pv = parseCollectPayload({ k: key, u: "https://www.garage.ca/services//freins?utm_source=fb&utm_campaign=fall&x=1", r: "https://www.google.com/search?q=x" });
  assert.ok(pv);
  assert.equal(pv.type, "pageview");
  assert.equal(pv.path, "/services/freins", "query string is never stored in the path");
  assert.equal(pv.utmSource, "fb");
  assert.equal(pv.utmCampaign, "fall");
  assert.equal(pv.referrerHost, "google.com");
  assert.equal(parseCollectPayload({ k: key, u: "https://garage.ca/a", r: "https://garage.ca/b" })?.referrerHost, null, "self-referrals dropped");
  assert.equal(parseCollectPayload({ k: key, t: "conversion", n: "Call_Click", u: "https://garage.ca/" })?.name, "call_click");
  for (const bad of [null, [], { k: "short", u: "https://a.ca/" }, { k: key, u: "javascript:alert(1)" }, { k: key, t: "event", n: "bad name!", u: "https://a.ca/" }]) {
    assert.equal(parseCollectPayload(bad), null);
  }
  pass("analytics payloads parse safely (no query strings, no self-referrals, strict names)");

  assert.ok(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)"));
  assert.ok(isBotUserAgent(null));
  assert.ok(!isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"));
  assert.equal(classifyDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile"), "mobile");
  assert.equal(classifyDevice("Mozilla/5.0 (iPad; CPU OS 17_0)"), "tablet");
  pass("bots are filtered and devices classified");

  assert.equal(normalizeSiteDomain("https://www.Garage-Verdun.ca/contact"), "garage-verdun.ca");
  assert.equal(normalizeSiteDomain("localhost"), null);
  assert.equal(normalizeSiteDomain("192.168.0.1"), null);
  assert.deepEqual(originsForDomain("garage.ca"), ["https://garage.ca", "https://www.garage.ca"]);
  assert.ok(originAllowed("https://www.garage.ca", originsForDomain("garage.ca")));
  assert.ok(!originAllowed("https://evil.ca", originsForDomain("garage.ca")));
  assert.ok(!originAllowed("http://garage.ca", originsForDomain("garage.ca")), "plain http origin is not allowed");
  assert.ok(!originAllowed(null, originsForDomain("garage.ca")));
  pass("sites accept data only from their own https origins");

  const rule = parseAudienceRule({ name: "Pricing viewers", pathPrefixes: "pricing, /booking", eventNames: "Form_Submit", lookbackDays: "60" });
  assert.ok(rule.ok && rule.value.pathPrefixes.join() === "/pricing,/booking" && rule.value.eventNames.join() === "form_submit");
  assert.equal(parseAudienceRule({ name: "x", pathPrefixes: "/" }).ok, false);
  assert.equal(parseAudienceRule({ name: "Empty" }).ok, false);
  assert.equal(parseAudienceRule({ name: "Too long", pathPrefixes: "/", lookbackDays: "9999" }).ok, false);
  pass("audience rules are validated");
}

function verifyReputationValidation(): void {
  assert.equal(parseReviewProfileInput({ name: "Garage" }).ok, false, "needs a review destination");
  assert.equal(parseReviewProfileInput({ name: "Garage", facebookReviewUrl: "https://evil.example/fb" }).ok, false);
  assert.equal(parseReviewProfileInput({ name: "Garage", facebookReviewUrl: "https://www.facebook.com/garage/reviews" }).ok, true);
  const noConsent = parsePublicRatingInput({ rating: "4", contactEmail: "a@b.ca" });
  assert.ok(noConsent.ok && noConsent.value.contactEmail === null && !noConsent.value.followUpConsent);
  const consent = parsePublicRatingInput({ rating: "4", contactPhone: "(514) 555-0123", followUpConsent: "on" });
  assert.ok(consent.ok && consent.value.contactPhone === "+5145550123" && consent.value.followUpConsent);
  for (const r of ["0", "6", "4.5", "", "abc"]) assert.equal(parsePublicRatingInput({ rating: r }).ok, false);
  pass("review inputs validated; contact kept only with consent");
}

verifyCatalog();
verifyHonestStatuses();
verifyAuditUrlGuard();
verifyAnalyticsParsing();
verifyReputationValidation();
console.log("\nGrowth Suite safeguards: all checks passed.");
