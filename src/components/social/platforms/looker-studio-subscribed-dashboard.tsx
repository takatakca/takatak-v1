"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Download,
  GitCompareArrows,
  Search,
  Table2,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  SocialSummaryChart,
  type ChartTooltipSeries,
} from "@/components/social/analytics/social-summary-chart";
import { metricValue } from "@/components/social/analytics/social-summary-tokens";

type LookerSection = "overview" | "audience" | "reports";
type AudienceMetric = "new" | "returning" | "direct" | "referral";
type ReportMetric = "pages" | "views" | "sessions";

const AUDIENCE_ROWS = [
  ["New", "#8B7EF6"],
  ["Returning", "#7BC98A"],
  ["Direct", "#F2A6D6"],
  ["Referral", "#C9A4CC"],
] as const;

const RANGES = [7, 30, 90, 180, 365] as const;

const COLORS = {
  views: "#8B7EF6",
  users: "#C9E4C4",
  sessions: "#E6A12A",
  balance: "#7BC98A",
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

function formatCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function unavailableSeries(start: string, end: string, label: string, color: string) {
  return {
    label,
    color,
    points: enumerateDates(start, end).map((date) => ({
      date,
      value: metricValue(null),
    })),
  };
}

function LookerMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="8" fill="none" stroke="#6C63FF" strokeWidth="2.4" />
      <circle cx="12" cy="12" r="3" fill="#6C63FF" />
    </svg>
  );
}

