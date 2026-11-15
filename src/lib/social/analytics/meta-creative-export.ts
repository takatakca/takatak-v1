import type { MetaAdCreativeReportRow } from "@/lib/social/analytics/meta-ad-creative-mapping";

/** Neutralize formulas in spreadsheet programs, including tab/newline-prefixed payloads. */
export function safeCsvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  const cleaned = raw.replace(/\u0000/g, "");
  const neutralized = /^[\s\uFEFF]*[=+@-]/u.test(cleaned) && typeof value !== "number"
    ? "'" + cleaned
    : cleaned;
  return '"' + neutralized.replace(/"/g, '""') + '"';
}

/** Exports only rows returned to the signed-in user, never generates extra provider calls. */
export function makeMetaCreativeCsv(options: {
  rows: readonly MetaAdCreativeReportRow[];
  currency: string | null;
  start: string;
  end: string;
  status: "ready" | "partial" | "unavailable";
}): string {
  const headers = [
    "Ad ID", "Ad name", "Campaign ID", "Campaign name",
    "Creative ID", "Creative name", "Creative type", "Status",
    "Impressions", "Clicks", "Spend", "CTR (%)", "CPC", "CPM",
    "Currency", "Period start", "Period end", "Report completeness",
  ];
  const values = options.rows.map((row) => [
    row.adId, row.adName, row.campaignId, row.campaignName,
    row.creativeId, row.creativeName, row.creativeType, row.status,
    row.impressions, row.clicks, row.spend, row.ctr, row.cpc, row.cpm,
    options.currency, options.start, options.end, options.status,
  ]);
  return [headers, ...values].map((record) => record.map(safeCsvCell).join(",")).join("\r\n") + "\r\n";
}
