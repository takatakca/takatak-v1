"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  Columns3,
  Download,
  GitCompareArrows,
  LayoutDashboard,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  SocialSummaryChart,
  type ChartTooltipSeries,
} from "@/components/social/analytics/social-summary-chart";
import { metricValue } from "@/components/social/analytics/social-summary-tokens";

type DailyPoint = {
  date: string;
  impressions: number | null;
  reach: number | null;
  spend: number | null;
  clicks: number | null;
  cpm: number | null;
  cpc: number | null;
  ctr: number | null;
};

type CampaignRow = {
  id: string;
  name: string;
  status: string | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  spend: number | null;
  cpm: number | null;
  cpc: number | null;
  ctr: number | null;
};

type AccountAnalytics = {
  accountName?: string;
  impressions: number | null;
  reach: number | null;
  spend: number | null;
  clicks: number | null;
  cpm: number | null;
  cpc: number | null;
  ctr: number | null;
  points: DailyPoint[];
  campaigns?: CampaignRow[];
  campaignsConfirmed?: boolean;
  notice: string | null;
  range?: { start: string; end: string };
};

type MetaSection = "account" | "campaigns";

type CampaignColumn = "status" | "impressions" | "reach" | "clicks" | "ctr" | "cpc" | "cpm" | "spend";

const CAMPAIGN_COLUMNS: Array<{ key: CampaignColumn; label: string }> = [
  { key: "status", label: "Status" },
  { key: "impressions", label: "Impressions" },
  { key: "reach", label: "Reach" },
  { key: "clicks", label: "Clicks" },
  { key: "ctr", label: "CTR" },
  { key: "cpc", label: "CPC" },
  { key: "cpm", label: "CPM" },
  { key: "spend", label: "Spent" },
];

