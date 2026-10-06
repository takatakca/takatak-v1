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
import { latestDueSlot, parseScheduleInput } from "../src/lib/ai-agents/schedule";
import { decideCreditGrant } from "../src/lib/billing/ai-credits/policy";
import { billablePlan, creditsForInvoice, decidePlanCheckout, normalizeStripeStatus, planUnlocks } from "../src/lib/billing/growth/policy";
import { growthSmsConfigured, growthWhatsAppConfigured } from "../src/lib/messaging/delivery";
import { maskPhone, toE164 } from "../src/lib/messaging/phone";
import { parsePublicRatingInput, parseReviewProfileInput } from "../src/lib/reputation/validation";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { buildServiceAccountAssertion, normalizePrivateKey } from "../src/lib/integrations/google/jwt";
import {
  hostMatchesSiteDomain,
  isValidGa4PropertyId,
  normalizeSearchConsoleProperty,
  parseGa4DailyReport,
  parseGa4WebStreamHosts,
  parseSearchConsoleQueries,
  searchConsolePropertyMatchesDomain,
} from "../src/lib/integrations/google/parse";
import { htmlHasVerificationMeta, txtRecordsHaveVerification, verificationMetaTag, verificationTxtValue } from "../src/lib/analytics/verification";
import { buildHighlights, monthRange, percentChange, previousMonth } from "../src/lib/growth/report";
import { connectionAad, decryptGrowthValue, encryptGrowthValue, pkceChallenge } from "../src/lib/integrations/google-business/crypto";
import { parseAccounts, parseLocations, parseReviewsPage } from "../src/lib/integrations/google-business/parse";
import { gradeMetric, parsePageSpeed } from "../src/lib/seo/pagespeed-parse";
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

function verifyCreditPurchasePolicy(): void {
  const clientId = "11111111-2222-4333-8444-555555555555";
  const good = {
    id: "cs_test_1",
    mode: "payment",
    payment_status: "paid",
    currency: "cad",
    amount_total: 5900,
    client_reference_id: clientId,
    metadata: { billingDomain: "ai_credits", clientId, packKey: "growth", credits: "500" },
  };
  assert.deepEqual(decideCreditGrant(good), { grant: true, clientId, credits: 500, packKey: "growth", idempotencyKey: "stripe:cs_test_1" });
  const cases: Array<[string, Record<string, unknown>]> = [
    ["not_paid", { payment_status: "unpaid" }],
    ["amount_mismatch", { amount_total: 100 }],
    ["currency_mismatch", { currency: "usd" }],
    ["client_mismatch", { client_reference_id: "99999999-2222-4333-8444-555555555555" }],
    ["not_one_time_payment", { mode: "subscription" }],
  ];
  for (const [reason, patch] of cases) assert.deepEqual(decideCreditGrant({ ...good, ...patch }), { grant: false, reason });
  assert.deepEqual(decideCreditGrant({ ...good, metadata: { ...good.metadata, credits: "5000" } }), { grant: false, reason: "credits_mismatch" });
  assert.deepEqual(decideCreditGrant({ ...good, metadata: { ...good.metadata, packKey: "free" } }), { grant: false, reason: "unknown_pack" });
  assert.deepEqual(decideCreditGrant({ ...good, metadata: { ...good.metadata, billingDomain: "hockey" } }), { grant: false, reason: "not_ai_credits" });
  pass("card purchases grant credits only when amount, currency, pack and client all match");
}

function verifyMessagingGates(): void {
  assert.equal(toE164("(514) 555-0123"), "+15145550123");
  assert.equal(toE164("+33 6 12 34 56 78"), "+33612345678");
  assert.equal(toE164("555-0123"), null);
  assert.equal(maskPhone("+15145550123"), "•••0123");
  const saved = { ...process.env };
  try {
    process.env.TWILIO_ACCOUNT_SID = "ACxxxxxxxx";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_MESSAGING_SERVICE_SID = "MGxxxx";
    delete process.env.GROWTH_SMS_ENABLED;
    assert.equal(growthSmsConfigured(), false, "SMS stays off without the explicit flag");
    process.env.GROWTH_SMS_ENABLED = "true";
    assert.equal(growthSmsConfigured(), true);
    Object.assign(process.env, { GROWTH_WHATSAPP_ENABLED: "true", WHATSAPP_PHONE_NUMBER_ID: "1", WHATSAPP_ACCESS_TOKEN: "t", WHATSAPP_REVIEW_TEMPLATE: "review" });
    delete process.env.WHATSAPP_GRAPH_VERSION;
    assert.equal(growthWhatsAppConfigured(), false, "WhatsApp needs an explicit Graph API version");
    process.env.WHATSAPP_GRAPH_VERSION = "latest";
    assert.equal(growthWhatsAppConfigured(), false, "version is never guessed");
  } finally {
    process.env = saved;
  }
  pass("messaging channels stay off until flagged and fully configured; phones normalize and mask");
}

