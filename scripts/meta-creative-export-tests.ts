import { strict as assert } from "node:assert";
import { safeCsvCell, makeMetaCreativeCsv } from "../src/lib/social/analytics/meta-creative-export";
import type { MetaAdCreativeReportRow } from "../src/lib/social/analytics/meta-ad-creative-mapping";

for (const formula of ["=1+1", "+SUM(1)", "-CMD", "@hidden", "\t=2+2", "\r@x"]) {
  assert(safeCsvCell(formula).startsWith("\"'"), "CSV formula requires text escape");
}
assert.equal(safeCsvCell(0), '"0"', "numeric zero preserved");
assert.equal(safeCsvCell(-2), '"-2"', "true numeric negative stays numeric");
assert.equal(safeCsvCell('a"b'), '"a""b"');
const row: MetaAdCreativeReportRow = {
  adId: "12",
  adName: '=HYPERLINK("bad","click")',
  campaignId: null,
  campaignName: null,
  creativeId: "23",
  creativeName: "Example, video",
  creativeType: null,
  creativeTitle: "=malicious",
  creativeBody: "Creative text",
  creativeVideoId: "777",
  creativeCallToAction: "SHOP_NOW",
  creativeThumbnailUrl: "https://scontent.xx.fbcdn.net/signed.jpg?oh=secretlink",
  status: "ACTIVE",
  impressions: 0,
  clicks: null,
  spend: 12,
  ctr: null,
  cpc: null,
  cpm: null,
};
const csv = makeMetaCreativeCsv({ rows: [row], currency: "CAD", start: "2026-11-01", end: "2026-11-10", status: "partial" });
assert(csv.includes(String.fromCharCode(34, 39) + "=HYPERLINK("), "unsafe ad name escaped");
assert(csv.includes('"Example, video"'), "commas quoted");
assert(csv.includes('"partial"'), "incomplete evidence visible");
assert(csv.includes('"0"'), "zero does not become blank");
assert(csv.includes('"\u0027=malicious"'), "creative text formula neutralized");
assert(csv.includes('"Creative text"'), "creative copy exported");
assert(csv.includes('"SHOP_NOW"'), "CTA exported");
assert(!csv.includes("signed.jpg"), "signed ephemeral thumbnail URL not exported");
assert(csv.endsWith("\r\n"));
console.log("PASS Meta ad creative export: formula protection, CSV quoting, missing values and completeness.");
