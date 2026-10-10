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
  Info,
  LayoutDashboard,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { SocialSummaryChart } from "@/components/social/analytics/social-summary-chart";
import {
  displayDate,
  enumerateDates,
  metricValue,
} from "@/components/social/analytics/social-summary-tokens";
import { withSocialPreview } from "@/components/social/preview/social-preview-query";
import { toClientSocialImageUrl } from "@/lib/social/media/remote-image";

type TikTokTab = "community" | "posts";
type GrowthMetric = "followers" | "posts";
type ViewsMetric = "views" | "posts";
type InteractionMetric =
  | "interactions"
  | "likes"
  | "comments"
  | "shares"
  | "posts";

type DailyPoint = {
  date: string;
  posts: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  interactions: number | null;
  followerBalance: number | null;
  followerGrowth: number | null;
};

type TikTokPost = {
  id: string;
  caption: string;
  type: "Video";
  publishedAt: string;
  publishedOn: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  permalinkUrl: string | null;
};

type AnalyticsResponse = {
  ok?: boolean;
  connected?: boolean;
  message?: string;
  notice?: string | null;
  reauthorizationRequired?: boolean;
  missingScopes?: string[];
  videosConfirmed?: boolean;
  account?: {
    name?: string;
    handle?: string | null;
    avatarUrl?: string | null;
  };
  followers?: number | null;
  posts?: TikTokPost[];
  points?: DailyPoint[];
  range?: { start: string; end: string };
};

type PostColumn =
  | "posts"
  | "type"
  | "date"
  | "views"
  | "likes"
  | "comments"
  | "shares"
  | "duration";

const RANGES = [7, 30, 90, 180, 365] as const;
const PAGE_SIZES = [5, 10, 25] as const;

const COLUMN_LABELS: Record<PostColumn, string> = {
  posts: "Posts",
  type: "Type",
  date: "Date",
  views: "Views",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  duration: "Duration",
};

