"use client";

import { ArrowUpRight, CalendarDays, ChevronDown, CircleAlert, Info, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { YoutubeCommunitySnapshot, YoutubeGrowthDay } from "@/lib/social/providers/youtube-community-analytics";
import { YoutubeVideoSectionView } from "@/components/social/platforms/youtube-video-sections";
import type { YoutubeVideoPerformance } from "@/lib/social/providers/youtube-video-performance";

type ReportResponse = {
  ok?: boolean;
  message?: string;
  current?: YoutubeCommunitySnapshot;
  previous?: YoutubeCommunitySnapshot | null;
  videos?: { ok: true; report: YoutubeVideoPerformance } | { ok: false; message: string };
};

const SECTION_LINKS = [
  { id: "community", title: "Community" },
  { id: "published-videos", title: "Published videos" },
  { id: "viewed-videos", title: "Viewed videos" },
  { id: "competitors", title: "Competitors" },
] as const;

const METRICS = [
  { id: "subscribers", label: "Subscribers", totalKey: "subscribers", accent: "blue" },
  { id: "views", label: "Video views", totalKey: "views", accent: "cyan" },
  { id: "revenue", label: "Revenue", totalKey: "revenue", accent: "purple" },
  { id: "videos", label: "Videos", totalKey: "videos", accent: "amber" },
] as const;

type Metric = (typeof METRICS)[number]["id"];
type ReportDays = 7 | 30 | 90 | 365;
const DURATION_OPTIONS: { days: ReportDays; label: string }[] = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last 365 days" },
];

function displayNumber(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("en-CA", { maximumFractionDigits: 1 }).format(value);
}

function displayCurrency(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);
}

