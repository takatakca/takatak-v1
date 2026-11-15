import { strict as assert } from "node:assert";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MetaCampaignBenchmarkPanel } from "../src/components/social/platforms/meta-campaign-benchmark-panel";
import { MetaAdCreativeReportPanel } from "../src/components/social/platforms/meta-ad-creative-report-panel";
import type { MetaCampaignBenchmarkInput } from "../src/lib/social/analytics/meta-campaign-benchmarks";

const campaigns: MetaCampaignBenchmarkInput[] = [
  { id: "a", name: "First", impressions: 1000, clicks: 10, spend: 20, ctr: 1, cpc: 2, cpm: 20 },
  { id: "b", name: "Second", impressions: 1100, clicks: 11, spend: 21, ctr: 1, cpc: 1.9, cpm: 19 },
  { id: "c", name: "Third", impressions: 1200, clicks: 12, spend: 22, ctr: 1, cpc: 1.8, cpm: 18 },
];

const fr = renderToStaticMarkup(createElement(MetaCampaignBenchmarkPanel, { campaigns, confirmed: true, currency: "CAD", locale: "fr" }));
assert(fr.includes("Comparaison interne des campagnes"), "French heading");
assert(fr.includes("Médiane CTR"), "French metric");
assert(!fr.includes("No recommendation or profitability"), "French body");

const en = renderToStaticMarkup(createElement(MetaCampaignBenchmarkPanel, { campaigns, confirmed: true, currency: "CAD", locale: "en" }));
assert(en.includes("Internal campaign comparison"), "English heading");
assert(en.includes("Median CTR"), "English metric");

const frReport = renderToStaticMarkup(createElement(MetaAdCreativeReportPanel, {
  start: "2026-11-01", end: "2026-11-10", locale: "fr",
}));
assert(frReport.includes("Analyser les publicités"), "French request button");
assert(frReport.includes("Exporter le CSV"), "French export button");

const enReport = renderToStaticMarkup(createElement(MetaAdCreativeReportPanel, {
  start: "2026-11-01", end: "2026-11-10", locale: "en",
}));
assert(enReport.includes("Analyze ad-level performance"), "English request button");
assert(enReport.includes("Export CSV"), "English export button");
console.log("PASS Creative Intelligence FR/EN render and report load/export affordances.");
