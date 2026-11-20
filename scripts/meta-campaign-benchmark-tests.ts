import { strict as assert } from "node:assert";

import {
  summarizeMetaCampaignBenchmarks,
  type MetaCampaignBenchmarkInput,
} from "../src/lib/social/analytics/meta-campaign-benchmarks";

function campaign(id: string, ctr: number | null, cpc: number | null, cpm: number | null): MetaCampaignBenchmarkInput {
  return { id, name: `Synthetic ${id}`, impressions: 1000, clicks: 20, spend: 20, ctr, cpc, cpm };
}

const sample = [campaign("a", 1, 3, 5), campaign("b", 2, 2, 6), campaign("c", 3, 1, 7)];

const notConfirmed = summarizeMetaCampaignBenchmarks(sample, false);
assert.equal(notConfirmed.kind, "unavailable", "partial Meta data must not produce comparisons");

const valid = summarizeMetaCampaignBenchmarks(sample, true);
assert.equal(valid.kind, "ready");
if (valid.kind === "ready") {
  assert.equal(valid.eligible, 3);
  assert.equal(valid.medians.ctr, 2);
  assert.equal(valid.medians.cpc, 2);
  assert.equal(valid.medians.cpm, 6);
}

const small = summarizeMetaCampaignBenchmarks(
  [campaign("one", 1, 2, 3), { ...campaign("two", 2, 3, 4), impressions: 999 }, campaign("three", 3, 4, 5)],
  true,
);
assert.equal(small.kind, "unavailable", "low-impression data is not eligible");

const missing = summarizeMetaCampaignBenchmarks(
  [campaign("a", 1, null, 5), campaign("b", 2, null, 6), campaign("c", 3, 1, 7)],
  true,
);
assert.equal(missing.kind, "ready");
if (missing.kind === "ready") {
  assert.equal(missing.medians.ctr, 2);
  assert.equal(missing.medians.cpc, null, "missing CPC may not be invented");
}

const invalid = summarizeMetaCampaignBenchmarks(
  [campaign("a", 1, 1, 1), campaign("b", -1, 2, 2), campaign("c", Number.POSITIVE_INFINITY, 3, 3)],
  true,
);
assert.equal(invalid.kind, "ready");
if (invalid.kind === "ready") assert.equal(invalid.medians.ctr, null, "nonfinite/negative results must be excluded");

const missingSpend = summarizeMetaCampaignBenchmarks(
  [{ ...campaign("a", 1, 1, 1), spend: null }, campaign("b", 2, 2, 2), campaign("c", 3, 3, 3)],
  true,
);
assert.equal(missingSpend.kind, "unavailable", "unknown spend is not a qualifying sample");

console.log("PASS Meta campaign comparisons: complete report, sample thresholds, medians and missing data.");