const RANGES = [7, 30, 90, 180, 365] as const;
const COLORS = {
  purple: "#8B7EF6",
  green: "#7BC98A",
  gold: "#E6A12A",
  pink: "#F2A6D6",
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function createRange(days: number) {
  const end = new Date();
  end.setUTCHours(12, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { start: isoDate(start), end: isoDate(end) };
}

function periodLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function shiftDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (cursor <= last) {
    dates.push(isoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function formatAmount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

function campaignStatusLabel(status: string | null): string {
  if (!status) return "—";
  const known: Record<string, string> = {
    ACTIVE: "Active",
    PAUSED: "Paused",
    DELETED: "Deleted",
    ARCHIVED: "Archived",
    IN_PROCESS: "In process",
    WITH_ISSUES: "With issues",
  };
  return known[status] ?? status;
}

function campaignCell(row: CampaignRow, column: CampaignColumn): string {
  if (column === "status") return campaignStatusLabel(row.status);
  return formatAmount(row[column]);
}

function EmptyCampaignSearch() {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <svg viewBox="0 0 220 120" className="h-[120px] w-[220px]" aria-hidden="true">
        <circle cx="110" cy="58" r="46" fill="#E7F0FB" />
        <rect x="62" y="42" width="70" height="8" rx="4" fill="#F4F7FB" />
        <rect x="62" y="56" width="52" height="8" rx="4" fill="#F7F9FC" />
        <rect x="62" y="70" width="40" height="8" rx="4" fill="#F7F9FC" />
        <circle cx="132" cy="62" r="22" fill="none" stroke="#20242A" strokeWidth="6" />
        <path d="M148 80 168 100" stroke="#20242A" strokeWidth="8" strokeLinecap="round" />
      </svg>
      <p className="mt-2 text-[18px] font-medium text-[#30343A]">
        Oops! Nothing found, try another search
      </p>
      <p className="mt-2 max-w-[460px] text-[14px] leading-6 text-[#9AA3AB]">
        You can use the filter tools to narrow down your search. Check if the
        current date range suits your needs.
      </p>
    </div>
  );
}

function CampaignList({
  rows,
  confirmed,
  loading,
}: {
  rows: CampaignRow[];
  confirmed: boolean;
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visible, setVisible] = useState<CampaignColumn[]>(
    CAMPAIGN_COLUMNS.map((column) => column.key),
  );
  const filtered = rows.filter((row) =>
    row.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function toggleColumn(column: CampaignColumn) {
    setVisible((current) =>
      current.includes(column)
        ? current.filter((item) => item !== column)
        : CAMPAIGN_COLUMNS.map((item) => item.key).filter(
            (item) => current.includes(item) || item === column,
          ),
    );
  }

  function downloadCsv() {
    const headers = ["Campaign", ...visible.map((column) => CAMPAIGN_COLUMNS.find((item) => item.key === column)?.label ?? column)];
    const body = filtered.map((row) => [
      row.name,
      ...visible.map((column) => campaignCell(row, column)),
    ]);
    const csv = [headers, ...body]
      .map((line) =>
        line
          .map((cell) =>
            /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell,
          )
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "meta-ads-campaigns.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-[14px] border border-[#E6E8EC] bg-white px-5 py-5 sm:px-6">
      <h3 className="text-[16px] font-medium text-[#20242A]">List of campaigns</h3>
      <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA1A9]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search campaigns"
            className="h-10 w-full rounded-[8px] border border-[#E3E6EA] bg-white pl-9 pr-3 text-[14px] text-[#30343A] outline-none"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              aria-expanded={columnsOpen}
              onClick={() => setColumnsOpen((current) => !current)}
              className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#E3E6EA] bg-white px-3 text-[13px] text-[#505761]"
            >
              <Columns3 className="h-4 w-4" />
              Columns
            </button>
            {columnsOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-[8px] border border-[#E6E8EC] bg-white p-2 text-[13px] shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
                {CAMPAIGN_COLUMNS.map((column) => (
                  <label key={column.key} className="flex items-center gap-2 px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={visible.includes(column.key)}
                      onChange={() => toggleColumn(column.key)}
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={downloadCsv}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#E3E6EA] bg-white px-3 text-[13px] text-[#505761]"
          >
            <Download className="h-4 w-4" />
            Download CSV
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#C6E86A] text-[#3D4A12]">
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          </button>
          <div className="relative">
            <span className="absolute -right-1 -top-3 rounded-full bg-[#D9F6EA] px-2 py-0.5 text-[10px] font-medium text-[#3E8F6E]">
              New
            </span>
            <Link
              href="/dashboard/billing"
              className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#E3E6EA] bg-white px-3 text-[13px] text-[#505761]"
            >
              <LayoutDashboard className="h-4 w-4" />
              Add to dashboard
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#C6E86A] text-[#3D4A12]">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            </Link>
          </div>
        </div>
      </div>
      {loading ? (
        <p className="px-2 py-16 text-center text-[14px] text-[#9AA1A9]">Loading</p>
      ) : !confirmed ? (
        <p className="px-2 py-16 text-center text-[14px] text-[#8B939C]">
          Meta Ads did not return campaigns.
        </p>
      ) : filtered.length === 0 ? (
        <EmptyCampaignSearch />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[13px] text-[#30343A]">
            <thead>
              <tr className="border-b border-[#EEF0F2] text-[#8B939C]">
                <th className="py-2 pr-4 font-medium">Campaign</th>
                {visible.map((column) => (
                  <th key={column} className="py-2 pr-4 font-medium">
                    {CAMPAIGN_COLUMNS.find((item) => item.key === column)?.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-[#F4F6F8]">
                  <td className="py-3 pr-4">{row.name}</td>
                  {visible.map((column) => (
                    <td key={column} className="py-3 pr-4">
                      {campaignCell(row, column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MetaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#0866FF"
        d="M7.2 15.6c1.5-2.4 2.6-5.1 3.3-7.2.5 1.6 1.4 3.6 2.5 5.6l1.1 2c.5.9 1.1 1.2 1.8 1.2 1.1 0 1.7-1 2.6-3.1.7-1.6 1.5-3.8 2.4-4.9.4-.5.8-.6 1.2-.6h.1v-1.6h-.3c-1.1 0-2 .4-2.9 1.5-.8 1-1.6 2.8-2.5 5.1-.8-1.6-1.6-2.9-2.4-3.7-.9-.9-1.7-1.3-2.6-1.3s-1.8.5-2.5 1.6c-.8 1.2-1.7 3.2-2.8 6.1-.4 1-1 1.6-1.7 1.6-.5 0-.9-.3-1.2-.9L2 12.4l-1.3 1.1 1.5 1.8c.7 1 1.6 1.5 2.6 1.5 1.4 0 2.4-.8 3.4-2.2Z"
      />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  color,
  selected,
  onSelect,
}: {
  label: string;
  value: number | null;
  color: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="flex h-[88px] w-[132px] shrink-0 flex-col items-center justify-center rounded-[10px] text-white transition hover:brightness-[0.98]"
      style={{ backgroundColor: color }}
    >
      <span className="text-[30px] font-medium leading-none tracking-tight">
        {formatAmount(value)}
      </span>
      <span className="mt-1.5 text-[13px] font-medium">{label}</span>
    </button>
  );
}

function ChartWatermark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-16 top-[42%] z-10 flex justify-between"
    >
      {["takatak", "takatak", "takatak"].map((label, index) => (
        <span key={index} className="select-none text-[28px] font-medium text-[#E7E9ED]">
          {label}
        </span>
      ))}
    </div>
  );
}

function ChartBlock({
  title,
  cards,
  points,
  seriesLabel,
  seriesColor,
  tooltipSeries,
}: {
  title: string;
  cards: ReactNode;
  points: Array<{ date: string; value: ReturnType<typeof metricValue> }>;
  seriesLabel: string;
  seriesColor: string;
  tooltipSeries?: ChartTooltipSeries[];
}) {
  return (
    <section className="rounded-[14px] border border-[#E6E8EC] bg-white px-5 pb-2 pt-4 sm:px-6">
      <div className="relative">
        <h2 className="absolute left-0 top-[26px] z-20 text-[16px] font-medium text-[#20242A]">
          {title}
        </h2>
        <div className="absolute right-0 top-0 z-20 flex max-w-[calc(100%-7.5rem)] justify-end gap-3 overflow-x-auto">
          {cards}
        </div>
        <div className="relative pt-[68px]">
          <SocialSummaryChart
            points={points}
            seriesLabel={seriesLabel}
            seriesColor={seriesColor}
            includeEndLabel={false}
            showBaseline
            dense
            showMarkers
            hideFlatZero
            tooltipSeries={tooltipSeries}
          />
          <ChartWatermark />
        </div>
      </div>
    </section>
  );
}

export function MetaAdsSubscribedDashboard({
  connectedLabel,
}: {
  connectedLabel: string | null;
}) {
  const [section, setSection] = useState<MetaSection>("account");
  const [rangeDays, setRangeDays] = useState(30);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [reachMetric, setReachMetric] = useState<"impressions" | "reach" | "spend">(
    "impressions",
  );
  const [resultsMetric, setResultsMetric] = useState<"clicks" | "spend">("clicks");
  const [performanceMetric, setPerformanceMetric] = useState<
    "cpm" | "cpc" | "ctr" | "spend"
  >("cpm");
  const [analytics, setAnalytics] = useState<AccountAnalytics | null>(null);
  const [loadedRange, setLoadedRange] = useState<{ start: string; end: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const display = useMemo(() => createRange(rangeDays), [rangeDays]);
  const previous = useMemo(() => {
    const length =
      Math.round(
        (new Date(`${display.end}T12:00:00Z`).getTime() -
          new Date(`${display.start}T12:00:00Z`).getTime()) /
          86_400_000,
      ) + 1;
    return {
      start: shiftDays(display.start, -length),
      end: shiftDays(display.start, -1),
    };
  }, [display]);

  useEffect(() => {
    let stale = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    const params = new URLSearchParams({ start: display.start, end: display.end });
    fetch(`/api/social/meta-ads/analytics?${params.toString()}`, {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as AccountAnalytics & {
          ok?: boolean;
          message?: string;
          connected?: boolean;
        };
        if (!response.ok || body.ok === false) {
          throw new Error(body.message || "Meta Ads analytics could not be loaded.");
        }
        if (body.connected === false) {
          throw new Error("No connected Meta ad account is selected.");
        }
        if (stale) return;
        setAnalytics(body);
        setLoadedRange(body.range ?? { start: display.start, end: display.end });
      })
      .catch((reason: unknown) => {
        if (stale) return;
        setAnalytics(null);
        setLoadedRange(null);
        setError(
          reason instanceof DOMException && reason.name === "AbortError"
            ? "Meta Ads took too long to answer."
            : reason instanceof Error
              ? reason.message
              : "Meta Ads analytics could not be loaded.",
        );
      })
      .finally(() => {
        window.clearTimeout(timer);
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [display.start, display.end, reloadKey]);

  const ready =
    loadedRange?.start === display.start && loadedRange?.end === display.end;
  const points = ready ? (analytics?.points ?? []) : [];

  function series(key: keyof DailyPoint, label: string, color: string) {
    const source = points.length
      ? points
      : enumerateDates(display.start, display.end).map((date) => ({
          date,
          impressions: null,
          reach: null,
          spend: null,
          clicks: null,
          cpm: null,
          cpc: null,
          ctr: null,
        }));
    return {
      label,
      color,
      format: formatAmount,
      points: source.map((point) => ({
        date: point.date,
        value: metricValue(typeof point[key] === "number" ? (point[key] as number) : null),
      })),
    };
  }

  const impressionSeries = series("impressions", "Impressions", COLORS.purple);
  const reachSeries = series("reach", "Reach", COLORS.green);
  const spendSeries = series("spend", "Spent", COLORS.gold);
  const clickSeries = series("clicks", "Clicks", COLORS.purple);
  const cpmSeries = series("cpm", "CPM", COLORS.purple);
  const cpcSeries = series("cpc", "CPC", COLORS.green);
  const ctrSeries = series("ctr", "CTR", COLORS.pink);
  const reachChart =
    reachMetric === "reach" ? reachSeries : reachMetric === "spend" ? spendSeries : impressionSeries;
  const resultsChart = resultsMetric === "spend" ? spendSeries : clickSeries;
  const performanceChart =
    performanceMetric === "cpc"
      ? cpcSeries
      : performanceMetric === "ctr"
        ? ctrSeries
        : performanceMetric === "spend"
          ? spendSeries
          : cpmSeries;
  const accountName = analytics?.accountName || connectedLabel || "Meta ad account";
  const campaigns = ready ? (analytics?.campaigns ?? []) : [];
  const campaignsConfirmed = ready && analytics?.campaignsConfirmed === true;

  function scrollToSection(next: MetaSection) {
    setSection(next);
    document.getElementById(`meta-ads-${next}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  useEffect(() => {
    const sections = (["account", "campaigns"] as const)
      .map((key) => document.getElementById(`meta-ads-${key}`))
      .filter((node): node is HTMLElement => node !== null);
    if (!sections.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              Math.abs(left.boundingClientRect.top) -
              Math.abs(right.boundingClientRect.top),
          );
        const visibleId = visible[0]?.target.id;
        if (visibleId === "meta-ads-account" || visibleId === "meta-ads-campaigns") {
          setSection(visibleId.slice("meta-ads-".length) as MetaSection);
        }
      },
      { rootMargin: "-160px 0px -55% 0px", threshold: [0, 0.1, 0.25, 0.5] },
    );
    for (const node of sections) observer.observe(node);
    return () => observer.disconnect();
  }, [ready]);
  const value = (key: keyof AccountAnalytics) =>
    ready && typeof analytics?.[key] === "number" ? (analytics[key] as number) : ready ? null : null;

  return (
    <div className="space-y-4 bg-white text-[#20242A]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div role="tablist" aria-label="Meta Ads" className="flex items-end gap-6">
          {(
            [
              ["account", "ACCOUNT"],
              ["campaigns", "CAMPAIGNS"],
            ] as const
          ).map(([key, label]) => {
            const selected = section === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => scrollToSection(key)}
                className={`border-b-2 px-0.5 pb-2 text-[12px] font-semibold tracking-[0.08em] ${
                  selected
                    ? "border-[#20242A] text-[#20242A]"
                    : "border-transparent text-[#9AA1A9]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[11px] text-[#8B939C]">
            Main period
            <span className="relative flex h-10 items-center gap-2 rounded-[8px] border border-[#E3E6EA] bg-white px-3 text-[13px] font-medium text-[#30343A]">
              <CalendarDays className="h-4 w-4 text-[#98A2AB]" />
              <span>
                {periodLabel(display.start)} - {periodLabel(display.end)}
              </span>
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#43A047] text-white">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              <select
                aria-label="Meta Ads date range"
                value={rangeDays}
                onChange={(event) => setRangeDays(Number(event.target.value))}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                {RANGES.map((days) => (
                  <option key={days} value={days}>
                    {days === 365 ? "Last 12 months" : `Last ${days} days`}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <div className="flex flex-col gap-1 text-[11px] text-[#8B939C]">
            Comparison period
            <button
              type="button"
              aria-pressed={compareEnabled}
              onClick={() => setCompareEnabled((current) => !current)}
              className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#E3E6EA] bg-white px-3 text-[13px] text-[#505761]"
            >
              <GitCompareArrows className="h-4 w-4 text-[#98A2AB]" />
              {compareEnabled
                ? `${periodLabel(previous.start)} - ${periodLabel(previous.end)}`
                : "Create comparison view"}
              <ChevronDown className="h-3.5 w-3.5 text-[#98A2AB]" />
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col gap-3 rounded-[12px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            className="inline-flex h-10 items-center justify-center rounded-[9px] border border-rose-300 bg-white px-4 font-medium"
          >
            Retry
          </button>
        </div>
      ) : null}
      {ready && analytics?.notice ? (
        <p className="text-sm text-[#5F6770]">{analytics.notice}</p>
      ) : null}

      <section id="meta-ads-account" className="scroll-mt-[84px] space-y-4">
        <div className="flex items-center justify-between gap-4 pt-2">
          <h1 className="flex items-center gap-3 text-[20px] font-medium">
            Account
            {loading && !ready ? (
              <span className="text-[12px] font-normal text-[#9AA1A9]">Loading</span>
            ) : null}
          </h1>
          <span className="flex min-w-0 items-center gap-2 text-[15px] font-medium">
            <MetaMark className="h-5 w-5 shrink-0" />
            <span className="truncate">{accountName}</span>
          </span>
        </div>

        <ChartBlock
          title="Reach"
          seriesLabel={reachChart.label}
          seriesColor={reachChart.color}
          points={reachChart.points}
          tooltipSeries={[impressionSeries, reachSeries, spendSeries]}
          cards={
            <>
              <MetricCard
                label="Impressions"
                value={value("impressions")}
                color={COLORS.purple}
                selected={reachMetric === "impressions"}
                onSelect={() => setReachMetric("impressions")}
              />
              <MetricCard
                label="Reach"
                value={value("reach")}
                color={COLORS.green}
                selected={reachMetric === "reach"}
                onSelect={() => setReachMetric("reach")}
              />
              <MetricCard
                label="Spent"
                value={value("spend")}
                color={COLORS.gold}
                selected={reachMetric === "spend"}
                onSelect={() => setReachMetric("spend")}
              />
            </>
          }
        />
        <ChartBlock
          title="Results"
          seriesLabel={resultsChart.label}
          seriesColor={resultsChart.color}
          points={resultsChart.points}
          tooltipSeries={[clickSeries, spendSeries]}
          cards={
            <>
              <MetricCard
                label="Clicks"
                value={value("clicks")}
                color={COLORS.purple}
                selected={resultsMetric === "clicks"}
                onSelect={() => setResultsMetric("clicks")}
              />
              <MetricCard
                label="Spent"
                value={value("spend")}
                color={COLORS.gold}
                selected={resultsMetric === "spend"}
                onSelect={() => setResultsMetric("spend")}
              />
            </>
          }
        />
        <ChartBlock
          title="Performance"
          seriesLabel={performanceChart.label}
          seriesColor={performanceChart.color}
          points={performanceChart.points}
          tooltipSeries={[cpmSeries, cpcSeries, ctrSeries, spendSeries]}
          cards={
            <>
              <MetricCard
                label="CPM"
                value={value("cpm")}
                color={COLORS.purple}
                selected={performanceMetric === "cpm"}
                onSelect={() => setPerformanceMetric("cpm")}
              />
              <MetricCard
                label="CPC"
                value={value("cpc")}
                color={COLORS.green}
                selected={performanceMetric === "cpc"}
                onSelect={() => setPerformanceMetric("cpc")}
              />
              <MetricCard
                label="CTR"
                value={value("ctr")}
                color={COLORS.pink}
                selected={performanceMetric === "ctr"}
                onSelect={() => setPerformanceMetric("ctr")}
              />
              <MetricCard
                label="Spent"
                value={value("spend")}
                color={COLORS.gold}
                selected={performanceMetric === "spend"}
                onSelect={() => setPerformanceMetric("spend")}
              />
            </>
          }
        />
      </section>

      <section id="meta-ads-campaigns" className="scroll-mt-[84px] space-y-4 pt-2">
        <h2 className="text-[20px] font-medium">Campaigns</h2>
        <CampaignList
          rows={campaigns}
          confirmed={campaignsConfirmed}
          loading={loading && !ready}
        />
      </section>
    </div>
  );
}
