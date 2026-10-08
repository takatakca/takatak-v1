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
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  SocialSummaryChart,
  type ChartTooltipSeries,
} from "@/components/social/analytics/social-summary-chart";
import { metricValue } from "@/components/social/analytics/social-summary-tokens";
import { withSocialPreview } from "@/components/social/preview/social-preview-query";
import { toClientSocialImageUrl } from "@/lib/social/media/remote-image";
import { TwitchCompetitorsPanel } from "@/components/social/platforms/twitch-competitors-panel";

type CommunityPoint = {
  date: string;
  followers: number | null;
  subscribers: number | null;
  videos: number | null;
  views: number | null;
  durationSeconds: number | null;
};

type MediaRow = {
  title: string;
  publishedOn: string;
  views: number;
  durationSeconds: number;
  url: string | null;
};

type CommunityAnalytics = {
  account?: {
    name?: string;
    handle?: string | null;
    avatarUrl?: string | null;
  };
  followers: number | null;
  subscribers: number | null;
  videos: number | null;
  videosConfirmed?: boolean;
  streamViews?: number | null;
  streamDurationSeconds?: number | null;
  videoList?: MediaRow[];
  clipList?: MediaRow[];
  clipsConfirmed?: boolean;
  points: CommunityPoint[];
  subscriptionTiers?: {
    tier1: number | null;
    tier2: number | null;
    tier3: number | null;
    gifts: number | null;
  };
  subscriptionList?: Array<{ name: string; label: string }>;
  notice: string | null;
  range?: { start: string; end: string };
};

type TwitchSection = "community" | "subscriptions" | "streams" | "competitors";
type SubscriptionMetric = "tier1" | "tier2" | "tier3" | "gifts" | "videos";

const RANGES = [7, 30, 90, 180, 365] as const;

const COLORS = {
  followers: "#8B7EF6",
  subscribers: "#C9E4C4",
  videos: "#E6A12A",
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

function formatMinutes(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function TwitchMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#9146FF"
        d="M4.3 2 2 6.2v13.2h5.1V22l3.6-2.6h4.3L22 13.4V2H4.3Zm15.4 10.6-3.1 3.1h-4.3l-3.1 3.1v-3.1H6.1V4.3h13.6v8.3Z"
      />
      <path fill="#9146FF" d="M16.2 6.6h-1.8v5.2h1.8V6.6Zm-4.8 0H9.6v5.2h1.8V6.6Z" />
    </svg>
  );
}

function TwitchAccountLabel({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl: string | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const label = name.replace(/^@/, "");
  const initial = label.slice(0, 1).toUpperCase() || "T";

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="relative h-10 w-10 shrink-0">
        {imageUrl && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="h-10 w-10 rounded-[8px] object-cover"
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#9146FF] text-[14px] font-semibold text-white">
            {initial}
          </span>
        )}
        <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white">
          <TwitchMark className="h-3.5 w-3.5" />
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
  text,
  onSelect,
}: {
  label: string;
  value: number | null;
  color: string;
  selected: boolean;
  light?: boolean;
  text?: string;
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
        {text ?? formatCount(value)}
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
  hideFlatZero = false,
  tooltipSeries,
}: {
  title: string;
  cards: ReactNode;
  points: Array<{ date: string; value: ReturnType<typeof metricValue> }>;
  seriesLabel: string;
  seriesColor: string;
  showMarkers?: boolean;
  hideFlatZero?: boolean;
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
            hideFlatZero={hideFlatZero}
            tooltipSeries={tooltipSeries}
          />
          <ChartWatermark />
        </div>
      </div>
    </section>
  );
}

