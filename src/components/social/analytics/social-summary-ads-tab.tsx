"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Columns3,
  Download,
  Search,
} from "lucide-react";

import {
  AdMetricSection,
} from "@/components/social/analytics/social-summary-metric-section";
import type { SocialSummaryData } from "@/components/social/analytics/social-summary-types";
import {
  AD_PLATFORM_CARD_COLORS,
  AD_PLATFORM_NAMES,
  AD_PLATFORM_ORDER,
  enumerateDates,
  metricValue,
  money,
  number,
  type MetricValue,
  type SocialAdPlatformKey,
} from "@/components/social/analytics/social-summary-tokens";
import { withSocialPreview } from "@/components/social/preview/social-preview-query";

type AdColumn = "platform" | "account" | "impressions" | "clicks" | "spend";

const COLUMN_LABELS: Record<AdColumn, string> = {
  platform: "Platform",
  account: "Account",
  impressions: "Impressions",
  clicks: "Clicks",
  spend: "Spend",
};

function ratioMetric(
  numerator: number,
  denominator: number,
): MetricValue {
  if (denominator <= 0) {
    return metricValue(0);
  }

  return metricValue(numerator / denominator);
}

export function SocialSummaryAdsTab({
  data,
  start,
  end,
}: {
  data: SocialSummaryData;
  start: string;
  end: string;
}) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<AdColumn[]>([
    "platform",
    "account",
    "impressions",
    "clicks",
    "spend",
  ]);

  const adRows = useMemo(
    () => data.adDaily.filter((row) => row.date >= start && row.date <= end),
    [data.adDaily, start, end],
  );

  const hasAdAccounts = data.adAccounts.length > 0;
  const currency =
    data.adAccounts[0]?.currency ?? data.adDaily[0]?.currency ?? "CAD";

  const platforms = useMemo(() => {
    const present = new Set<SocialAdPlatformKey>([
      ...data.adAccounts.map((account) => account.platform),
      ...adRows.map((row) => row.platform),
    ]);

    if (present.size === 0) {
      return AD_PLATFORM_ORDER;
    }

    return AD_PLATFORM_ORDER.filter((platform) => present.has(platform));
  }, [data.adAccounts, adRows]);

  function platformSum(
    platform: SocialAdPlatformKey,
    field: "impressions" | "clicks" | "spendMinor",
  ) {
    return adRows
      .filter((row) => row.platform === platform)
      .reduce((total, row) => total + row[field], 0);
  }

  const totalImpressions = adRows.reduce(
    (total, row) => total + row.impressions,
    0,
  );
  const totalClicks = adRows.reduce((total, row) => total + row.clicks, 0);
  const totalSpendMinor = adRows.reduce(
    (total, row) => total + row.spendMinor,
    0,
  );

  const impressionsTotal = metricValue(totalImpressions);
  const clicksTotal = metricValue(totalClicks);
  const spendTotal = metricValue(totalSpendMinor / 100);

  const cpmTotal = ratioMetric(totalSpendMinor / 100, totalImpressions / 1000);
  const cpcTotal = ratioMetric(totalSpendMinor / 100, totalClicks);

  const dates = enumerateDates(start, end);

  function dailySeries(
    field: "impressions" | "clicks" | "spendMinor",
    scale = 1,
  ) {
    return dates.map((date) => {
      const value = adRows
        .filter((row) => row.date === date)
        .reduce((total, row) => total + row[field], 0);

      return { date, value: metricValue(value * scale) };
    });
  }

  function platformCards(
    field: "impressions" | "clicks" | "spendMinor",
    scale = 1,
    asRatio?: { numerator: "spendMinor"; denominator: "impressions" | "clicks"; factor: number },
  ) {
    return platforms.map((platform) => {
      if (asRatio) {
        const numerator = platformSum(platform, asRatio.numerator) / 100;
        const denominator = platformSum(platform, asRatio.denominator);
        return {
          key: platform,
          label: AD_PLATFORM_NAMES[platform],
          color: AD_PLATFORM_CARD_COLORS[platform],
          value: ratioMetric(numerator, denominator / asRatio.factor),
        };
      }

      return {
        key: platform,
        label: AD_PLATFORM_NAMES[platform],
        color: AD_PLATFORM_CARD_COLORS[platform],
        value: metricValue(platformSum(platform, field) * scale),
      };
    });
  }

  const accountRows = useMemo(() => {
    return data.adAccounts.map((account) => {
      const rows = adRows.filter((row) => row.platform === account.platform);
      const impressions = rows.reduce((total, row) => total + row.impressions, 0);
      const clicks = rows.reduce((total, row) => total + row.clicks, 0);
      const spend = rows.reduce((total, row) => total + row.spendMinor, 0) / 100;

      return {
        id: account.id,
        platform: account.platform,
        name:
          account.displayName ??
          AD_PLATFORM_NAMES[account.platform],
        impressions,
        clicks,
        spend,
        currency: account.currency,
      };
    });
  }, [data.adAccounts, adRows]);

  const filteredAccounts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return accountRows;
    }

    return accountRows.filter((row) =>
      [AD_PLATFORM_NAMES[row.platform], row.name]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [accountRows, query]);

  function toggleColumn(column: AdColumn) {
    setVisibleColumns((current) => {
      if (current.includes(column)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== column);
      }
      return [...current, column];
    });
  }

  function downloadCsv() {
    const headers = visibleColumns.map((column) => COLUMN_LABELS[column]);
    const rows = filteredAccounts.map((row) =>
      visibleColumns.map((column) => {
        switch (column) {
          case "platform":
            return AD_PLATFORM_NAMES[row.platform];
          case "account":
            return row.name;
          case "impressions":
            return String(row.impressions);
          case "clicks":
            return String(row.clicks);
          case "spend":
            return money(row.spend, row.currency);
        }
      }),
    );

    const body = [headers, ...rows]
      .map((line) =>
        line
          .map((cell) =>
            /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell,
          )
          .join(","),
      )
      .join("\n");

    const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `takatak-ad-accounts-${start}-to-${end}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const searchActive = query.trim().length > 0;
  const emptySearch = searchActive && filteredAccounts.length === 0;
  const emptyAccounts = !hasAdAccounts;

  return (
    <div className="space-y-10">
      <div>
        <h2 className="mb-5 text-[22px] font-semibold text-[#20242A]">
          Ad accounts
        </h2>

        <div className="space-y-10">
          <AdMetricSection
            title="Impressions"
            total={impressionsTotal}
            cards={platformCards("impressions")}
            points={dailySeries("impressions")}
            seriesLabel="Impressions"
          />

          <AdMetricSection
            title="Clicks"
            total={clicksTotal}
            cards={platformCards("clicks")}
            points={dailySeries("clicks")}
            seriesLabel="Clicks"
          />

          <AdMetricSection
            title="Performance (CPM)"
            total={cpmTotal}
            cards={platformCards("spendMinor", 1, {
              numerator: "spendMinor",
              denominator: "impressions",
              factor: 1000,
            })}
            points={dates.map((date) => {
              const dayRows = adRows.filter((row) => row.date === date);
              const spend = dayRows.reduce((t, r) => t + r.spendMinor, 0) / 100;
              const impressions = dayRows.reduce(
                (t, r) => t + r.impressions,
                0,
              );
              return {
                date,
                value: ratioMetric(spend, impressions / 1000),
              };
            })}
            seriesLabel="CPM"
            formatValue={(value) => number(value, 2)}
          />

          <AdMetricSection
            title="Performance (CPC)"
            total={cpcTotal}
            cards={platformCards("spendMinor", 1, {
              numerator: "spendMinor",
              denominator: "clicks",
              factor: 1,
            })}
            points={dates.map((date) => {
              const dayRows = adRows.filter((row) => row.date === date);
              const spend = dayRows.reduce((t, r) => t + r.spendMinor, 0) / 100;
              const clicks = dayRows.reduce((t, r) => t + r.clicks, 0);
              return { date, value: ratioMetric(spend, clicks) };
            })}
            seriesLabel="CPC"
            formatValue={(value) => number(value, 2)}
          />

          <AdMetricSection
            title="Spent"
            total={spendTotal}
            cards={platformCards("spendMinor", 0.01)}
            points={dailySeries("spendMinor", 0.01)}
            seriesLabel="Spent"
            formatValue={(value) => money(value, currency)}
          />
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search ad accounts</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa1a9]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-11 w-full rounded-[10px] border border-[#d7dbe0] bg-white pl-10 pr-3 text-sm text-[#30343a] outline-none transition focus:border-[#8996F6] focus:ring-2 focus:ring-[#EEF0FF]"
            />
          </label>

          <div className="relative flex gap-2">
            <button
              type="button"
              aria-expanded={columnsOpen}
              onClick={() => setColumnsOpen((open) => !open)}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#d7dbe0] bg-white px-3.5 text-sm font-medium text-[#30343a] transition hover:bg-[#f8f9fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#566DF1]"
            >
              <Columns3 className="h-4 w-4" />
              Columns
            </button>

            <button
              type="button"
              onClick={downloadCsv}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#d7dbe0] bg-white px-3.5 text-sm font-medium text-[#30343a] transition hover:bg-[#f8f9fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#566DF1]"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </button>

            {columnsOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-12 z-20 w-48 rounded-xl border border-[#e1e4e7] bg-white p-2 shadow-[0_12px_30px_rgba(15,23,42,0.12)]"
              >
                {(Object.keys(COLUMN_LABELS) as AdColumn[]).map((column) => (
                  <label
                    key={column}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[#30343a] hover:bg-[#f5f6f8]"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(column)}
                      onChange={() => toggleColumn(column)}
                      className="rounded border-[#c5cad1]"
                    />
                    {COLUMN_LABELS[column]}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {emptyAccounts || emptySearch ? (
          <div className="rounded-[12px] border border-[#e8eaed] bg-[#fafbfc] px-6 py-16 text-center">
            <p className="text-[16px] font-semibold text-[#30343a]">
              Oops! Nothing found, try another search
            </p>
            <p className="mt-2 text-sm text-[#6b7280]">
              You can use the filter tools to narrow down your search. Check if
              the current date range suits your needs.
            </p>
            {!hasAdAccounts ? (
              <Link
                href={withSocialPreview(
                  "/dashboard/social?connections=open",
                  searchParams,
                )}
                className="mt-5 inline-flex h-11 items-center justify-center rounded-[10px] bg-[#2c1929] px-5 text-sm font-semibold text-[#ddff35] transition hover:bg-[#3b2237]"
              >
                Manage connections
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[12px] border border-[#e1e4e7] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#eef0f2] bg-[#fafbfc] text-[12px] uppercase tracking-wide text-[#6b7280]">
                <tr>
                  {visibleColumns.map((column) => (
                    <th key={column} className="px-4 py-3 font-semibold">
                      {COLUMN_LABELS[column]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef0f2]">
                {filteredAccounts.map((row) => (
                  <tr key={row.id} className="text-[#30343a]">
                    {visibleColumns.includes("platform") ? (
                      <td className="px-4 py-3 font-medium">
                        {AD_PLATFORM_NAMES[row.platform]}
                      </td>
                    ) : null}
                    {visibleColumns.includes("account") ? (
                      <td className="px-4 py-3">{row.name}</td>
                    ) : null}
                    {visibleColumns.includes("impressions") ? (
                      <td className="px-4 py-3">
                        {number(row.impressions)}
                      </td>
                    ) : null}
                    {visibleColumns.includes("clicks") ? (
                      <td className="px-4 py-3">{number(row.clicks)}</td>
                    ) : null}
                    {visibleColumns.includes("spend") ? (
                      <td className="px-4 py-3">
                        {money(row.spend, row.currency)}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
