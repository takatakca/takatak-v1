"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  Columns3,
  Download,
  GitCompareArrows,
  Info,
  LayoutDashboard,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { SiBluesky } from "react-icons/si";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  SocialSummaryChart,
} from "@/components/social/analytics/social-summary-chart";
import { metricValue } from "@/components/social/analytics/social-summary-tokens";
import { toClientSocialImageUrl } from "@/lib/social/media/remote-image";

const RANGES = [7, 30, 90, 180, 365] as const;
const SECTIONS = [
  ["community", "COMMUNITY"],
  ["posts", "POSTS"],
  ["competitors", "COMPETITORS"],
] as const;

type BlueskySection = (typeof SECTIONS)[number][0];
type GrowthMetric = "followers" | "following" | "posts";
type BalanceMetric = "acquired" | "lost" | "posts";
type SummaryMetric = "interactions" | "posts";
type InteractionMetric = "likes" | "replies" | "reposts" | "quotes" | "posts";

type BlueskyPostItem = {
  id: string;
  text: string;
  createdAt: string;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
};

type BlueskyResponse = {
  connected?: boolean;
  followers?: number | null;
  following?: number | null;
  posts?: number | null;
  dailyPosts?: number | null;
  postsPerWeek?: number | null;
  postsInRange?: number | null;
  avatarUrl?: string | null;
  likes?: number | null;
  replies?: number | null;
  reposts?: number | null;
  quotes?: number | null;
  interactions?: number | null;
  dailyLikes?: number | null;
  likesPerPost?: number | null;
  dailyReposts?: number | null;
  repostsPerPost?: number | null;
  postItems?: BlueskyPostItem[];
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
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatRate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function postAmount(item: BlueskyPostItem, metric: SummaryMetric | InteractionMetric): number {
  if (metric === "interactions") {
    return item.likes + item.replies + item.reposts + item.quotes;
  }
  if (metric === "posts") return 1;
  return item[metric];
}

function periodPoints(
  dates: string[],
  items: BlueskyPostItem[] | undefined,
  loaded: boolean,
  metric: SummaryMetric | InteractionMetric,
) {
  if (!loaded) {
    return dates.map((date) => ({ date, value: metricValue(null) }));
  }
  const totals = new Map<string, number>();
  for (const item of items ?? []) {
    const day = item.createdAt.slice(0, 10);
    totals.set(day, (totals.get(day) ?? 0) + postAmount(item, metric));
  }
  return dates.map((date) => ({
    date,
    value: metricValue(totals.get(date) ?? 0),
  }));
}

function BlueskyAccountChip({
  handle,
  imageUrl,
}: {
  handle: string;
  imageUrl: string | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

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
          <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#C65A2E] text-white">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-white text-[13px] font-semibold leading-none">
              @
            </span>
          </span>
        )}
        <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white">
          <SiBluesky className="h-3.5 w-3.5 text-[#1185FE]" aria-hidden="true" />
        </span>
      </span>
      <span className="truncate text-[15px] font-medium text-[#20242A]" title={handle}>
        {handle}
      </span>
    </div>
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
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex h-[88px] w-[132px] shrink-0 flex-col items-center justify-center rounded-[10px] text-center ${
        selected ? "ring-2 ring-[#20242A] ring-offset-2" : ""
      }`}
      style={{ backgroundColor: color }}
    >
      <strong className="text-[28px] font-medium leading-none text-[#20242A]">
        {formatCount(value)}
      </strong>
      <span className="mt-1.5 text-[13px] font-medium text-[#30343A]">{label}</span>
    </button>
  );
}

function ChartBlock({
  title,
  cards,
  points,
  seriesLabel,
  seriesColor,
}: {
  title: string;
  cards: ReactNode;
  points: Array<{ date: string; value: ReturnType<typeof metricValue> }>;
  seriesLabel: string;
  seriesColor: string;
}) {
  return (
    <section className="rounded-[14px] border border-[#E6E8EC] bg-white px-5 pb-2 pt-4 sm:px-6">
      <div className="relative">
        <h2 className="absolute left-0 top-[26px] z-20 text-[16px] font-medium text-[#20242A]">
          {title}
        </h2>
        <div className="absolute right-0 top-0 z-20 flex max-w-[calc(100%-8rem)] justify-end gap-3 overflow-x-auto">
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
        </div>
      </div>
    </section>
  );
}

const SUMMARY_COLORS: Record<SummaryMetric, string> = {
  interactions: "#8FCB8A",
  posts: "#E9AA2D",
};

const INTERACTION_COLORS: Record<InteractionMetric, string> = {
  likes: "#8B7EF6",
  replies: "#8FCB8A",
  reposts: "#F3B4D8",
  quotes: "#C4B8F5",
  posts: "#E9AA2D",
};

function EmptyPostSearch() {
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
        You can use the filter tools to narrow down your search. Check if the current date range
        suits your needs.
      </p>
    </div>
  );
}

function PublishedPosts({
  analytics,
  dates,
  summaryMetric,
  interactionMetric,
  onSummary,
  onInteraction,
}: {
  analytics: BlueskyResponse | null;
  dates: string[];
  summaryMetric: SummaryMetric;
  interactionMetric: InteractionMetric;
  onSummary: (metric: SummaryMetric) => void;
  onInteraction: (metric: InteractionMetric) => void;
}) {
  const [query, setQuery] = useState("");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [showDate, setShowDate] = useState(true);
  const [showPost, setShowPost] = useState(true);
  const [showLikes, setShowLikes] = useState(true);
  const [showReplies, setShowReplies] = useState(true);
  const [showReposts, setShowReposts] = useState(true);
  const [showQuotes, setShowQuotes] = useState(true);
  const loaded = analytics?.postsInRange != null;
  const items = analytics?.postItems ?? [];
  const filtered = items.filter((item) =>
    item.text.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const summaryPoints = periodPoints(dates, items, loaded, summaryMetric);
  const interactionPoints = periodPoints(dates, items, loaded, interactionMetric);

  function downloadCsv() {
    const columns = [
      showDate ? "Date" : null,
      showPost ? "Post" : null,
      showLikes ? "Likes" : null,
      showReplies ? "Replies" : null,
      showReposts ? "Reposts" : null,
      showQuotes ? "Quotes" : null,
    ].filter((column): column is string => column !== null);
    const body = filtered.map((item) => {
      const cells = [
        showDate ? item.createdAt.slice(0, 10) : null,
        showPost ? item.text : null,
        showLikes ? String(item.likes) : null,
        showReplies ? String(item.replies) : null,
        showReposts ? String(item.reposts) : null,
        showQuotes ? String(item.quotes) : null,
      ].filter((cell): cell is string => cell !== null);
      return cells;
    });
    const csv = [columns, ...body]
      .map((line) =>
        line
          .map((cell) => (/[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell))
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bluesky-posts.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <ChartBlock
        title="Summary"
        seriesLabel={summaryMetric === "posts" ? "Posts" : "Interactions"}
        seriesColor={SUMMARY_COLORS[summaryMetric]}
        points={summaryPoints}
        cards={
          <>
            <MetricCard
              label="Interactions"
              value={analytics?.interactions ?? null}
              color={SUMMARY_COLORS.interactions}
              selected={summaryMetric === "interactions"}
              onSelect={() => onSummary("interactions")}
            />
            <MetricCard
              label="Posts"
              value={analytics?.postsInRange ?? null}
              color={SUMMARY_COLORS.posts}
              selected={summaryMetric === "posts"}
              onSelect={() => onSummary("posts")}
            />
          </>
        }
      />

      <ChartBlock
        title="Interactions"
        seriesLabel={
          interactionMetric === "likes"
            ? "Likes"
            : interactionMetric === "replies"
              ? "Replies"
              : interactionMetric === "reposts"
                ? "Reposts"
                : interactionMetric === "quotes"
                  ? "Quotes"
                  : "Posts"
        }
        seriesColor={INTERACTION_COLORS[interactionMetric]}
        points={interactionPoints}
        cards={
          <>
            <MetricCard
              label="Likes"
              value={analytics?.likes ?? null}
              color={INTERACTION_COLORS.likes}
              selected={interactionMetric === "likes"}
              onSelect={() => onInteraction("likes")}
            />
            <MetricCard
              label="Replies"
              value={analytics?.replies ?? null}
              color={INTERACTION_COLORS.replies}
              selected={interactionMetric === "replies"}
              onSelect={() => onInteraction("replies")}
            />
            <MetricCard
              label="Reposts"
              value={analytics?.reposts ?? null}
              color={INTERACTION_COLORS.reposts}
              selected={interactionMetric === "reposts"}
              onSelect={() => onInteraction("reposts")}
            />
            <MetricCard
              label="Quotes"
              value={analytics?.quotes ?? null}
              color={INTERACTION_COLORS.quotes}
              selected={interactionMetric === "quotes"}
              onSelect={() => onInteraction("quotes")}
            />
            <MetricCard
              label="Posts"
              value={analytics?.postsInRange ?? null}
              color={INTERACTION_COLORS.posts}
              selected={interactionMetric === "posts"}
              onSelect={() => onInteraction("posts")}
            />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["Daily likes", analytics?.dailyLikes ?? null, false],
            ["Likes per post", analytics?.likesPerPost ?? null, true],
            ["Daily reposts", analytics?.dailyReposts ?? null, false],
            ["Reposts per post", analytics?.repostsPerPost ?? null, true],
          ] as const
        ).map(([label, value, rate]) => (
          <div
            key={label}
            className="flex h-[88px] flex-col items-center justify-center rounded-[10px] bg-[#ECEEEF] text-center"
          >
            <strong className="text-[28px] font-medium leading-none">
              {rate ? formatRate(value) : formatCount(value)}
            </strong>
            <span className="mt-1.5 text-[13px] text-[#505761]">{label}</span>
          </div>
        ))}
      </div>

      <section className="rounded-[14px] border border-[#E6E8EC] bg-white px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA1A9]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search posts"
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
                    ["Post", showPost, setShowPost],
                    ["Likes", showLikes, setShowLikes],
                    ["Replies", showReplies, setShowReplies],
                    ["Reposts", showReposts, setShowReposts],
                    ["Quotes", showQuotes, setShowQuotes],
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
          <div className="relative">
            <span className="absolute -right-1 -top-3 rounded-full bg-[#DDF8ED] px-2 py-0.5 text-[10px] font-medium text-[#4E7B68]">
              New
            </span>
            <Link
              href="/dashboard/billing"
              className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#FAFDE8] px-3 text-[13px] text-[#30343A]"
            >
              <LayoutDashboard className="h-4 w-4" />
              Add to dashboard
            </Link>
          </div>
        </div>
        {filtered.length === 0 ? (
          <EmptyPostSearch />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-[13px] text-[#30343A]">
              <thead>
                <tr className="border-b border-[#EEF0F2] text-[#8B939C]">
                  {showPost ? <th className="py-3 pr-4 font-medium">Post</th> : null}
                  {showDate ? <th className="py-3 pr-4 font-medium">Date</th> : null}
                  {showLikes ? <th className="py-3 pr-4 font-medium">Likes</th> : null}
                  {showReplies ? <th className="py-3 pr-4 font-medium">Replies</th> : null}
                  {showReposts ? <th className="py-3 pr-4 font-medium">Reposts</th> : null}
                  {showQuotes ? <th className="py-3 font-medium">Quotes</th> : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b border-[#F4F6F8]">
                    {showPost ? <td className="max-w-[360px] py-3 pr-4">{item.text || "—"}</td> : null}
                    {showDate ? <td className="py-3 pr-4">{item.createdAt.slice(0, 10)}</td> : null}
                    {showLikes ? <td className="py-3 pr-4">{formatCount(item.likes)}</td> : null}
                    {showReplies ? <td className="py-3 pr-4">{formatCount(item.replies)}</td> : null}
                    {showReposts ? <td className="py-3 pr-4">{formatCount(item.reposts)}</td> : null}
                    {showQuotes ? <td className="py-3">{formatCount(item.quotes)}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function CompetitorsSection() {
  const [query, setQuery] = useState("");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [showHandle, setShowHandle] = useState(true);
  const [showFollowers, setShowFollowers] = useState(true);
  const [showPosts, setShowPosts] = useState(true);

  function downloadCsv() {
    const headers = ["Name", ...(showHandle ? ["Handle"] : []), ...(showFollowers ? ["Followers"] : []), ...(showPosts ? ["Posts"] : [])];
    const csv = headers
      .map((cell) => (/[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell))
      .join(",");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bluesky-competitors.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[20px] font-medium">Competitors</h2>
      <section className="rounded-[14px] border border-[#E6E8EC] bg-white px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#E5FF3F] text-[#59656D]">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8.5 7.2 4h9.6L21 8.5 12 20 3 8.5Z" />
                <path d="m7.2 4 2.6 4.5L12 4l2.2 4.5L16.8 4" />
                <path d="M3 8.5h18" />
                <path d="m9.8 8.5 2.2 11 2.2-11" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-[18px] font-semibold">Do you need a higher plan?</h3>
              <p className="mt-1 text-[14px] leading-6 text-[#68717A]">
                Upgrade your plan and add up to{" "}
                <strong className="font-semibold text-[#46505A]">100 competitors</strong> which you
                can modify and/or delete at any time
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/billing"
            className="inline-flex h-9 shrink-0 items-center justify-center self-start rounded-[8px] bg-[#2B1725] px-4 text-[13px] font-semibold text-[#DFFF38] lg:self-auto"
          >
            Upgrade your plan
          </Link>
        </div>
      </section>

      <section className="rounded-[14px] border border-[#E6E8EC] bg-white px-5 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <h3 className="text-[18px] font-medium">List of competitors</h3>
          <span
            aria-hidden="true"
            className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#777D84] text-[11px] font-medium text-[#777D84]"
          >
            ?
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA1A9]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search competitors"
              className="h-10 w-full rounded-[8px] border border-[#E3E6EA] bg-white pl-9 pr-3 text-[14px] text-[#30343A] outline-none"
            />
          </label>
          <button
            type="button"
            disabled
            className="inline-flex h-10 min-w-[150px] items-center justify-between gap-3 rounded-[8px] border border-[#E4E7EA] bg-white px-3 text-[13px] text-[#C1C6CA]"
          >
            All competitors
            <ChevronDown className="h-4 w-4" />
          </button>
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
                    ["Handle", showHandle, setShowHandle],
                    ["Followers", showFollowers, setShowFollowers],
                    ["Posts", showPosts, setShowPosts],
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
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#E3E6EA] bg-white px-3 text-[13px] text-[#505761]"
          >
            <LayoutDashboard className="h-4 w-4" />
            Post List (All)
          </button>
          <Link
            href="/dashboard/billing"
            className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#2B1725] px-4 text-[13px] font-semibold text-[#DFFF38]"
          >
            <span aria-hidden="true" className="text-[18px] font-light leading-none">
              +
            </span>
            Add
          </Link>
        </div>
        <EmptyPostSearch />
      </section>
    </div>
  );
}

export function BlueskySubscribedDashboard({
  handle,
  imageUrl = null,
}: {
  handle: string;
  imageUrl?: string | null;
}) {
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [section, setSection] = useState<BlueskySection>("community");
  const [growthMetric, setGrowthMetric] = useState<GrowthMetric>("followers");
  const [balanceMetric, setBalanceMetric] = useState<BalanceMetric>("acquired");
  const [acquisition, setAcquisition] = useState<"acquired" | "lost">("acquired");
  const [summaryMetric, setSummaryMetric] = useState<SummaryMetric>("interactions");
  const [interactionMetric, setInteractionMetric] = useState<InteractionMetric>("likes");
  const [noticeOpen, setNoticeOpen] = useState(true);
  const [analytics, setAnalytics] = useState<BlueskyResponse | null>(null);

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
    const controller = new AbortController();
    const params = new URLSearchParams({ start: display.start, end: display.end });
    void fetch(`/api/social/bluesky/analytics?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((body: BlueskyResponse) => {
        if (!controller.signal.aborted) setAnalytics(body);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAnalytics(null);
      });
    return () => controller.abort();
  }, [display.end, display.start]);

  const blank = useMemo(
    () =>
      enumerateDates(display.start, display.end).map((date) => ({
        date,
        value: metricValue(null),
      })),
    [display.end, display.start],
  );

  const followers = analytics?.followers ?? null;
  const following = analytics?.following ?? null;
  const posts = analytics?.posts ?? null;

  function scrollToSection(next: BlueskySection) {
    setSection(next);
    document.getElementById(`bsky-${next}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  useEffect(() => {
    const nodes = SECTIONS.map(([key]) => document.getElementById(`bsky-${key}`)).filter(
      (node): node is HTMLElement => node !== null,
    );
    if (!nodes.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              Math.abs(left.boundingClientRect.top) - Math.abs(right.boundingClientRect.top),
          );
        const id = visible[0]?.target.id;
        if (id === "bsky-community" || id === "bsky-posts" || id === "bsky-competitors") {
          setSection(id.slice("bsky-".length) as BlueskySection);
        }
      },
      { rootMargin: "-160px 0px -55% 0px", threshold: [0, 0.1, 0.25] },
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-5 bg-white pb-6 text-[#20242A]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div role="tablist" aria-label="Bluesky analytics" className="flex items-end gap-6">
          {SECTIONS.map(([key, label]) => {
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
                aria-label="Bluesky date range"
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
              className={`inline-flex h-10 items-center gap-2 rounded-[8px] border bg-white px-3 text-[13px] text-[#505761] ${
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

      {noticeOpen ? (
        <div className="flex items-start gap-3 rounded-[10px] border border-[#C9D4FF] bg-[#EEF2FF] px-4 py-3 text-sm text-[#303B78]">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#6477F3]" />
          <p className="min-w-0 flex-1">
            The number of followers acquired and lost may not match the total
            number of followers. This is because Bluesky does not remove blocked
            accounts from the total number of followers, our balance is based on
            real actual accounts.
          </p>
          <button
            type="button"
            aria-label="Dismiss notice"
            onClick={() => setNoticeOpen(false)}
            className="rounded p-1 text-[#6477F3]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <section id="bsky-community" className="scroll-mt-[150px] space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[20px] font-medium">Community</h1>
          <BlueskyAccountChip
            handle={handle}
            imageUrl={
              toClientSocialImageUrl(analytics?.avatarUrl) ?? imageUrl
            }
          />
        </div>

        <ChartBlock
          title="Growth"
          seriesLabel={
            growthMetric === "following"
              ? "Following"
              : growthMetric === "posts"
                ? "Posts"
                : "Followers"
          }
          seriesColor={
            growthMetric === "following"
              ? "#C9E4C4"
              : growthMetric === "posts"
                ? "#F3D2B0"
                : "#8B7EF6"
          }
          points={blank}
          cards={
            <>
              <MetricCard
                label="Followers"
                value={followers}
                color="#8B7EF6"
                selected={growthMetric === "followers"}
                onSelect={() => setGrowthMetric("followers")}
              />
              <MetricCard
                label="Following"
                value={following}
                color="#D7EBD4"
                selected={growthMetric === "following"}
                onSelect={() => setGrowthMetric("following")}
              />
              <MetricCard
                label="Posts"
                value={posts}
                color="#F6DCC8"
                selected={growthMetric === "posts"}
                onSelect={() => setGrowthMetric("posts")}
              />
            </>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              ["Followers", followers],
              ["Following", following],
              ["Daily posts", analytics?.dailyPosts ?? null],
              ["Posts per week", analytics?.postsPerWeek ?? null],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="flex h-[88px] flex-col items-center justify-center rounded-[10px] bg-[#ECEEEF] text-center"
            >
              <strong className="text-[28px] font-medium leading-none">
                {formatCount(value)}
              </strong>
              <span className="mt-1.5 text-[13px] text-[#505761]">{label}</span>
            </div>
          ))}
        </div>

        <ChartBlock
          title="Balance of Followers"
          seriesLabel={
            balanceMetric === "lost" ? "Lost" : balanceMetric === "posts" ? "Posts" : "Acquired"
          }
          seriesColor={
            balanceMetric === "lost" ? "#F0A4DF" : balanceMetric === "posts" ? "#E9AA2D" : "#8B7EF6"
          }
          points={blank}
          cards={
            <>
              <MetricCard
                label="Acquired"
                value={null}
                color="#8B7EF6"
                selected={balanceMetric === "acquired"}
                onSelect={() => setBalanceMetric("acquired")}
              />
              <MetricCard
                label="Lost"
                value={null}
                color="#F0A4DF"
                selected={balanceMetric === "lost"}
                onSelect={() => setBalanceMetric("lost")}
              />
              <MetricCard
                label="Posts"
                value={analytics?.postsInRange ?? null}
                color="#E9AA2D"
                selected={balanceMetric === "posts"}
                onSelect={() => setBalanceMetric("posts")}
              />
            </>
          }
        />

        <section className="rounded-[14px] border border-[#E6E8EC] bg-white px-5 py-5 sm:px-6">
          <h2 className="text-[18px] font-medium">Acquisition</h2>
          <div className="mt-4 flex gap-6 border-b border-[#EEF0F2]">
            {(["acquired", "lost"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setAcquisition(key)}
                className={`pb-2 text-[14px] capitalize ${
                  acquisition === key
                    ? "border-b-2 border-[#20242A] font-medium text-[#20242A]"
                    : "text-[#8B939C]"
                }`}
              >
                {key === "acquired" ? "Acquired" : "Lost"}
              </button>
            ))}
          </div>
          <table className="mt-4 w-full text-left text-[13px] text-[#30343A]">
            <thead>
              <tr className="text-[#8B939C]">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 text-right font-medium">Followers</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={2} className="py-16 text-center text-[#8B939C]">
                  No data available
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </section>

      <section id="bsky-posts" className="scroll-mt-[150px] space-y-4">
        <h2 className="text-[20px] font-medium">Posts published in period</h2>
        <PublishedPosts
          analytics={analytics}
          dates={enumerateDates(display.start, display.end)}
          summaryMetric={summaryMetric}
          interactionMetric={interactionMetric}
          onSummary={setSummaryMetric}
          onInteraction={setInteractionMetric}
        />
      </section>
      <section id="bsky-competitors" className="scroll-mt-[150px]">
        <CompetitorsSection />
      </section>
    </div>
  );
}