function LookerAccountLabel({ name }: { name: string }) {
  const label = name.replace(/^@/, "");
  const initial = label.slice(0, 1).toUpperCase() || "L";

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="relative h-10 w-10 shrink-0">
        <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#6C63FF] text-[14px] font-semibold text-white">
          {initial}
        </span>
        <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white">
          <LookerMark className="h-3.5 w-3.5" />
        </span>
      </span>
      <span className="truncate text-[15px] font-medium text-[#20242A]" title={label}>
        {label}
      </span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
  selected,
  light = false,
  onSelect,
}: {
  label: string;
  value: number | null;
  color: string;
  selected: boolean;
  light?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex h-[88px] w-[132px] shrink-0 flex-col items-center justify-center rounded-[10px] transition hover:brightness-[0.98] ${
        light ? "text-[#2C3A2E]" : "text-white"
      }`}
      style={{ backgroundColor: color }}
    >
      <span className="text-[30px] font-medium leading-none tracking-tight">
        {formatCount(value)}
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
  showMarkers = false,
  tooltipSeries,
}: {
  title: string;
  cards: ReactNode;
  points: Array<{ date: string; value: ReturnType<typeof metricValue> }>;
  seriesLabel: string;
  seriesColor: string;
  showMarkers?: boolean;
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
            showMarkers={showMarkers}
            hideFlatZero
            tooltipSeries={tooltipSeries}
          />
          <ChartWatermark />
        </div>
      </div>
    </section>
  );
}

function EmptySearch() {
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

function ReportList({ title }: { title: string }) {
  const [query, setQuery] = useState("");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [showDate, setShowDate] = useState(true);
  const [showViews, setShowViews] = useState(true);

  function downloadCsv() {
    const headers = ["Title"];
    if (showDate) headers.push("Date");
    if (showViews) headers.push("Views");
    const blob = new Blob([headers.join(",")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.toLowerCase().replaceAll(" ", "-")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-[14px] border border-[#E6E8EC] bg-white px-5 py-5 sm:px-6">
      <h3 className="text-[16px] font-medium text-[#20242A]">{title}</h3>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA1A9]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label={`Search ${title}`}
            className="h-10 w-full rounded-[8px] border border-[#E3E6EA] bg-white pl-9 pr-3 text-[14px] text-[#30343A] outline-none"
          />
        </label>
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
            <div className="absolute right-0 z-20 mt-1 w-40 rounded-[8px] border border-[#E6E8EC] bg-white p-2 text-[13px] shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
              {(
                [
                  ["Date", showDate, setShowDate],
                  ["Views", showViews, setShowViews],
                ] as const
              ).map(([label, checked, setChecked]) => (
                <label key={label} className="flex items-center gap-2 px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => setChecked(event.target.checked)}
                  />
                  {label}
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
      </div>
      <EmptySearch />
    </section>
  );
}

export function LookerStudioSubscribedDashboard({
  connectedLabel,
  owner,
}: {
  connectedLabel: string | null;
  owner: string | null;
}) {
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [section, setSection] = useState<LookerSection>("overview");
  const [growthMetric, setGrowthMetric] = useState<"views" | "users" | "sessions">(
    "views",
  );
  const [audienceMetric, setAudienceMetric] = useState<AudienceMetric>("new");
  const [reportMetric, setReportMetric] = useState<ReportMetric>("pages");
  const [distributionTable, setDistributionTable] = useState(false);
  const [pageSize, setPageSize] = useState(5);

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

  const views = unavailableSeries(display.start, display.end, "Views", COLORS.views);
  const users = unavailableSeries(display.start, display.end, "Users", COLORS.users);
  const sessions = unavailableSeries(
    display.start,
    display.end,
    "Sessions",
    COLORS.sessions,
  );
  const growth =
    growthMetric === "users" ? users : growthMetric === "sessions" ? sessions : views;
  const tooltip: ChartTooltipSeries[] = [views, users, sessions];
  const pages = unavailableSeries(display.start, display.end, "Pages", COLORS.views);
  const audience =
    audienceMetric === "returning"
      ? users
      : audienceMetric === "direct"
        ? sessions
        : audienceMetric === "referral"
          ? pages
          : views;
  const reportSeries =
    reportMetric === "views" ? views : reportMetric === "sessions" ? sessions : pages;
  const accountName = connectedLabel?.trim() || owner?.trim() || "Looker Studio";

  function scrollToSection(next: LookerSection) {
    setSection(next);
    document.getElementById(`looker-${next}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  useEffect(() => {
    const sections = (["overview", "audience", "reports"] as const)
      .map((key) => document.getElementById(`looker-${key}`))
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
        if (!visibleId?.startsWith("looker-")) return;
        const next = visibleId.slice("looker-".length);
        if (next === "overview" || next === "audience" || next === "reports") {
          setSection(next);
        }
      },
      { rootMargin: "-160px 0px -55% 0px", threshold: [0, 0.1, 0.25, 0.5] },
    );
    for (const node of sections) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-4 bg-white pb-10 text-[#20242A]">
      <div className="flex flex-col gap-4 bg-white pb-1 lg:flex-row lg:items-end lg:justify-between">
        <div role="tablist" aria-label="Looker Studio analytics" className="flex items-end gap-6">
          {(
            [
              ["overview", "OVERVIEW"],
              ["audience", "AUDIENCE"],
              ["reports", "REPORTS"],
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
            <span className="relative flex h-10 items-center gap-2 rounded-[8px] border border-[#E3E6EA] bg-white px-3 text-[13px] font-medium text-[#30343A] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <CalendarDays className="h-4 w-4 text-[#98A2AB]" />
              <span>
                {periodLabel(display.start)} - {periodLabel(display.end)}
              </span>
              <span className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-[#43A047] text-white">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              <select
                aria-label="Looker Studio date range"
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
              onClick={() => setCompareEnabled((current) => !current)}
              aria-pressed={compareEnabled}
              className={`inline-flex h-10 items-center gap-2 rounded-[8px] border bg-white px-3 text-[13px] text-[#505761] shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${
                compareEnabled ? "border-[#C9C4F6]" : "border-[#E3E6EA]"
              }`}
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

      <section id="looker-overview" className="scroll-mt-[84px] space-y-4">
        <div className="flex items-center justify-between gap-4 pt-2">
          <h1 className="text-[20px] font-medium text-[#20242A]">Overview</h1>
          <LookerAccountLabel name={accountName} />
        </div>

        <ChartBlock
          title="Activity"
          seriesLabel={growth.label}
          seriesColor={growth.color}
          points={growth.points}
          showMarkers
          tooltipSeries={tooltip}
          cards={
            <>
              <MetricCard
                label="Views"
                value={null}
                color={COLORS.views}
                selected={growthMetric === "views"}
                onSelect={() => setGrowthMetric("views")}
              />
              <MetricCard
                label="Users"
                value={null}
                color={COLORS.users}
                light
                selected={growthMetric === "users"}
                onSelect={() => setGrowthMetric("users")}
              />
              <MetricCard
                label="Sessions"
                value={null}
                color={COLORS.sessions}
                selected={growthMetric === "sessions"}
                onSelect={() => setGrowthMetric("sessions")}
              />
            </>
          }
        />

        <ChartBlock
          title="Balance"
          seriesLabel="Views"
          seriesColor={COLORS.balance}
          points={views.points}
          cards={
            <MetricCard
              label="Views"
              value={null}
              color={COLORS.balance}
              selected
              onSelect={() => undefined}
            />
          }
        />
      </section>

      <section id="looker-audience" className="scroll-mt-[84px] space-y-4 pt-4">
        <h2 className="text-[20px] font-medium text-[#20242A]">Audience</h2>
        <ChartBlock
          title="Visitors"
          seriesLabel={audience.label}
          seriesColor={audience.color}
          points={audience.points}
          showMarkers
          tooltipSeries={tooltip}
          cards={
            <>
              <MetricCard
                label="New"
                value={null}
                color="#8B7EF6"
                selected={audienceMetric === "new"}
                onSelect={() => setAudienceMetric("new")}
              />
              <MetricCard
                label="Returning"
                value={null}
                color="#C9E4C4"
                light
                selected={audienceMetric === "returning"}
                onSelect={() => setAudienceMetric("returning")}
              />
              <MetricCard
                label="Direct"
                value={null}
                color="#F8D0E6"
                light
                selected={audienceMetric === "direct"}
                onSelect={() => setAudienceMetric("direct")}
              />
              <MetricCard
                label="Referral"
                value={null}
                color="#E6D4EA"
                light
                selected={audienceMetric === "referral"}
                onSelect={() => setAudienceMetric("referral")}
              />
            </>
          }
        />

        <section className="grid overflow-hidden rounded-[14px] border border-[#E6E8EC] bg-white lg:grid-cols-2">
          <div className="px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[16px] font-medium text-[#20242A]">
                Audience distribution
              </h3>
              <button
                type="button"
                aria-pressed={distributionTable}
                onClick={() => setDistributionTable((current) => !current)}
                className="inline-flex items-center gap-1.5 text-[13px] text-[#8B939C]"
              >
                <Table2 className="h-3.5 w-3.5" />
                {distributionTable ? "View legend" : "View table"}
              </button>
            </div>
            {distributionTable ? (
              <table className="mt-6 w-full text-left text-[13px] text-[#30343A]">
                <tbody>
                  {AUDIENCE_ROWS.map(([label, color]) => (
                    <tr key={label} className="border-b border-[#F0F2F4]">
                      <td className="py-2">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-[2px]"
                            style={{ backgroundColor: color }}
                          />
                          {label}
                        </span>
                      </td>
                      <td className="py-2 text-right">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <ul className="mx-auto mt-8 flex w-fit flex-col gap-3 text-[14px] text-[#30343A]">
                {AUDIENCE_ROWS.map(([label, color]) => (
                  <li key={label} className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-[2px]"
                      style={{ backgroundColor: color }}
                    />
                    {label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex min-h-[280px] flex-col border-t border-[#E6E8EC] lg:border-l lg:border-t-0">
            <h3 className="px-6 py-5 text-[16px] font-medium text-[#20242A]">
              List of visitors
            </h3>
            <table className="w-full text-[13px] text-[#30343A]">
              <thead>
                <tr className="bg-[#F7F8F9] text-[#8B939C]">
                  <th className="px-6 py-2.5 text-center font-medium">Date</th>
                  <th className="px-6 py-2.5 text-center font-medium">Visitor</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={2} className="px-6 py-10 text-center text-[#8B939C]">
                    No data available
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="mt-auto flex items-center justify-end gap-3 px-4 py-3 text-[13px] text-[#505761]">
              <label className="inline-flex items-center gap-2">
                Items per page:
                <select
                  aria-label="Visitors per page"
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="h-8 rounded-[6px] border border-[#E3E6EA] bg-white px-2"
                >
                  {[5, 10, 25].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <span>0-0 of 0</span>
              <div className="flex items-center gap-1">
                {(
                  [
                    ["First page", ChevronsLeft],
                    ["Previous page", ChevronLeft],
                    ["Next page", ChevronRight],
                    ["Last page", ChevronsRight],
                  ] as const
                ).map(([label, Icon]) => (
                  <button
                    key={label}
                    type="button"
                    aria-label={label}
                    disabled
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#9AA1A9] disabled:opacity-40"
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </section>

      <section id="looker-reports" className="scroll-mt-[84px] space-y-4 pt-4">
        <h2 className="text-[20px] font-medium text-[#20242A]">Reports</h2>
        <ChartBlock
          title="Summary"
          seriesLabel={reportSeries.label}
          seriesColor={reportSeries.color}
          points={reportSeries.points}
          showMarkers
          tooltipSeries={[pages, views, sessions]}
          cards={
            <>
              <MetricCard
                label="Pages"
                value={null}
                color={COLORS.views}
                selected={reportMetric === "pages"}
                onSelect={() => setReportMetric("pages")}
              />
              <MetricCard
                label="Views"
                value={null}
                color="#7BC98A"
                selected={reportMetric === "views"}
                onSelect={() => setReportMetric("views")}
              />
              <MetricCard
                label="Sessions"
                value={null}
                color={COLORS.sessions}
                selected={reportMetric === "sessions"}
                onSelect={() => setReportMetric("sessions")}
              />
            </>
          }
        />
        <ReportList title="List of pages" />
        <ReportList title="List of reports" />
      </section>
    </div>
  );
}