function verifyAgentSchedules(): void {
  const tz = "America/Toronto";
  // Monday 2026-10-05 15:20 UTC = 11:20 EDT.
  const now = new Date("2026-10-05T15:20:00Z");
  assert.equal(latestDueSlot(now, { schedule: "daily", weekday: null, hour: 9 }, tz)?.toISOString(), "2026-10-05T13:00:00.000Z", "09:00 EDT today");
  assert.equal(latestDueSlot(now, { schedule: "daily", weekday: null, hour: 14 }, tz)?.toISOString(), "2026-10-04T18:00:00.000Z", "14:00 not reached → yesterday");
  assert.equal(latestDueSlot(now, { schedule: "weekly", weekday: 1, hour: 8 }, tz)?.toISOString(), "2026-10-05T12:00:00.000Z", "Monday 08:00 EDT");
  assert.equal(latestDueSlot(now, { schedule: "weekly", weekday: 5, hour: 8 }, tz)?.toISOString(), "2026-10-02T12:00:00.000Z", "last Friday");
  // After the November DST switch, 09:00 local is 14:00 UTC (EST).
  assert.equal(
    latestDueSlot(new Date("2026-11-03T15:00:00Z"), { schedule: "daily", weekday: null, hour: 9 }, tz)?.toISOString(),
    "2026-11-03T14:00:00.000Z",
    "DST-aware",
  );
  assert.equal(
    latestDueSlot(now, { schedule: "daily", weekday: null, hour: 9 }, "Europe/Paris")?.toISOString(),
    "2026-10-05T07:00:00.000Z",
    "client time zone respected",
  );
  assert.equal(latestDueSlot(now, { schedule: "off", weekday: null, hour: 9 }, tz), null);
  assert.equal(latestDueSlot(now, { schedule: "weekly", weekday: null, hour: 9 }, tz), null);
  assert.deepEqual(parseScheduleInput({ schedule: "weekly", weekday: "9", hour: "99" }), { schedule: "weekly", weekday: 1, hour: 9 });
  assert.deepEqual(parseScheduleInput({ schedule: "hourly" }), { schedule: "off", weekday: null, hour: 9 });
  pass("autopilot schedules are time-zone and DST aware");
}

function verifyPageSpeedAndShowcase(): void {
  const fixture = {
    lighthouseResult: {
      categories: { performance: { score: 0.87 } },
      audits: {
        "largest-contentful-paint": { numericValue: 2400 },
        "cumulative-layout-shift": { numericValue: 0.18 },
        "total-blocking-time": { numericValue: 750 },
        "first-contentful-paint": { numericValue: 1200 },
        "speed-index": { numericValue: 3100 },
      },
    },
    loadingExperience: { overall_category: "AVERAGE" },
  };
  const report = parsePageSpeed(fixture, "mobile", "https://takatak.ca/");
  assert.ok(report);
  assert.equal(report.score, 87);
  assert.deepEqual(
    report.metrics.map((m) => [m.key, m.display, m.grade]),
    [
      ["lcp", "2.4 s", "good"],
      ["cls", "0.18", "needs_improvement"],
      ["tbt", "750 ms", "poor"],
      ["fcp", "1.2 s", "good"],
      ["si", "3.1 s", "good"],
    ],
  );
  assert.equal(report.fieldCategory, "AVERAGE");
  assert.equal(parsePageSpeed({ error: { code: 429 } }, "mobile", "x"), null);
  assert.equal(gradeMetric("lcp", 4000), "needs_improvement");
  assert.equal(gradeMetric("lcp", 4001), "poor");
  pass("PageSpeed responses parse and Web Vitals grade on Google's thresholds");

  const withText = parsePublicRatingInput({ rating: "5", feedback: "Super service", publishConsent: "on" });
  assert.ok(withText.ok && withText.value.publishConsent);
  const noText = parsePublicRatingInput({ rating: "5", publishConsent: "on" });
  assert.ok(noText.ok && !noText.value.publishConsent, "nothing to publish without a comment");
  const noOptIn = parsePublicRatingInput({ rating: "5", feedback: "Super" });
  assert.ok(noOptIn.ok && !noOptIn.value.publishConsent, "publishing is opt-in");
  pass("showcase publishing requires an explicit opt-in and a comment");
}