const COLORS = {
  followers: "#8B7EF6",
  posts: "#E6A12A",
  balance: "#7BC98A",
  views: "#8B7EF6",
  interactions: "#8B7EF6",
  likes: "#7BC98A",
  comments: "#F2A6D6",
  shares: "#C9A4CC",
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

function formatCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${minutes}:${remain.toString().padStart(2, "0")}`;
}

function sumPoints(
  points: DailyPoint[],
  key: keyof DailyPoint,
): number | null {
  const values = points
    .map((point) => point[key])
    .filter((value): value is number => typeof value === "number");
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0);
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
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
        <span
          key={index}
          className="select-none text-[28px] font-medium text-[#E7E9ED]"
        >
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
  framed = false,
}: {
  title: string;
  cards: ReactNode;
  points: Array<{ date: string; value: ReturnType<typeof metricValue> }>;
  seriesLabel: string;
  seriesColor: string;
  framed?: boolean;
}) {
  const chart = (
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
          hideFlatZero
        />
        <ChartWatermark />
      </div>
    </div>
  );

  if (!framed) {
    return <section className="relative">{chart}</section>;
  }

  return (
    <section className="rounded-[14px] border border-[#E6E8EC] bg-white px-5 pb-2 pt-4 sm:px-6">
      {chart}
    </section>
  );
}

function PlanDiamond({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 20 8-9-3-6H7l-3 6 8 9Z" />
      <path d="M4 11h16M9 5l3 6 3-6" />
    </svg>
  );
}

function PremiumDiamond() {
  return (
    <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#C6F54A] text-[#4E6310]">
      <PlanDiamond className="h-3 w-3" />
    </span>
  );
}

function TikTokMark({ className = "h-5 w-5" }: { className?: string }) {
  const note =
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z";

  return (
    <svg viewBox="-0.8 -0.6 25.6 25.2" aria-hidden="true" className={className}>
      <path fill="#25F4EE" d={note} transform="translate(-0.55 0.35)" />
      <path fill="#FE2C55" d={note} transform="translate(0.55 -0.25)" />
      <path fill="#111111" d={note} />
    </svg>
  );
}

function TikTokAccountLabel({
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
          <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#161616] text-[14px] font-semibold text-white">
            {initial}
          </span>
        )}
        <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white">
          <TikTokMark className="h-3.5 w-3.5" />
        </span>
      </span>
      <span
        className="truncate text-[15px] font-medium text-[#20242A]"
        title={label}
      >
        {label}
      </span>
    </div>
  );
}

export function TikTokSubscribedDashboard({
  accountName,
  profileImageUrl = null,
  activeBrandId,
  canManage,
}: {
  accountName: string;
  profileImageUrl?: string | null;
  activeBrandId: string | null;
  canManage: boolean;
}) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TikTokTab>("community");
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [growthMetric, setGrowthMetric] = useState<GrowthMetric>("followers");
  const [viewsMetric, setViewsMetric] = useState<ViewsMetric>("views");
  const [interactionMetric, setInteractionMetric] =
    useState<InteractionMetric>("interactions");
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(5);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<PostColumn[]>([
    "posts",
    "type",
    "date",
    "views",
    "likes",
    "comments",
    "shares",
    "duration",
  ]);

  const display = useMemo(() => createRange(rangeDays), [rangeDays]);
  const previous = useMemo(
    () => ({
      end: shiftDays(display.start, -1),
      start: shiftDays(display.start, -rangeDays),
    }),
    [display.start, rangeDays],
  );
  const queryRange = display;

  const loadAnalytics = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          start: queryRange.start,
          end: queryRange.end,
        });
        const response = await fetch(
          `/api/social/tiktok/analytics?${params.toString()}`,
          { method: "GET", cache: "no-store", signal },
        );
        const body = (await response.json()) as AnalyticsResponse;
        if (!response.ok || body.ok === false) {
          throw new Error(body.message ?? "TikTok analytics could not be loaded.");
        }
        setAnalytics(body);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "TikTok analytics could not be loaded.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [queryRange.end, queryRange.start],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadAnalytics(controller.signal);
    return () => controller.abort();
  }, [loadAnalytics]);

  useEffect(() => {
    setPage(0);
    setSelectedIds([]);
  }, [query, display.start, display.end, pageSize]);

  function scrollToSection(section: TikTokTab) {
    setTab(section);
    document.getElementById(`tiktok-${section}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  useEffect(() => {
    const sections = (["community", "posts"] as const)
      .map((key) => document.getElementById(`tiktok-${key}`))
      .filter((section): section is HTMLElement => section !== null);

    if (!sections.length) return;

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
        if (!visibleId) return;
        setTab(visibleId.replace("tiktok-", "") as TikTokTab);
      },
      {
        rootMargin: "-160px 0px -55% 0px",
        threshold: [0, 0.1, 0.25, 0.5],
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const responseMatches =
    analytics?.range?.start === queryRange.start &&
    analytics?.range?.end === queryRange.end;
  const points = useMemo(
    () => (responseMatches ? (analytics?.points ?? []) : []),
    [analytics?.points, responseMatches],
  );
  const currentPoints = useMemo(
    () =>
      points.filter(
        (point) => point.date >= display.start && point.date <= display.end,
      ),
    [points, display.end, display.start],
  );
  const currentPosts = useMemo(
    () =>
      responseMatches
        ? (analytics?.posts ?? []).filter(
            (post) =>
              post.publishedOn >= display.start &&
              post.publishedOn <= display.end,
          )
        : [],
    [analytics?.posts, display.end, display.start, responseMatches],
  );

  const [sortKey, setSortKey] = useState<"type" | "date">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filteredPosts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = needle
      ? currentPosts.filter((post) =>
          `${post.caption} ${post.type} ${post.publishedOn}`
            .toLowerCase()
            .includes(needle),
        )
      : [...currentPosts];

    rows.sort((left, right) => {
      const leftValue = sortKey === "date" ? left.publishedAt : left.type;
      const rightValue = sortKey === "date" ? right.publishedAt : right.type;
      const compared = leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
      return sortDir === "asc" ? compared : -compared;
    });

    return rows;
  }, [currentPosts, query, sortDir, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filteredPosts.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pagePosts = filteredPosts.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize,
  );
  const pageFrom = filteredPosts.length ? safePage * pageSize + 1 : 0;
  const pageTo = Math.min((safePage + 1) * pageSize, filteredPosts.length);

  const followers = responseMatches ? (analytics?.followers ?? null) : null;
  const postsTotal = sumPoints(currentPoints, "posts");
  const viewsTotal = sumPoints(currentPoints, "views");
  const likesTotal = sumPoints(currentPoints, "likes");
  const commentsTotal = sumPoints(currentPoints, "comments");
  const sharesTotal = sumPoints(currentPoints, "shares");
  const interactionsTotal = sumPoints(currentPoints, "interactions");

  const handle =
    analytics?.account?.handle ??
    analytics?.account?.name ??
    accountName;

  function series(
    source: DailyPoint[],
    key: keyof DailyPoint,
    label: string,
    color: string,
  ) {
    return {
      label,
      color,
      points: source.map((point) => ({
        date: point.date,
        value: metricValue(
          typeof point[key] === "number" ? (point[key] as number) : null,
        ),
      })),
    };
  }

  const growthSeries =
    growthMetric === "followers"
      ? series(currentPoints, "followerBalance", "Followers", COLORS.followers)
      : series(currentPoints, "posts", "Posts", COLORS.posts);
  const viewsSeries =
    viewsMetric === "views"
      ? series(currentPoints, "views", "Views", COLORS.views)
      : series(currentPoints, "posts", "Posts", COLORS.posts);
  const interactionSeries = series(
    currentPoints,
    interactionMetric,
    interactionMetric === "posts"
      ? "Posts"
      : interactionMetric[0].toUpperCase() + interactionMetric.slice(1),
    COLORS[interactionMetric],
  );
  const balanceSeries = series(
    currentPoints,
    "followerBalance",
    "Followers",
    COLORS.balance,
  );

  function chartPoints(
    source: Array<{ date: string; value: ReturnType<typeof metricValue> }>,
  ) {
    if (source.length) return source;
    return enumerateDates(display.start, display.end).map((date) => ({
      date,
      value: metricValue(null),
    }));
  }

  function toggleSort(key: "type" | "date") {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "date" ? "desc" : "asc");
  }

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
          provider: "tiktok",
          businessBrandId: activeBrandId,
          returnPath: withSocialPreview(
            "/dashboard/social/tiktok",
            searchParams,
          ),
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        authorization?: { authorizationUrl?: string };
      };
      const authorizationUrl = result.authorization?.authorizationUrl;
      if (!response.ok || !result.ok || !authorizationUrl) {
        setReconnectError(result.message ?? "TikTok reconnect could not be started.");
        setReconnecting(false);
        return;
      }
      window.location.assign(authorizationUrl);
    } catch {
      setReconnectError("TikTok reconnect could not be started.");
      setReconnecting(false);
    }
  }

  function toggleColumn(column: PostColumn) {
    setVisibleColumns((current) => {
      if (current.includes(column)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== column);
      }
      return [...current, column];
    });
  }

  function downloadCsv() {
    const rows = selectedIds.length
      ? filteredPosts.filter((post) => selectedIds.includes(post.id))
      : filteredPosts;
    const headers = visibleColumns.map((column) => COLUMN_LABELS[column]);
    const body = rows.map((post) =>
      visibleColumns.map((column) => {
        switch (column) {
          case "posts":
            return post.caption;
          case "type":
            return post.type;
          case "date":
            return displayDate(post.publishedOn);
          case "views":
            return formatCount(post.views);
          case "likes":
            return formatCount(post.likes);
          case "comments":
            return formatCount(post.comments);
          case "shares":
            return formatCount(post.shares);
          case "duration":
            return formatDuration(post.durationSeconds);
        }
      }),
    );
    const csv = [headers, ...body]
      .map((row) => row.map((cell) => csvEscape(cell)).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tiktok-posts-${display.start}-to-${display.end}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const allPageSelected =
    pagePosts.length > 0 &&
    pagePosts.every((post) => selectedIds.includes(post.id));

  function togglePage(checked: boolean) {
    setSelectedIds((current) => {
      const pageIds = pagePosts.map((post) => post.id);
      if (checked) return [...new Set([...current, ...pageIds])];
      return current.filter((id) => !pageIds.includes(id));
    });
  }

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, id] : current.filter((item) => item !== id),
    );
  }

  return (
    <div className="space-y-4 bg-white text-[#20242A]">
      <div className="flex flex-col gap-4 bg-white pb-1 lg:flex-row lg:items-end lg:justify-between">
        <div
          role="tablist"
          aria-label="TikTok analytics"
          className="flex items-end gap-6"
        >
          {(
            [
              ["community", "COMMUNITY"],
              ["posts", "POSTS"],
            ] as const
          ).map(([key, label]) => {
            const selected = tab === key;
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
                    : "border-transparent text-[#9AA1A9] hover:text-[#20242A]"
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
                aria-label="TikTok date range"
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

      {responseMatches && analytics?.reauthorizationRequired ? (
        <div className="flex flex-col gap-3 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Reconnect TikTok to grant follower statistics and the video list.
            This page only shows numbers TikTok returns for this account.
          </p>
          <button
            type="button"
            onClick={() => void reconnect()}
            disabled={!canManage || !activeBrandId || reconnecting}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-[9px] bg-[#2C1929] px-4 text-sm font-semibold text-[#DDFF35] disabled:opacity-60"
          >
            {reconnecting ? "Opening TikTok…" : "Reconnect TikTok"}
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
            onClick={() => void loadAnalytics()}
            className="inline-flex h-10 items-center justify-center rounded-[9px] border border-rose-300 bg-white px-4 font-medium"
          >
            Retry
          </button>
        </div>
      ) : null}

      {responseMatches && analytics?.notice ? (
        <p className="text-sm text-[#5F6770]">{analytics.notice}</p>
      ) : null}

      <section id="tiktok-community" className="scroll-mt-[84px] space-y-4">
        <div className="flex items-center gap-2 rounded-[8px] border border-[#D5E2FB] bg-[#F3F6FF] px-4 py-2.5 text-[13px] leading-5 text-[#5C6A82]">
          <Info className="h-4 w-4 shrink-0 text-[#8EA0C4]" />
          <p>
            Some TikTok metrics may not be available for the last 1-2 days. The
            number of followers will only be available from the day the account
            got connected.
          </p>
        </div>
        <div className="flex items-center justify-between gap-4 pt-2">
            <h1 className="flex items-center gap-3 text-[20px] font-medium text-[#20242A]">
              Community
              {loading && !responseMatches ? (
                <span className="text-[12px] font-normal text-[#9AA1A9]">
                  Loading
                </span>
              ) : null}
            </h1>
            <TikTokAccountLabel
              name={handle}
              imageUrl={
                toClientSocialImageUrl(analytics?.account?.avatarUrl) ??
                profileImageUrl
              }
            />
          </div>

          <ChartBlock
            framed
            title="Growth"
            seriesLabel={growthSeries.label}
            seriesColor={growthSeries.color}
            points={chartPoints(growthSeries.points)}
            cards={
              <>
                <MetricCard
                  label="Followers"
                  value={followers}
                  color={COLORS.followers}
                  selected={growthMetric === "followers"}
                  onSelect={() => setGrowthMetric("followers")}
                />
                <MetricCard
                  label="Posts"
                  value={postsTotal}
                  color={COLORS.posts}
                  selected={growthMetric === "posts"}
                  onSelect={() => setGrowthMetric("posts")}
                />
              </>
            }
          />

          <ChartBlock
            framed
            title="Balance of Followers"
            seriesLabel={balanceSeries.label}
            seriesColor={balanceSeries.color}
            points={chartPoints(balanceSeries.points)}
              cards={
                <MetricCard
                  label="Followers"
                  value={followers}
                  color={COLORS.balance}
                  selected
                  onSelect={() => undefined}
              />
            }
          />
      </section>

      <section id="tiktok-posts" className="scroll-mt-[84px] space-y-4 pt-2">
          <p className="pt-2 text-[20px] font-medium leading-7 text-[#20242A]">
            Posts published in period
          </p>

          <ChartBlock
            framed
            title="Views"
            seriesLabel={viewsSeries.label}
            seriesColor={viewsSeries.color}
            points={chartPoints(viewsSeries.points)}
            cards={
              <>
                <MetricCard
                  label="Views"
                  value={viewsTotal}
                  color={COLORS.views}
                  selected={viewsMetric === "views"}
                  onSelect={() => setViewsMetric("views")}
                />
                <MetricCard
                  label="Posts"
                  value={postsTotal}
                  color={COLORS.posts}
                  selected={viewsMetric === "posts"}
                  onSelect={() => setViewsMetric("posts")}
                />
              </>
            }
          />

          <ChartBlock
            framed
            title="Interactions"
              seriesLabel={interactionSeries.label}
              seriesColor={interactionSeries.color}
              points={chartPoints(interactionSeries.points)}
              cards={
                <>
                  {(
                    [
                      ["interactions", "Interactions", interactionsTotal],
                      ["likes", "Likes", likesTotal],
                      ["comments", "Comments", commentsTotal],
                      ["shares", "Shares", sharesTotal],
                      ["posts", "Posts", postsTotal],
                    ] as const
                  ).map(([key, label, value]) => (
                    <MetricCard
                      key={key}
                      label={label}
                      value={value}
                      color={COLORS[key]}
                      selected={interactionMetric === key}
                      onSelect={() => setInteractionMetric(key)}
                    />
                  ))}
                </>
              }
            />

          <section className="border-t border-[#F0F2F4] pt-6">
            <h2 className="text-[18px] font-medium text-[#20242A]">List of posts</h2>

            <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search posts</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B939C]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                  className="h-10 w-full rounded-[8px] border border-[#D5DCE3] bg-white pl-10 pr-3 text-[13px] outline-none placeholder:text-[#A0A8B0] focus:border-[#9AABBA]"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setColumnsOpen((current) => !current)}
                    className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#E1E4E8] bg-white px-3 text-[13px] text-[#30343A]"
                  >
                    <Columns3 className="h-4 w-4 text-[#6B7280]" />
                    Columns
                  </button>
                  {columnsOpen ? (
                    <div className="absolute right-0 z-20 mt-2 w-44 rounded-[10px] border border-[#E5E7EB] bg-white p-2 shadow-lg">
                      {(Object.keys(COLUMN_LABELS) as PostColumn[]).map((column) => (
                        <label
                          key={column}
                          className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-[#30343A]"
                        >
                          <input
                            type="checkbox"
                            checked={visibleColumns.includes(column)}
                            onChange={() => toggleColumn(column)}
                          />
                          {COLUMN_LABELS[column]}
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={downloadCsv}
                  className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#F7FBE3] px-3 text-[13px] text-[#30343A]"
                >
                  <Download className="h-4 w-4" />
                  Download CSV
                  <PremiumDiamond />
                </button>

                <div className="relative">
                  <span className="absolute -right-1 -top-3 rounded-full bg-[#D9F6EA] px-2 py-0.5 text-[10px] font-medium text-[#3E8F6E]">
                    New
                  </span>
                  <Link
                    href="/dashboard/billing"
                    className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#F7FBE3] px-3 text-[13px] text-[#30343A]"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Add to dashboard
                    <PremiumDiamond />
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[860px] w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-[#F3F4F6] text-[13px] text-[#9AA1A9]">
                    <th className="w-12 rounded-l-[6px] px-4 py-3 font-medium">
                      <input
                        type="checkbox"
                        aria-label="Select posts on this page"
                        checked={allPageSelected}
                        onChange={(event) => togglePage(event.target.checked)}
                      />
                    </th>
                    {visibleColumns.map((column, index) => {
                      const sortable = column === "type" || column === "date";
                      const last = index === visibleColumns.length - 1;
                      return (
                        <th
                          key={column}
                          className={`px-3 py-3 font-medium ${last ? "rounded-r-[6px]" : ""}`}
                        >
                          {sortable ? (
                            <button
                              type="button"
                              onClick={() => toggleSort(column)}
                              className="inline-flex items-center gap-1"
                            >
                              {COLUMN_LABELS[column]}
                              <ChevronDown
                                className={`h-3.5 w-3.5 ${
                                  sortKey === column && sortDir === "asc"
                                    ? "rotate-180"
                                    : ""
                                }`}
                              />
                            </button>
                          ) : (
                            COLUMN_LABELS[column]
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pagePosts.length ? (
                    pagePosts.map((post) => (
                      <tr key={post.id} className="border-t border-[#F0F2F4]">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${post.caption}`}
                            checked={selectedIds.includes(post.id)}
                            onChange={(event) =>
                              toggleRow(post.id, event.target.checked)
                            }
                          />
                        </td>
                        {visibleColumns.map((column) => (
                          <td key={column} className="px-3 py-3 text-[#30343A]">
                            {column === "posts" ? (
                              <div className="flex items-center gap-3">
                                {post.thumbnailUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={post.thumbnailUrl}
                                    alt=""
                                    referrerPolicy="no-referrer"
                                    className="h-12 w-12 rounded-[6px] object-cover"
                                  />
                                ) : (
                                  <span className="h-12 w-12 rounded-[6px] bg-[#EEF1F4]" />
                                )}
                                {post.permalinkUrl ? (
                                  <a
                                    href={post.permalinkUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="line-clamp-2 max-w-[280px] font-medium hover:underline"
                                  >
                                    {post.caption}
                                  </a>
                                ) : (
                                  <span className="line-clamp-2 max-w-[280px]">
                                    {post.caption}
                                  </span>
                                )}
                              </div>
                            ) : null}
                            {column === "type" ? post.type : null}
                            {column === "date" ? displayDate(post.publishedOn) : null}
                            {column === "views" ? formatCount(post.views) : null}
                            {column === "likes" ? formatCount(post.likes) : null}
                            {column === "comments" ? formatCount(post.comments) : null}
                            {column === "shares" ? formatCount(post.shares) : null}
                            {column === "duration"
                              ? formatDuration(post.durationSeconds)
                              : null}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    [0, 1].map((row) => (
                      <tr key={row}>
                        <td className="px-4 py-4">
                          <span className="sr-only">
                            {query.trim()
                              ? "No TikTok videos match this search."
                              : "No TikTok videos in this period."}
                          </span>
                        </td>
                        {visibleColumns.map((column) => (
                          <td key={column} className="px-3 py-4">
                            <span
                              className={`block h-3 rounded-full bg-[#ECEFF3] ${
                                column === "posts" ? "w-40" : "w-14"
                              }`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-4 text-[13px] text-[#6B7280]">
              <label className="flex items-center gap-2">
                Items per page:
                <select
                  aria-label="Items per page"
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="h-8 rounded-[6px] border border-[#E1E4E8] bg-white px-2"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <span>
                {pageFrom}-{pageTo} of {filteredPosts.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="First page"
                  disabled={safePage === 0}
                  onClick={() => setPage(0)}
                  className="rounded p-1 disabled:opacity-40"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={safePage === 0}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  className="rounded p-1 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={safePage >= pageCount - 1}
                  onClick={() =>
                    setPage((current) => Math.min(pageCount - 1, current + 1))
                  }
                  className="rounded p-1 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Last page"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage(pageCount - 1)}
                  className="rounded p-1 disabled:opacity-40"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
      </section>
    </div>
  );
}
