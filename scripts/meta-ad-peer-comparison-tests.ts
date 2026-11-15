import { strict as assert } from "node:assert";
import { compareMetaAdsWithinCampaign } from "../src/lib/social/analytics/meta-ad-peer-comparisons";
import type { MetaAdCreativeReportRow } from "../src/lib/social/analytics/meta-ad-creative-mapping";

function ad(id: string, campaignId: string, ctr: number | null, cpc: number | null, cpm: number | null): MetaAdCreativeReportRow {
  return {
    adId: id,
    adName: `Synthetic ${id}`,
    campaignId,
    campaignName: `Campaign ${campaignId}`,
    creativeId: id,
    creativeName: null,
    creativeType: "VIDEO",
    status: "ACTIVE",
    impressions: 1_250,
    clicks: 50,
    spend: 30,
    ctr,
    cpc,
    cpm,
  };
}

const reports = [
  ad("101", "9", 1, 3, 8),
  ad("102", "9", 2, 2, 7),
  ad("103", "9", 3, 1, 6),
  ad("201", "8", 99, 1, 1),
  ad("202", "8", 99, 1, 1),
];
const result = compareMetaAdsWithinCampaign(reports, true);
assert.equal(result.length, 1, "must never mix separate campaigns to reach minimum sample");
assert.equal(result[0].campaignId, "9");
assert.equal(result[0].sampleSize, 3);
assert.deepEqual(result[0].medians, { ctr: 2, cpc: 2, cpm: 7 });
assert.deepEqual(compareMetaAdsWithinCampaign(reports, false), [], "partial reports must not produce peer benchmarks");

const missingMetrics = compareMetaAdsWithinCampaign([
  ad("101", "9", null, 1, 5), ad("102", "9", null, 2, 6), ad("103", "9", 1, 3, 7),
], true);
assert.equal(missingMetrics.length, 1);
assert.equal(missingMetrics[0].medians.ctr, null, "two missing CTR values cannot be invented");
assert.equal(missingMetrics[0].medians.cpc, 2);

const duplicates = compareMetaAdsWithinCampaign([
  ad("101", "9", 1, 1, 1), ad("101", "9", 1, 1, 1), ad("102", "9", 2, 2, 2),
], true);
assert.equal(duplicates.length, 0, "repeat ad IDs cannot increase sample size");

const excluded = compareMetaAdsWithinCampaign([
  { ...ad("101", "9", 1, 1, 1), impressions: 999 },
  { ...ad("102", "9", 2, 2, 2), spend: null },
  { ...ad("103", "9", 3, 3, 3), spend: -10 },
  ad("104", "9", 4, 4, 4),
], true);
assert.equal(excluded.length, 0, "low-volume or missing spend ads are excluded");

const badId = compareMetaAdsWithinCampaign([
  ad("foo", "9", 1, 1, 1), ad("102", "9", 2, 2, 2), ad("103", "9", 3, 3, 3),
], true);
assert.equal(badId.length, 0, "invalid identity cannot be used for sample");

console.log("PASS same-campaign Meta ad peer statistics, missing metrics, tenant-agnostic isolation and thresholds.");