function verifyGoogleAndReport(): void {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const jwt = buildServiceAccountAssertion({ clientEmail: "sa@proj.iam.gserviceaccount.com", privateKeyPem: pem.replace(/\n/g, "\\n"), scopes: ["a", "b"], nowSeconds: 1_700_000_000 });
  const [h, c, sig] = jwt.split(".");
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${h}.${c}`);
  assert.ok(verifier.verify(publicKey, Buffer.from(sig, "base64url")), "assertion is RS256-signed with the service-account key");
  assert.deepEqual(JSON.parse(Buffer.from(c, "base64url").toString()), {
    iss: "sa@proj.iam.gserviceaccount.com",
    scope: "a b",
    aud: "https://oauth2.googleapis.com/token",
    iat: 1_700_000_000,
    exp: 1_700_003_600,
  });
  assert.equal(normalizePrivateKey("a\\nb"), "a\nb");
  pass("Google service-account assertion is correctly signed (escaped PEM accepted)");

  const ga4 = parseGa4DailyReport({
    rows: [
      { dimensionValues: [{ value: "20261002" }], metricValues: [{ value: "12" }, { value: "10" }, { value: "40" }] },
      { dimensionValues: [{ value: "20261001" }], metricValues: [{ value: "8" }, { value: "7" }, { value: "21" }] },
      { dimensionValues: [{ value: "(other)" }], metricValues: [{ value: "999" }] },
    ],
  });
  assert.deepEqual(ga4?.totals, { sessions: 20, users: 17, pageViews: 61 });
  assert.equal(ga4?.daily[0].date, "2026-10-01", "sorted by date");
  assert.deepEqual(parseGa4DailyReport({}), { totals: { sessions: 0, users: 0, pageViews: 0 }, daily: [] });
  const sc = parseSearchConsoleQueries({ rows: [{ keys: ["garage verdun"], clicks: 31, impressions: 400, ctr: 0.0775, position: 3.456 }] });
  assert.deepEqual(sc, [{ query: "garage verdun", clicks: 31, impressions: 400, ctr: 0.0775, position: 3.5 }]);
  assert.ok(isValidGa4PropertyId("123456789") && !isValidGa4PropertyId("G-ABC123"));
  assert.equal(normalizeSearchConsoleProperty("sc-domain:Garage.CA"), "sc-domain:garage.ca");
  assert.equal(normalizeSearchConsoleProperty("https://www.garage.ca"), "https://www.garage.ca/");
  assert.equal(normalizeSearchConsoleProperty("http://garage.ca/"), null);
  assert.ok(searchConsolePropertyMatchesDomain("sc-domain:Garage.ca", "garage.ca"));
  assert.ok(searchConsolePropertyMatchesDomain("https://www.garage.ca/fr/", "garage.ca"));
  assert.ok(!searchConsolePropertyMatchesDomain("sc-domain:victim.ca", "garage.ca"), "another domain");
  assert.ok(!searchConsolePropertyMatchesDomain("sc-domain:ca", "garage.ca"), "a parent domain");
  assert.ok(!searchConsolePropertyMatchesDomain("https://garage.ca.victim.ca/", "garage.ca"), "suffix trick");
  assert.ok(!searchConsolePropertyMatchesDomain("https://shop.garage.ca/", "garage.ca"), "other subdomain");
  assert.ok(!searchConsolePropertyMatchesDomain("https://garage.ca:8443/", "garage.ca"), "non-default port");
  assert.ok(hostMatchesSiteDomain("WWW.garage.ca.", "garage.ca") && !hostMatchesSiteDomain("wwwgarage.ca", "garage.ca"));
  assert.deepEqual(
    parseGa4WebStreamHosts({ dataStreams: [{ type: "WEB_DATA_STREAM", webStreamData: { defaultUri: "https://www.garage.ca" } }, { type: "ANDROID_APP_DATA_STREAM" }, { webStreamData: { defaultUri: "garage.ca/fr" } }] }),
    ["www.garage.ca", "garage.ca"],
  );
  assert.equal(parseGa4WebStreamHosts(null), null);
  const vToken = "0123456789abcdef0123456789abcdef";
  assert.ok(txtRecordsHaveVerification([["v=spf1 -all"], [verificationTxtValue(vToken)]], vToken));
  assert.ok(!txtRecordsHaveVerification([[verificationTxtValue(vToken)]], "not-a-token"));
  assert.ok(!txtRecordsHaveVerification([[`${verificationTxtValue(vToken)}x`]], vToken));
  assert.ok(htmlHasVerificationMeta(`<html><head><title>x</title><META content='${vToken}' NAME="takatak-site-verification"></head><body></body></html>`, vToken));
  assert.ok(!htmlHasVerificationMeta(`<html><head></head><body>${verificationMetaTag(vToken)}</body></html>`, vToken), "body content does not verify");
  assert.ok(!htmlHasVerificationMeta(`<html><head><!-- ${verificationMetaTag(vToken)} --></head></html>`, vToken), "comments do not verify");
  assert.ok(!htmlHasVerificationMeta(`<html><head>${verificationMetaTag("ffffffffffffffffffffffffffffffff")}</head></html>`, vToken), "another token");
  pass("GA4 and Search Console responses parse; property identifiers are validated");

  const oct = monthRange("2026-10");
  assert.equal(oct.start.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(oct.end.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(previousMonth(monthRange("2026-01")).key, "2025-12", "year rollover");
  assert.equal(monthRange("garbage", new Date("2026-03-15T00:00:00Z")).key, "2026-03");
  assert.equal(percentChange(150, 100), 50);
  assert.equal(percentChange(5, 0), null);
  assert.equal(percentChange(0, 0), 0);
  const zero = { pageviews: 0, visits: 0, conversions: 0, ratings: 0, averageRating: null, publicReviewClicks: 0, requestsSent: 0, conversations: 0, leads: 0, aiRunsCompleted: 0, creditsUsed: 0, adImpressions: 0, adClicks: 0 };
  assert.deepEqual(buildHighlights(zero, zero), ["Aucune activité enregistrée ce mois-ci."]);
  assert.ok(buildHighlights({ ...zero, visits: 150 }, { ...zero, visits: 100 })[0].includes("en hausse de 50 %"));
  pass("monthly report ranges, deltas and highlights are correct");
}

function verifyGoogleBusinessPure(): void {
  // RFC 7636 Appendix B test vector.
  assert.equal(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  const saved = process.env.GROWTH_TOKEN_ENCRYPTION_KEY_V1;
  try {
    process.env.GROWTH_TOKEN_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 7).toString("base64");
    const aad = connectionAad("client-1", "conn-1");
    const enc = encryptGrowthValue("1//refresh-token-secret", aad);
    assert.ok(!enc.ciphertext.includes("refresh"), "ciphertext hides the token");
    assert.equal(decryptGrowthValue(enc, aad), "1//refresh-token-secret");
    assert.throws(() => decryptGrowthValue(enc, connectionAad("client-2", "conn-1")), "a token copied to another client cannot be decrypted");
    assert.throws(() => decryptGrowthValue({ ...enc, ciphertext: Buffer.from("tampered").toString("base64") }, aad), "tampering is detected");
    process.env.GROWTH_TOKEN_ENCRYPTION_KEY_V1 = "short";
    assert.throws(() => encryptGrowthValue("x", aad), "a weak key is refused");
  } finally {
    if (saved === undefined) delete process.env.GROWTH_TOKEN_ENCRYPTION_KEY_V1;
    else process.env.GROWTH_TOKEN_ENCRYPTION_KEY_V1 = saved;
  }
  pass("Google tokens are AES-256-GCM encrypted, bound to client+connection; PKCE matches RFC 7636");

  assert.deepEqual(parseAccounts({ accounts: [{ name: "accounts/123", accountName: "Garage" }, { name: "evil" }] }), [{ name: "accounts/123", accountName: "Garage" }]);
  assert.deepEqual(
    parseLocations({ locations: [{ name: "locations/987", title: "Garage Verdun", storefrontAddress: { addressLines: ["123 rue Wellington"], locality: "Verdun", postalCode: "H4G 1V5" } }, { name: "bad" }] }, "accounts/123"),
    [{ resourceName: "accounts/123/locations/987", title: "Garage Verdun", address: "123 rue Wellington, Verdun, H4G 1V5" }],
  );
  const page = parseReviewsPage({
    reviews: [
      { reviewId: "r1", reviewer: { displayName: "Marc" }, starRating: "TWO", comment: "Trop long", createTime: "2026-10-01T10:00:00Z", updateTime: "2026-10-01T10:00:00Z" },
      { reviewId: "r2", starRating: "FIVE", createTime: "2026-10-02T10:00:00Z", reviewReply: { comment: "Merci!", updateTime: "2026-10-03T10:00:00Z" } },
      { reviewId: "r3", starRating: "STAR_RATING_UNSPECIFIED", createTime: "2026-10-02T10:00:00Z" },
    ],
    nextPageToken: "next",
  });
  assert.deepEqual(page.reviews.map((r) => [r.externalId, r.rating, r.reviewerName, r.replyComment]), [["r1", 2, "Marc", null], ["r2", 5, null, "Merci!"]]);
  assert.equal(page.nextPageToken, "next");
  pass("Google Business Profile accounts, locations and reviews parse (unrated reviews skipped)");
}

function verifyGrowthBillingPolicy(): void {
  const clientId = "11111111-2222-4333-8444-555555555555";
  const good = {
    id: "cs_1",
    mode: "subscription",
    status: "complete",
    client_reference_id: clientId,
    customer: "cus_1",
    subscription: "sub_1",
    metadata: { billingDomain: "growth_plan", clientId, planKey: "reputation" },
  };
  assert.deepEqual(decidePlanCheckout(good), { record: true, clientId, planKey: "reputation", customerId: "cus_1", subscriptionId: "sub_1" });
  assert.deepEqual(decidePlanCheckout({ ...good, mode: "payment" }), { record: false, reason: "not_subscription" });
  assert.deepEqual(decidePlanCheckout({ ...good, status: "open" }), { record: false, reason: "not_complete" });
  assert.deepEqual(decidePlanCheckout({ ...good, client_reference_id: "x" }), { record: false, reason: "client_mismatch" });
  assert.deepEqual(decidePlanCheckout({ ...good, metadata: { ...good.metadata, planKey: "free_everything" } }), { record: false, reason: "unknown_plan" });
  assert.deepEqual(decidePlanCheckout({ ...good, metadata: { ...good.metadata, billingDomain: "ai_credits" } }), { record: false, reason: "not_growth_plan" });
  assert.equal(normalizeStripeStatus("incomplete_expired"), "canceled");
  assert.equal(normalizeStripeStatus("weird"), "incomplete");
  assert.ok(planUnlocks(["takatak_one"], "ads_manager"), "bundle unlocks everything");
  assert.ok(planUnlocks(["reputation"], "reputation") && !planUnlocks(["reputation"], "conversations"));
  assert.equal(creditsForInvoice("ai_autopilot", "subscription_cycle"), 500);
  assert.equal(creditsForInvoice("takatak_one", "subscription_create"), 1000);
  assert.equal(creditsForInvoice("ai_autopilot", "manual"), 0, "only subscription invoices include credits");
  assert.equal(creditsForInvoice("reputation", "subscription_cycle"), 0);
  assert.equal(billablePlan("takatak_one")?.monthlyCad, 299);
  pass("plan checkout, status mapping, bundle unlocks and included credits follow the catalog");
}

verifyCatalog();
verifyHonestStatuses();
verifyGrowthBillingPolicy();
verifyGoogleBusinessPure();
verifyGoogleAndReport();
verifyPageSpeedAndShowcase();
verifyAgentSchedules();
verifyCreditPurchasePolicy();
verifyMessagingGates();
verifyAuditUrlGuard();
verifyAnalyticsParsing();
verifyReputationValidation();
console.log("\nGrowth Suite safeguards: all checks passed.");