function displayDate(value: string): string {
  const date = new Date(value + "T12:00:00Z");
  return new Intl.DateTimeFormat("en-CA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function dailySeries(metric: Metric, points: YoutubeGrowthDay[]): Array<{ label: string; value: number | null }> {
  // The YouTube Data API only exposes current subscriber/video totals.
  // Do NOT fabricate a historical subscribers / uploads series.
  return metric === "videos"
    ? []
    : points.map((point) => ({ label: point.day, value: point[metric] }));
}

function TrendGraph({ series, metric }: { series: Array<{ label: string; value: number | null }>; metric: Metric }) {
  const known = series.filter((point): point is { label: string; value: number } => point.value !== null);
  if (metric === "videos") {
    return <p className="flex min-h-[230px] items-center justify-center text-center text-sm text-slate-500">Channel video count is a current total; a daily upload history is not available in this report.</p>;
  }
  if (!known.length) {
    return <p className="flex min-h-[230px] items-center justify-center text-center text-sm text-slate-500">No verified YouTube data is available for this metric and period.</p>;
  }
  const width = 1000;
  const height = 250;
  const left = 50;
  const top = 20;
  const right = 18;
  const bottom = 46;
  const values = known.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const spread = maxValue - minValue;
  const rangeMin = spread ? minValue - spread * 0.1 : minValue - Math.max(1, Math.abs(minValue) * 0.1);
  const rangeMax = spread ? maxValue + spread * 0.1 : maxValue + Math.max(1, Math.abs(maxValue) * 0.1);
  const x = (index: number) => left + index / Math.max(1, series.length - 1) * (width - left - right);
  const y = (value: number) => top + (rangeMax - value) / (rangeMax - rangeMin) * (height - top - bottom);
  const groups: string[] = [];
  let segment: string[] = [];
  for (let i = 0; i < series.length; i++) {
    const value = series[i].value;
    if (value === null) {
      if (segment.length) groups.push(segment.join(" "));
      segment = [];
    } else {
      segment.push((segment.length ? "L" : "M") + x(i).toFixed(2) + "," + y(value).toFixed(2));
    }
  }
  if (segment.length) groups.push(segment.join(" "));
  const ticks = [0, 1, 2, 3, 4];
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={"0 0 " + width + " " + height} role="img" aria-label={"YouTube " + (metric === "subscribers" ? "daily net subscriber change" : metric === "views" ? "daily video views" : "estimated daily revenue") + " trend"} className="w-full min-w-[420px]">
        {ticks.map((tick) => {
          const value = rangeMin + (rangeMax - rangeMin) * (4 - tick) / 4;
          const yy = y(value);
          return <g key={tick}>
            <line x1={left} y1={yy} x2={width-right} y2={yy} stroke="#E7ECF4" strokeDasharray="4 4" />
            <text x={left-10} y={yy+4} fontSize="12" textAnchor="end" fill="#64748b">{Number(value.toFixed(1)).toLocaleString("en-CA")}</text>
          </g>;
        })}
        {groups.map((path, i) => <path key={i} d={path} fill="none" stroke="#1565D8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}
        {series.map((point, i) =>
          point.value !== null && (series.length <= 50 || i % 10 === 0)
            ? <circle key={point.label} cx={x(i)} cy={y(point.value)} r="3.5" fill="#1565D8"><title>{displayDate(point.label) + ": " + (metric === "revenue" ? displayCurrency(point.value) : displayNumber(point.value))}</title></circle>
            : null,
        )}
        {[0, Math.floor((series.length-1)/4), Math.floor((series.length-1)/2), Math.floor((series.length-1)*3/4), series.length-1]
          .filter((index, i, all) => all.indexOf(index) === i && series[index])
          .map((index) => <text key={index} x={x(index)} y={height-14} fontSize="12" textAnchor="middle" fill="#64748b">{displayDate(series[index].label).replace(/, \d{4}$/, "")}</text>)}
      </svg>
    </div>
  );
}

function MetricCards({ snapshot, selected, onSelect }: {
  snapshot: YoutubeCommunitySnapshot;
  selected: Metric;
  onSelect: (metric: Metric) => void;
}) {
  const values: Record<Metric, number | null> = {
    subscribers: snapshot.channel.subscribers,
    views: snapshot.totals.views,
    revenue: snapshot.totals.revenue,
    videos: snapshot.channel.videos,
  };
  return <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
    {METRICS.map((metric) => (
      <button
        key={metric.id}
        type="button"
        onClick={() => onSelect(metric.id)}
        aria-pressed={selected === metric.id}
        className={"min-w-0 rounded-xl border px-3 py-3 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 " + (
          selected === metric.id
            ? "border-[#1F8BFF] bg-[#EAF4FF] shadow-sm"
            : "border-slate-200 bg-slate-50 hover:bg-slate-100"
        )}
      >
        <span className="block text-2xl font-semibold tabular-nums text-slate-950">{metric.id === "revenue" ? displayCurrency(values[metric.id]) : displayNumber(values[metric.id])}</span>
        <span className="mt-1 block text-xs text-slate-600">{metric.label}</span>
      </button>
    ))}
  </div>;
}

export function YoutubeAnalyticsDashboard({
  billingExempt,
  hasPaidPlan,
  historyDays,
  canCompare,
  billingHref,
}: {
  billingExempt: boolean;
  hasPaidPlan: boolean;
  historyDays: number | null;
  canCompare: boolean;
  billingHref: string;
}) {
  const [days, setDays] = useState<ReportDays>(30);
  const [compare, setCompare] = useState(false);
  const [metric, setMetric] = useState<Metric>("subscribers");
  const [data, setData] = useState<ReportResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshCounter, refresh] = useState(0);
  const [showHelp, setShowHelp] = useState(true);
  const [activeSection, setActiveSection] = useState<string>("community");
  const isLocked = !hasPaidPlan;
  const rangeIsAllowed = historyDays === null || days <= historyDays;
  const fetchReport = useCallback(async (controller: AbortController) => {
    setBusy(true);
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (compare && canCompare) params.set("compare", "previous");
      const response = await fetch("/api/social/youtube/analytics?" + params, {
        signal: controller.signal,
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const body = await response.json() as ReportResponse;
      if (!controller.signal.aborted) setData(response.ok ? body : { ok: false, message: body.message ?? "YouTube Analytics could not be loaded." });
    } catch {
      if (!controller.signal.aborted) setData({ ok: false, message: "YouTube Analytics could not be loaded. Try refreshing." });
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [days, compare, canCompare]);
  useEffect(() => {
    if (isLocked || !rangeIsAllowed) return;
    const controller = new AbortController();
    void fetchReport(controller);
    return () => controller.abort();
  }, [fetchReport, isLocked, rangeIsAllowed, refreshCounter]);

  const current = data?.current;
  const series = useMemo(() => current ? dailySeries(metric, current.points) : [], [current, metric]);

  function scrollToSection(id: string) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-7 px-1 pb-20 pt-3 text-slate-950">
      <nav aria-label="YouTube analytics sections" className="sticky top-0 z-20 flex flex-col gap-4 border-b border-slate-200 bg-white/95 pb-4 pt-3 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {SECTION_LINKS.map(({ id, title }) => (
            <a key={id} href={"#" + id} onClick={(event) => { event.preventDefault(); scrollToSection(id); }}
              aria-current={activeSection === id ? "location" : undefined}
              className={"border-b-2 pb-2 text-xs font-semibold uppercase tracking-wide transition " + (activeSection === id ? "border-[#1565D8] text-[#1565D8]" : "border-transparent text-slate-600 hover:text-slate-950")}>
              {title}
            </a>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Main period
            <span className="relative inline-flex items-center">
              <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 h-4 w-4" />
              <select value={days} onChange={(event) => setDays(Number(event.target.value) as ReportDays)}
                disabled={isLocked}
                className="h-10 appearance-none rounded-lg border border-slate-300 bg-white pl-9 pr-8 text-sm text-slate-900">
                {DURATION_OPTIONS.map((option) =>
                  <option key={option.days} value={option.days} disabled={historyDays !== null && option.days > historyDays}>
                    {option.label}
                  </option>
                )}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 h-4 w-4" />
            </span>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Comparison period
            <span className="relative inline-flex items-center">
              <select value={compare ? "previous" : "none"} onChange={(event) => setCompare(event.target.value === "previous")}
                disabled={!canCompare || isLocked}
                title={!canCompare ? "Comparison is unavailable on this subscription plan" : undefined}
                className="h-10 appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-8 text-sm text-slate-900">
                <option value="none">No comparison</option>
                {canCompare ? <option value="previous">Previous period</option> : null}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 h-4 w-4" />
            </span>
          </label>
        </div>
      </nav>

      {isLocked && !billingExempt ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-[#F6F9FF] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Activate YouTube Analytics</h2>
            <p className="mt-1 text-sm text-slate-600">Choose a TAKATAK Social subscription to view channel performance and growth.</p>
          </div>
          <Link href={billingHref} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#1565D8] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0e4ba7]">
            View subscriptions <ArrowUpRight size={16} />
          </Link>
        </div>
      ) : null}

      {showHelp ? <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-[#EFF6FF] p-4 text-sm text-slate-700">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#1565D8]" aria-hidden="true" />
        <p className="flex-1">YouTube reporting may be delayed by several days. Subscriber counts and channel totals come from YouTube; historical daily figures are shown only when the API returns them.</p>
        <button type="button" aria-label="Dismiss reporting notice" onClick={() => setShowHelp(false)} className="rounded px-2 py-1 font-medium hover:bg-blue-100">×</button>
      </div> : null}

      <section id="community" aria-labelledby="youtube-community-heading" className="scroll-mt-36 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="youtube-community-heading" className="text-2xl font-semibold">Community</h2>
          <div className="flex items-center gap-3 text-sm">
            {current ? <span className="text-slate-500">{current.channel.name}</span> : null}
            {hasPaidPlan ? <button type="button" onClick={() => refresh((count) => count+1)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[#1565D8] hover:bg-blue-50 disabled:opacity-50">
              <RefreshCw aria-hidden="true" size={15} /> Refresh
            </button> : null}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-medium">Growth</h3>
              <p className="mt-1 text-xs text-slate-500">
                {metric === "subscribers" ? "Daily net subscriber change" : metric === "views" ? "Daily video views" : metric === "revenue" ? "Estimated daily revenue (CAD)" : "Current channel video count"}
              </p>
            </div>
            {current ? <MetricCards snapshot={current} selected={metric} onSelect={setMetric} /> : null}
          </div>
          {isLocked ? (
            <div className="flex min-h-[230px] items-center justify-center text-center text-sm text-slate-500">Sign up for TAKATAK Social to unlock real YouTube Analytics.</div>
          ) : busy && !current ? (
            <div aria-live="polite" className="flex min-h-[230px] items-center justify-center text-sm text-slate-500">Loading verified YouTube Analytics…</div>
          ) : data?.ok && current ? (
            <TrendGraph series={series} metric={metric} />
          ) : (
            <div role="status" className="flex min-h-[230px] flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
              <CircleAlert aria-hidden="true" size={20} />
              <span>{data?.message ?? "YouTube Analytics has not loaded yet."}</span>
            </div>
          )}
          {current ? <p className="mt-3 text-right text-xs text-slate-500">
            {displayDate(current.range.start)} – {displayDate(current.range.end)} · Retrieved {new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(current.retrievedAt))}
          </p> : null}
          {data?.previous ? <p className="mt-3 text-xs text-slate-500">Previous period: {displayNumber(data.previous.totals.views)} views, {displayNumber(data.previous.totals.subscriberChange)} net subscribers.</p> : null}
        </div>
      </section>

      <YoutubeVideoSectionView
        kind="published"
        data={data?.videos?.ok ? data.videos.report.published : null}
        busy={busy}
        locked={isLocked}
        error={data?.videos && !data.videos.ok ? data.videos.message : data?.message ?? null}
      />
      <YoutubeVideoSectionView
        kind="viewed"
        data={data?.videos?.ok ? data.videos.report.viewed : null}
        busy={busy}
        locked={isLocked}
        error={data?.videos && !data.videos.ok ? data.videos.message : data?.message ?? null}
      />
      {/* Competitors content will be built from the owner's remaining screenshots. */}
      <section id="competitors" aria-label="Competitors" className="scroll-mt-36" />
    </div>
  );
}
