import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ADS_PLAN_CATALOG,
  adsPlanHasFeature,
} from "../src/lib/ads/plan-catalog";
import {
  resolveAdsSubscriptionAccess,
  resolveEffectiveAdsPlan,
} from "../src/lib/ads/subscription-policy";
import {
  matchesAdsTargeting,
  parseAdsTargetingRules,
} from "../src/lib/ads/targeting";
import { ADS_PLAN_CODES } from "../src/lib/ads/types";

function pass(label: string): void {
  console.log(`PASS  ${label}`);
}

function verifyCatalog(): void {
  assert.deepEqual(
    Object.keys(ADS_PLAN_CATALOG).sort(),
    [...ADS_PLAN_CODES].sort(),
  );
  pass("catalog covers every ADS plan code");

  assert.equal(
    ADS_PLAN_CATALOG.ads_unsubscribed.features.length,
    0,
  );
  pass("unsubscribed grants zero ADS features");

  assert.equal(
    adsPlanHasFeature("ads_direct", "single_site_campaigns"),
    true,
  );
  assert.equal(
    adsPlanHasFeature("ads_direct", "network_campaigns"),
    false,
  );
  pass("ADS Direct is limited to single-site campaigns");

  assert.equal(
    adsPlanHasFeature("ads_local_network", "qmaps_targeting"),
    true,
  );
  assert.equal(
    adsPlanHasFeature("ads_local_network", "max_lead_pro"),
    false,
  );
  pass("Local Network unlocks QMAPS targeting without Max Lead Pro");

  for (const feature of [
    "max_lead_pro",
    "qmaps_targeting",
    "flex_attribution",
    "local_lab_creatives",
  ] as const) {
    assert.equal(
      adsPlanHasFeature("ads_max_lead_pro", feature),
      true,
    );
  }
  pass("Max Lead Pro unlocks the local optimization stack");
}

function verifyLifecycle(): void {
  assert.equal(
    resolveAdsSubscriptionAccess({ status: "active" }),
    "paid",
  );
  assert.equal(
    resolveAdsSubscriptionAccess({ status: "past_due" }),
    "paid",
  );
  assert.equal(
    resolveAdsSubscriptionAccess({ status: "paused" }),
    "blocked",
  );
  assert.equal(
    resolveEffectiveAdsPlan({
      status: "active",
      planCode: "unknown_plan",
    }),
    "ads_unsubscribed",
  );
  assert.equal(
    resolveAdsSubscriptionAccess({
      status: "canceled",
      currentPeriodEnd: "2030-01-01T00:00:00.000Z",
      now: new Date("2029-12-01T00:00:00.000Z"),
    }),
    "paid",
  );
  pass("ADS subscription lifecycle fails closed and preserves paid-through access");
}

function verifyTargeting(): void {
  const rules = parseAdsTargetingRules({
    countries: ["Canada"],
    regions: ["Quebec"],
    cities: ["Verdun"],
    postalPrefixes: ["H4G"],
    categories: ["hockey"],
    locales: ["fr"],
    devices: ["mobile"],
  });

  assert.equal(
    matchesAdsTargeting(rules, {
      country: "canada",
      region: "QUEBEC",
      city: "Verdun",
      postalPrefix: "H4G 1A1",
      category: "Hockey",
      locale: "FR",
      device: "mobile",
    }),
    true,
  );

  assert.equal(
    matchesAdsTargeting(rules, {
      country: "Canada",
      region: "Quebec",
      city: "Laval",
      postalPrefix: "H7A",
      category: "hockey",
      locale: "fr",
      device: "mobile",
    }),
    false,
  );
  pass("local/contextual targeting is normalized and deterministic");
}

function verifyPrivacyAndRoutes(): void {
  const root = process.cwd();
  const schema = fs.readFileSync(
    path.join(root, "prisma", "schema.prisma"),
    "utf8",
  );
  const eventModel =
    schema.split("model AdEvent {")[1]?.split("\n}")[0] ?? "";

  assert.ok(eventModel);
  for (const forbidden of [
    "ipAddress",
    "userAgent",
    "email",
    "phone",
    "fingerprint",
  ]) {
    assert.equal(eventModel.includes(forbidden), false);
  }

  assert.equal(
    fs.existsSync(
      path.join(root, "src", "app", "api", "ads", "serve", "route.ts"),
    ),
    true,
  );
  assert.equal(
    fs.existsSync(
      path.join(root, "src", "app", "api", "ads", "events", "route.ts"),
    ),
    true,
  );
  assert.equal(
    fs.existsSync(
      path.join(root, "src", "app", "api", "ads", "click", "route.ts"),
    ),
    true,
  );
  assert.equal(
    fs.existsSync(
      path.join(
        root,
        "src",
        "app",
        "api",
        "integrations",
        "ads",
        "flexs",
        "events",
        "route.ts",
      ),
    ),
    true,
  );

  const publicEventsRoute = fs.readFileSync(
    path.join(root, "src", "app", "api", "ads", "events", "route.ts"),
    "utf8",
  );
  assert.ok(publicEventsRoute.includes('body.eventType === "impression"'));
  assert.ok(publicEventsRoute.includes('body.eventType === "click"'));
  assert.equal(publicEventsRoute.includes('body.eventType === "lead"'), false);
  assert.equal(publicEventsRoute.includes('body.eventType === "conversion"'), false);

  const flexsRoute = fs.readFileSync(
    path.join(
      root,
      "src",
      "app",
      "api",
      "integrations",
      "ads",
      "flexs",
      "events",
      "route.ts",
    ),
    "utf8",
  );
  assert.equal(/raw\.(email|phone|name|address)/.test(flexsRoute), false);

  pass("public ADS event ledger avoids direct personal identifiers");
  pass("serve, signed click and FLEXS attribution APIs exist");
  pass("browser event API cannot submit lead or conversion events");
}


function verifyAhmvPublisherSeed(): void {
  const root = process.cwd();
  const seed = fs.readFileSync(
    path.join(root, "scripts", "seed-ahmv-ads-publisher.ts"),
    "utf8",
  );

  assert.ok(seed.includes('domain: "ahmverdun.ca"'));
  assert.equal(seed.includes('domain: "ahmverdun.com"'), false);
  assert.ok(seed.includes('"https://ahmverdun.ca"'));
  assert.ok(seed.includes('"https://www.ahmverdun.ca"'));
  assert.ok(seed.includes('"https://ahmverdun.com"'));
  assert.ok(seed.includes('"https://www.ahmverdun.com"'));

  pass("AHMV ADS publisher seed uses .ca canonical domain with legacy .com origins");
}

console.log("TAKATAK ADS foundation verification");
console.log("===================================");
verifyCatalog();
verifyLifecycle();
verifyTargeting();
verifyPrivacyAndRoutes();
verifyAhmvPublisherSeed();
console.log("===================================");
console.log("PASS  TAKATAK ADS foundation verified");