function EmptyMediaSearch() {
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

function MediaList({
  title,
  rows,
  confirmed,
  fileName,
}: {
  title: string;
  rows: MediaRow[];
  confirmed: boolean;
  fileName: string;
}) {
  const [query, setQuery] = useState("");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [showDate, setShowDate] = useState(true);
  const [showViews, setShowViews] = useState(true);
  const [showDuration, setShowDuration] = useState(true);
  const filtered = rows.filter((row) =>
    row.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function downloadCsv() {
    const headers = ["Title"];
    if (showDate) headers.push("Date");
    if (showViews) headers.push("Views");
    if (showDuration) headers.push("Duration");
    const body = filtered.map((row) => {
      const cells = [row.title];
      if (showDate) cells.push(row.publishedOn);
      if (showViews) cells.push(String(row.views));
      if (showDuration) cells.push(formatMinutes(row.durationSeconds));
      return cells;
    });
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
    anchor.download = fileName;
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
                  ["Duration", showDuration, setShowDuration],
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
      {!confirmed ? (
        <p className="px-2 py-16 text-center text-[14px] text-[#8B939C]">
          Twitch did not return this list.
        </p>
      ) : filtered.length === 0 ? (
        <EmptyMediaSearch />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[13px] text-[#30343A]">
            <thead>
              <tr className="border-b border-[#EEF0F2] text-[#8B939C]">
                <th className="py-2 pr-4 font-medium">Title</th>
                {showDate ? <th className="py-2 pr-4 font-medium">Date</th> : null}
                {showViews ? <th className="py-2 pr-4 font-medium">Views</th> : null}
                {showDuration ? <th className="py-2 font-medium">Duration</th> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={`${row.publishedOn}-${row.title}`} className="border-b border-[#F4F6F8]">
                  <td className="py-3 pr-4">
                    {row.url ? (
                      <a href={row.url} target="_blank" rel="noreferrer" className="hover:underline">
                        {row.title}
                      </a>
                    ) : (
                      row.title
                    )}
                  </td>
                  {showDate ? <td className="py-3 pr-4">{periodLabel(row.publishedOn)}</td> : null}
                  {showViews ? <td className="py-3 pr-4">{formatCount(row.views)}</td> : null}
                  {showDuration ? (
                    <td className="py-3">{formatMinutes(row.durationSeconds)}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function TwitchSubscribedDashboard({
  activeBrandId,
  canManage,
  connectedLabel,
  profileImageUrl,
}: {
  activeBrandId: string | null;
  canManage: boolean;
  connectedLabel: string | null;
  profileImageUrl: string | null;
}) {
  const searchParams = useSearchParams();
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [section, setSection] = useState<TwitchSection>("community");
  const [growthMetric, setGrowthMetric] = useState<
    "followers" | "subscribers" | "videos"
  >("followers");
  const [subscriptionMetric, setSubscriptionMetric] =
    useState<SubscriptionMetric>("tier1");
  const [streamMetric, setStreamMetric] = useState<"views" | "duration" | "videos">(
    "views",
  );
  const [distributionTable, setDistributionTable] = useState(false);
  const [subscriberPage, setSubscriberPage] = useState(0);
  const [subscriberPageSize, setSubscriberPageSize] = useState(5);
  const [analytics, setAnalytics] = useState<CommunityAnalytics | null>(null);
  const [loadedRange, setLoadedRange] = useState<{ start: string; end: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
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

    const params = new URLSearchParams({
      start: display.start,
      end: display.end,
    });

    const timer = window.setTimeout(() => controller.abort(), 15_000);

    fetch(`/api/social/twitch/analytics?${params.toString()}`, {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as CommunityAnalytics & {
          ok?: boolean;
          message?: string;
          connected?: boolean;
        };
        if (!response.ok || body.ok === false) {
          throw new Error(body.message || "Twitch analytics could not be loaded.");
        }
        if (body.connected === false) {
          throw new Error(body.notice || "No connected Twitch channel is selected.");
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
            ? "Twitch took too long to answer."
            : reason instanceof Error
              ? reason.message
              : "Twitch analytics could not be loaded.",
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

  const responseMatches =
    loadedRange?.start === display.start && loadedRange?.end === display.end;
  const points = responseMatches ? (analytics?.points ?? []) : [];

  function series(
    key: keyof CommunityPoint,
    label: string,
    color: string,
    liveTotal: number | null = null,
  ) {
    const source = points.length
      ? points
      : enumerateDates(display.start, display.end).map((date) => ({
          date,
          followers: null,
          subscribers: null,
          videos: null,
          views: null,
          durationSeconds: null,
        }));
    return {
      label,
      color,
      points: source.map((point) => {
        const daily = point[key];
        const value =
          typeof daily === "number" ? daily : liveTotal === 0 ? 0 : null;
        return {
          date: point.date,
          value: metricValue(value),
        };
      }),
    };
  }

  const followerSeries = series(
    "followers",
    "Followers",
    COLORS.followers,
    responseMatches ? (analytics?.followers ?? null) : null,
  );
  const videoSeries = series(
    "videos",
    "Videos",
    COLORS.videos,
    responseMatches ? (analytics?.videos ?? null) : null,
  );
  const subscriberSeries = series(
    "subscribers",
    "Subscribers",
    "#7BC98A",
    responseMatches ? (analytics?.subscribers ?? null) : null,
  );
  const growthSeries =
    growthMetric === "subscribers"
      ? subscriberSeries
      : growthMetric === "videos"
        ? videoSeries
        : followerSeries;
  const growthTooltip: ChartTooltipSeries[] = [followerSeries, videoSeries];
  const viewSeries = series(
    "views",
    "Views",
    COLORS.followers,
    responseMatches ? (analytics?.streamViews ?? null) : null,
  );
  const durationSeries = {
    label: "Duration",
    color: "#7BC98A",
    points: (points.length
      ? points
      : enumerateDates(display.start, display.end).map((date) => ({
          date,
          durationSeconds: null as number | null,
        }))
    ).map((point) => ({
      date: point.date,
      value: metricValue(
        typeof point.durationSeconds === "number"
          ? Math.round(point.durationSeconds / 60)
          : responseMatches && analytics?.streamDurationSeconds === 0
            ? 0
            : null,
      ),
    })),
  };
  const streamSeries =
    streamMetric === "duration"
      ? durationSeries
      : streamMetric === "videos"
        ? videoSeries
        : viewSeries;
  const streamTooltip: ChartTooltipSeries[] = [viewSeries, videoSeries];

  const balanceSeries = series("followers", "Followers", COLORS.balance);
  const handle =
    analytics?.account?.handle?.replace(/^@/, "") ||
    connectedLabel?.replace(/^@/, "") ||
    "Twitch channel";
  const avatar =
    toClientSocialImageUrl(analytics?.account?.avatarUrl) ?? profileImageUrl;

  async function reconnect() {
    if (!canManage || !activeBrandId || reconnecting) return;
    setReconnecting(true);
    setReconnectError(null);
    try {
      const response = await fetch("/api/social/connections/start", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "twitch",
          businessBrandId: activeBrandId,
          returnPath: withSocialPreview("/dashboard/social/twitch", searchParams),
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        authorization?: { authorizationUrl?: string };
      };
      const authorizationUrl = result.authorization?.authorizationUrl;
      if (!response.ok || !result.ok || !authorizationUrl) {
        setReconnectError(result.message ?? "Twitch reconnect could not be started.");
        setReconnecting(false);
        return;
      }
      window.location.assign(authorizationUrl);
    } catch {
      setReconnectError("Twitch reconnect could not be started.");
      setReconnecting(false);
    }
  }

  const needsReconnect = Boolean(responseMatches && analytics?.notice?.includes("Reconnect"));
  const subscriberRows = responseMatches ? (analytics?.subscriptionList ?? []) : [];
  const subscriberPageCount = Math.max(
    1,
    Math.ceil(subscriberRows.length / subscriberPageSize),
  );
  const safeSubscriberPage = Math.min(subscriberPage, subscriberPageCount - 1);
  const visibleSubscribers = subscriberRows.slice(
    safeSubscriberPage * subscriberPageSize,
    safeSubscriberPage * subscriberPageSize + subscriberPageSize,
  );
  const subscriberFrom = subscriberRows.length
    ? safeSubscriberPage * subscriberPageSize + 1
    : 0;
  const subscriberTo = subscriberRows.length
    ? Math.min(subscriberRows.length, (safeSubscriberPage + 1) * subscriberPageSize)
    : 0;
  const tiers = responseMatches ? analytics?.subscriptionTiers : undefined;

  function levelSeries(label: string, color: string, total: number | null) {
    const dates = points.length
      ? points.map((point) => point.date)
      : enumerateDates(display.start, display.end);
    return {
      label,
      color,
      points: dates.map((date) => ({
        date,
        value: metricValue(total === 0 ? 0 : null),
      })),
    };
  }

  const tierSeries = {
    tier1: levelSeries("Tier 1", COLORS.followers, tiers?.tier1 ?? null),
    tier2: levelSeries("Tier 2", "#7BC98A", tiers?.tier2 ?? null),
    tier3: levelSeries("Tier 3", "#F2A6D6", tiers?.tier3 ?? null),
    gifts: levelSeries("Gifts", "#C9A4CC", tiers?.gifts ?? null),
  };
  const subscriptionSeries =
    subscriptionMetric === "videos" ? videoSeries : tierSeries[subscriptionMetric];
  const subscriptionTooltip: ChartTooltipSeries[] = [
    tierSeries.tier1,
    videoSeries,
  ];

  function scrollToSection(next: TwitchSection) {
    setSection(next);
    document.getElementById(`twitch-${next}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  useEffect(() => {
    const sections = (["community", "subscriptions", "streams", "competitors"] as const)
      .map((key) => document.getElementById(`twitch-${key}`))
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
        if (!visibleId?.startsWith("twitch-")) return;
        const next = visibleId.slice("twitch-".length);
        if (
          next === "community" ||
          next === "subscriptions" ||
          next === "streams" ||
          next === "competitors"
        ) {
          setSection(next);
        }
      },
      { rootMargin: "-160px 0px -55% 0px", threshold: [0, 0.1, 0.25, 0.5] },
    );
    for (const node of sections) observer.observe(node);
    return () => observer.disconnect();
  }, [responseMatches]);

  return (
    <div className="space-y-4 bg-white text-[#20242A]">
      <div className="flex flex-col gap-4 bg-white pb-1 lg:flex-row lg:items-end lg:justify-between">
        <div role="tablist" aria-label="Twitch analytics" className="flex items-end gap-6">
          {(
            [
              ["community", "COMMUNITY", true],
              ["subscriptions", "SUBSCRIPTIONS", true],
              ["streams", "STREAMS", true],
              ["competitors", "COMPETITORS", true],
            ] as const
          ).map(([key, label, enabled]) => {
            const selected = enabled && section === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-disabled={!enabled}
                tabIndex={enabled ? 0 : -1}
                onClick={() => {
                  if (
                    key === "community" ||
                    key === "subscriptions" ||
                    key === "streams" ||
                    key === "competitors"
                  ) {
                    scrollToSection(key);
                  }
                }}
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
                aria-label="Twitch date range"
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

      {needsReconnect ? (
        <div className="flex flex-col gap-3 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <p>{analytics?.notice}</p>
          <button
            type="button"
            onClick={() => void reconnect()}
            disabled={!canManage || !activeBrandId || reconnecting}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-[9px] bg-[#9146FF] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {reconnecting ? "Opening Twitch…" : "Reconnect Twitch"}
          </button>
        </div>
      ) : null}

      {reconnectError ? (
        <p className="text-sm text-rose-700" role="alert">
          {reconnectError}
        </p>
      ) : null}

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

      {responseMatches && analytics?.notice && !needsReconnect ? (
        <p className="text-sm text-[#5F6770]">{analytics.notice}</p>
      ) : null}

      <section id="twitch-community" className="scroll-mt-[84px] space-y-4">
        <div className="flex items-center justify-between gap-4 pt-2">
          <h1 className="flex items-center gap-3 text-[20px] font-medium text-[#20242A]">
            Community
            {loading && !responseMatches ? (
              <span className="text-[12px] font-normal text-[#9AA1A9]">Loading</span>
            ) : null}
          </h1>
          <TwitchAccountLabel name={handle} imageUrl={avatar} />
        </div>

        <ChartBlock
          title="Growth"
          seriesLabel={growthSeries.label}
          seriesColor={growthSeries.color}
          points={growthSeries.points}
          showMarkers
          hideFlatZero
          tooltipSeries={growthTooltip}
          cards={
            <>
              <MetricCard
                label="Followers"
                value={responseMatches ? (analytics?.followers ?? null) : null}
                color={COLORS.followers}
                selected={growthMetric === "followers"}
                onSelect={() => setGrowthMetric("followers")}
              />
              <MetricCard
                label="Subscribers"
                value={responseMatches ? (analytics?.subscribers ?? null) : null}
                color={COLORS.subscribers}
                light
                selected={growthMetric === "subscribers"}
                onSelect={() => setGrowthMetric("subscribers")}
              />
              <MetricCard
                label="Videos"
                value={responseMatches ? (analytics?.videos ?? null) : null}
                color={COLORS.videos}
                selected={growthMetric === "videos"}
                onSelect={() => setGrowthMetric("videos")}
              />
            </>
          }
        />

        <ChartBlock
          title="Balance of Followers"
          seriesLabel={balanceSeries.label}
          seriesColor={balanceSeries.color}
          points={balanceSeries.points}
          hideFlatZero
          cards={
            <MetricCard
              label="Followers"
              value={responseMatches ? (analytics?.followers ?? null) : null}
              color={COLORS.balance}
              selected
              onSelect={() => undefined}
            />
          }
        />
      </section>

      <section id="twitch-subscriptions" className="scroll-mt-[84px] space-y-4 pt-4">
        <h2 className="text-[20px] font-medium text-[#20242A]">Subscriptions</h2>

        <ChartBlock
          title="Subscribers"
          seriesLabel={subscriptionSeries.label}
          seriesColor={subscriptionSeries.color}
          points={subscriptionSeries.points}
          showMarkers
          hideFlatZero
          tooltipSeries={subscriptionTooltip}
          cards={
            <>
              <MetricCard
                label="Tier 1"
                value={tiers?.tier1 ?? null}
                color="#8B7EF6"
                selected={subscriptionMetric === "tier1"}
                onSelect={() => setSubscriptionMetric("tier1")}
              />
              <MetricCard
                label="Tier 2"
                value={tiers?.tier2 ?? null}
                color="#C9E4C4"
                light
                selected={subscriptionMetric === "tier2"}
                onSelect={() => setSubscriptionMetric("tier2")}
              />
              <MetricCard
                label="Tier 3"
                value={tiers?.tier3 ?? null}
                color="#F8D0E6"
                light
                selected={subscriptionMetric === "tier3"}
                onSelect={() => setSubscriptionMetric("tier3")}
              />
              <MetricCard
                label="Gifts"
                value={tiers?.gifts ?? null}
                color="#E6D4EA"
                light
                selected={subscriptionMetric === "gifts"}
                onSelect={() => setSubscriptionMetric("gifts")}
              />
              <MetricCard
                label="Videos"
                value={responseMatches ? (analytics?.videos ?? null) : null}
                color={COLORS.videos}
                selected={subscriptionMetric === "videos"}
                onSelect={() => setSubscriptionMetric("videos")}
              />
            </>
          }
        />

        <section className="grid overflow-hidden rounded-[14px] border border-[#E6E8EC] bg-white lg:grid-cols-2">
          <div className="px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[16px] font-medium text-[#20242A]">
                Subscribers distribution
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
                  {(
                    [
                      ["Tier 1", tiers?.tier1 ?? null, "#8B7EF6"],
                      ["Tier 2", tiers?.tier2 ?? null, "#7BC98A"],
                      ["Tier 3", tiers?.tier3 ?? null, "#F2A6D6"],
                      ["Gifts", tiers?.gifts ?? null, "#C9A4CC"],
                    ] as const
                  ).map(([label, value, color]) => (
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
                      <td className="py-2 text-right">{formatCount(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <ul className="mx-auto mt-8 flex w-fit flex-col gap-3 text-[14px] text-[#30343A]">
                {(
                  [
                    ["Tier 1", "#8B7EF6"],
                    ["Tier 2", "#7BC98A"],
                    ["Tier 3", "#F2A6D6"],
                    ["Gifts", "#C9A4CC"],
                  ] as const
                ).map(([label, color]) => (
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
              List of subscribers
            </h3>
            <table className="w-full text-[13px] text-[#30343A]">
              <thead>
                <tr className="bg-[#F7F8F9] text-[#8B939C]">
                  <th className="px-6 py-2.5 text-center font-medium">Date</th>
                  <th className="px-6 py-2.5 text-center font-medium">Subscription</th>
                </tr>
              </thead>
              <tbody>
                {visibleSubscribers.length ? (
                  visibleSubscribers.map((row) => (
                    <tr key={`${row.label}-${row.name}`} className="border-b border-[#F0F2F4]">
                      <td className="px-6 py-3 text-center text-[#8B939C]">—</td>
                      <td className="px-6 py-3 text-center">
                        {row.label} · {row.name}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-6 py-10 text-center text-[#8B939C]">
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="mt-auto flex items-center justify-end gap-3 px-4 py-3 text-[13px] text-[#505761]">
              <label className="inline-flex items-center gap-2">
                Items per page:
                <select
                  aria-label="Subscribers per page"
                  value={subscriberPageSize}
                  onChange={(event) => {
                    setSubscriberPageSize(Number(event.target.value));
                    setSubscriberPage(0);
                  }}
                  className="h-8 rounded-[6px] border border-[#E3E6EA] bg-white px-2"
                >
                  {[5, 10, 25].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <span>
                {subscriberFrom}-{subscriberTo} of {subscriberRows.length}
              </span>
              <div className="flex items-center gap-1">
                {(
                  [
                    ["First page", () => setSubscriberPage(0), ChevronsLeft],
                    [
                      "Previous page",
                      () => setSubscriberPage((current) => Math.max(0, current - 1)),
                      ChevronLeft,
                    ],
                    [
                      "Next page",
                      () =>
                        setSubscriberPage((current) =>
                          Math.min(subscriberPageCount - 1, current + 1),
                        ),
                      ChevronRight,
                    ],
                    [
                      "Last page",
                      () => setSubscriberPage(subscriberPageCount - 1),
                      ChevronsRight,
                    ],
                  ] as const
                ).map(([label, action, Icon]) => (
                  <button
                    key={label}
                    type="button"
                    aria-label={label}
                    onClick={action}
                    disabled={!subscriberRows.length}
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

      <section id="twitch-streams" className="scroll-mt-[84px] space-y-4 pt-4">
        <h2 className="text-[20px] font-medium text-[#20242A]">Streams</h2>
        <ChartBlock
          title="Summary"
          seriesLabel={streamSeries.label}
          seriesColor={streamSeries.color}
          points={streamSeries.points}
          showMarkers
          hideFlatZero
          tooltipSeries={streamTooltip}
          cards={
            <>
              <MetricCard
                label="Views"
                value={responseMatches ? (analytics?.streamViews ?? null) : null}
                color={COLORS.followers}
                selected={streamMetric === "views"}
                onSelect={() => setStreamMetric("views")}
              />
              <MetricCard
                label="Duration"
                value={
                  responseMatches ? (analytics?.streamDurationSeconds ?? null) : null
                }
                text={formatMinutes(
                  responseMatches ? analytics?.streamDurationSeconds : null,
                )}
                color="#7BC98A"
                selected={streamMetric === "duration"}
                onSelect={() => setStreamMetric("duration")}
              />
              <MetricCard
                label="Videos"
                value={responseMatches ? (analytics?.videos ?? null) : null}
                color={COLORS.videos}
                selected={streamMetric === "videos"}
                onSelect={() => setStreamMetric("videos")}
              />
            </>
          }
        />
        <MediaList
          title="List of videos"
          rows={responseMatches ? (analytics?.videoList ?? []) : []}
          confirmed={!responseMatches || analytics?.videosConfirmed !== false}
          fileName={`twitch-videos-${display.start}-to-${display.end}.csv`}
        />
        <MediaList
          title="List of clips"
          rows={responseMatches ? (analytics?.clipList ?? []) : []}
          confirmed={!responseMatches || analytics?.clipsConfirmed !== false}
          fileName={`twitch-clips-${display.start}-to-${display.end}.csv`}
        />
      </section>

      <section id="twitch-competitors" className="scroll-mt-[84px] space-y-4 pt-4">
        <h2 className="text-[20px] font-medium text-[#20242A]">Competitors</h2>
        <TwitchCompetitorsPanel
          start={display.start}
          end={display.end}
          canManage={canManage}
        />
      </section>
    </div>
  );
}
