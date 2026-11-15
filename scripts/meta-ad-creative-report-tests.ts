import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

import { hasCompleteMetaAdMetadata, mergeMetaAdInsightsWithCreatives } from "../src/lib/social/analytics/meta-ad-creative-mapping";

const insights = [
  { ad_id: "100", ad_name: "Ad one", campaign_id: "400", campaign_name: "Campaign A", impressions: "10000", clicks: "125", spend: "48.50", ctr: "1.25", cpc: "0.388", cpm: "4.85" },
  { ad_id: "200", ad_name: "Ad two", spend: "3.21", impressions: "", clicks: null, cpc: null },
  { ad_id: "300", ad_name: "Ad three", spend: "6.00", impressions: "100" },
];
const ads = [
  { id: "100", creative: { id: "900", name: "Static image", object_type: "SHARE" }, effective_status: "ACTIVE" },
  { id: "200", creative: { id: "901", name: "Video offer" }, effective_status: "PAUSED" },
];
const result = mergeMetaAdInsightsWithCreatives(insights, ads);
assert.equal(result.length, 3);
assert.equal(hasCompleteMetaAdMetadata(insights, ads), false, "missing archived ad metadata must mark report partial");
assert.equal(hasCompleteMetaAdMetadata(insights.slice(0, 2), ads), true, "all joined ads can be complete");
assert.equal(result[0].creativeId, "900");
assert.equal(result[0].spend, 48.5);
assert.equal(result[0].ctr, 1.25);
assert.equal(result[0].creativeType, "SHARE");
assert.equal(result[1].creativeId, null, "missing asset must not be fabricated");
assert.equal(result[2].impressions, null, "missing impressions must stay null");
assert.equal(result[2].clicks, null, "missing clicks must stay null");

const malicious = mergeMetaAdInsightsWithCreatives(
  [{ ad_id: "1", ad_name: "Bad\u0000Name", spend: "-1", clicks: "NaN", ctr: "Infinity" }, { ad_id: "1", spend: "500" }, { ad_id: "xx", spend: "100" }],
  [{ id: "1", creative: { id: "bad/other-id", name: "test" }, effective_status: "<script>" }],
);
assert.equal(malicious.length, 1, "invalid IDs and repeated ad rows dropped");
assert.equal(malicious[0].spend, null);
assert.equal(malicious[0].clicks, null);
assert.equal(malicious[0].ctr, null);
assert.equal(malicious[0].creativeId, null);
assert.equal(malicious[0].adName, "BadName");
assert.equal(malicious[0].status, null);

const route = readFileSync("src/app/api/social/meta-ads/creatives/route.ts", "utf8");
assert(route.includes('requireWorkspaceApiPermission("view_social")'));
assert(route.includes("resolveBrandSessionContextFromRequest"));
assert(route.includes("resolveCanonicalMetaAdsDashboard"));
assert(route.includes('TAKATAK_CREATIVE_INTELLIGENCE_ENABLED !== "true"'), "ad report route must be disabled by default");
const adsUi = readFileSync("src/components/social/platforms/meta-ads-subscribed-dashboard.tsx", "utf8");
assert(adsUi.includes('NEXT_PUBLIC_TAKATAK_CREATIVE_INTELLIGENCE_ENABLED === "true"'), "dashboard beta must be feature-gated");
const envExample = readFileSync(".env.example", "utf8");
assert(envExample.includes("TAKATAK_CREATIVE_INTELLIGENCE_ENABLED=false"), "backend flag disabled by default");
assert(envExample.includes("NEXT_PUBLIC_TAKATAK_CREATIVE_INTELLIGENCE_ENABLED=false"), "frontend flag disabled by default");
assert(!route.includes("request.nextUrl.searchParams.get(\"clientId\")"));
assert(!route.includes("lastRequestByAccount.clear()"), "throttle must never reset active cooldowns");
assert(/^\s*if \(lastRequestByAccount\.size >= 500\) return false;/m.test(route), "throttle must execute on an actual code line");
assert(!route.includes("burst.\\n    if ("), "throttle must never be hidden inside a comment");
const source = readFileSync("src/lib/social/providers/meta-ads-insights.ts", "utf8");
assert(source.includes("fetchMetaAdsCreativeReport"));
assert(source.includes("MAX_CREATIVE_REPORT_PAGES"));
assert(source.includes("MAX_CREATIVE_REPORT_ROWS"));
assert(source.includes("loadAccessToken"));
console.log("PASS Meta Ads creative ad-level report mapper, missing-data and tenant-gate contracts.");
