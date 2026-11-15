"use client";

import {
  summarizeMetaCampaignBenchmarks,
  type MetaCampaignBenchmarkInput,
} from "@/lib/social/analytics/meta-campaign-benchmarks";

const METRICS = [
  { key: "ctr", label: "Median CTR", unit: "%" },
  { key: "cpc", label: "Median CPC", unit: "currency" },
  { key: "cpm", label: "Median CPM", unit: "currency" },
] as const;

function amount(value: number | null, unit: "%" | "currency", currency: string | null) {
  if (value == null) return "Unavailable";
  const rendered = new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  return unit === "%" ? `${rendered}%` : currency ? `${rendered} ${currency}` : rendered;
}

export function MetaCampaignBenchmarkPanel({
  campaigns,
  confirmed,
  currency,
}: {
  campaigns: readonly MetaCampaignBenchmarkInput[];
  confirmed: boolean;
  currency: string | null;
}) {
  const summary = summarizeMetaCampaignBenchmarks(campaigns, confirmed);
  const currencyCode = currency && /^[A-Z]{3}$/.test(currency) ? currency : null;
  return (
    <section aria-labelledby="meta-campaign-benchmarks-title" className="rounded-xl border border-[#DCE7F7] bg-[#F8FBFF] p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#2563EB]">TAKATAK Creative Intelligence · foundation</p>
      <h3 id="meta-campaign-benchmarks-title" className="mt-2 text-lg font-semibold text-[#10213A]">
        Internal campaign comparison (beta)
      </h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#475569]">
        These are medians of campaigns within this selected Meta ad account and date range.
        They are not creative-level results or external industry benchmarks. Different objectives,
        audiences and placements can make comparisons misleading.
      </p>
      {summary.kind === "unavailable" ? (
        <p role="status" className="mt-4 rounded-lg bg-white p-4 text-sm text-[#475569]">
          Comparison unavailable: {summary.reason}
        </p>
      ) : (
        <>
          <p className="mt-4 text-xs text-[#64748B]">
            {summary.eligible} eligible campaigns · minimum {summary.minImpressions.toLocaleString("en-CA")} impressions
            and {summary.minSpend} {currencyCode ?? "units of account currency"} spent per campaign.
            A metric needs at least 3 reported values.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {METRICS.map((metric) => (
              <div key={metric.key} className="rounded-lg border border-[#E2E8F0] bg-white p-4">
                <p className="text-xs text-[#475569]">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold text-[#10213A]">
                  {amount(summary.medians[metric.key], metric.unit, currencyCode)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Top eight eligible campaigns by spend, not performance ranking</caption>
              <thead className="border-b border-[#E2E8F0] text-[#475569]">
                <tr>
                  <th scope="col" className="p-3 font-medium">Campaign</th>
                  <th scope="col" className="p-3 font-medium">CTR</th>
                  <th scope="col" className="p-3 font-medium">CPC</th>
                  <th scope="col" className="p-3 font-medium">CPM</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.slice(0, 8).map((campaign) => (
                  <tr key={campaign.id} className="border-b border-[#F1F5F9] last:border-0">
                    <th scope="row" className="p-3 font-medium text-[#10213A]">{campaign.name}</th>
                    <td className="p-3">{amount(campaign.ctr, "%", currencyCode)}</td>
                    <td className="p-3">{amount(campaign.cpc, "currency", currencyCode)}</td>
                    <td className="p-3">{amount(campaign.cpm, "currency", currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#64748B]">
            Display ordered by spend, not by quality. No recommendation or profitability claim is inferred.
            Creative-level breakdowns require a separately verified Meta data integration.
          </p>
        </>
      )}
    </section>
  );
}
