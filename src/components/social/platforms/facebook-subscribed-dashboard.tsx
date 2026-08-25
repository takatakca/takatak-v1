"use client";

import {
  CalendarDays,
  Columns3,
  Download,
  GitCompareArrows,
  Plus,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";

import { SocialSummaryChart } from "@/components/social/analytics/social-summary-chart";
import {
  SUMMARY_PAGE_BG,
  dateKey,
  displayDate,
  displayDateShort,
  enumerateDates,
  metricValue,
} from "@/components/social/analytics/social-summary-tokens";
import { FacebookContentListPanel } from "@/components/social/platforms/facebook-content-list-panel";
import { FacebookCompetitorsPanel } from "@/components/social/platforms/facebook-competitors-panel";

type FacebookTab =
  | "overview"
  | "demographics"
  | "posts"
  | "reels"
  | "stories"
  | "competitors";

const TABS: Array<{ key: FacebookTab; label: string; href: string }> = [
  { key: "overview", label: "PAGE OVERVIEW", href: "fb-overview" },
  { key: "demographics", label: "DEMOGRAPHICS", href: "fb-demographics" },
  { key: "posts", label: "POSTS", href: "fb-posts" },
  { key: "reels", label: "REELS", href: "fb-reels" },
  { key: "stories", label: "STORIES", href: "fb-stories" },
  { key: "competitors", label: "COMPETITORS", href: "fb-competitors" },
];

const RANGES = [30, 90, 180, 365] as const;

type ColorCard = {
  key: string;
  /** Short label always shown on the card. */
  label: string;
  color: string;
  /** null = unavailable (—); never invent zeros for missing Meta fields. */
  value: number | null;
  /** Longer detail shown only in the hover tooltip (e.g. covered date range). */
  hoverLabel?: string;
};

function formatCardValue(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString();
}

function ColorMetricCard({
  card,
  active,
  onActive,
}: {
  card: ColorCard;
  active: boolean;
  onActive: (key: string | null) => void;
}) {
  const tooltipLabel = card.hoverLabel ?? card.label;
  return (
    <button
      type="button"
      aria-label={`${tooltipLabel}: ${formatCardValue(card.value)}`}
      onMouseEnter={() => onActive(card.key)}
      onMouseLeave={() => onActive(null)}
      onFocus={() => onActive(card.key)}
      onBlur={() => onActive(null)}
      className={`relative flex h-[92px] min-w-[140px] flex-1 flex-col items-center justify-center rounded-[10px] px-3 py-3 text-center text-white outline-none transition focus-visible:ring-2 focus-visible:ring-[#566DF1] ${
        active ? "brightness-[0.97]" : "hover:brightness-[0.97]"
      }`}
      style={{ backgroundColor: card.color }}
    >
      {active ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-20 flex min-w-[118px] -translate-x-1/2 items-center justify-between gap-6 rounded-[8px] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#111827] shadow-[0_4px_14px_rgba(15,23,42,0.14)]"
        >
          <span>{tooltipLabel}</span>
          <span>{formatCardValue(card.value)}</span>
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[7px] border-x-transparent border-t-white"
          />
        </span>
      ) : null}
      <p className="text-[24px] font-semibold leading-none tracking-tight">
        {formatCardValue(card.value)}
      </p>
      <p className="mt-2.5 text-[12px] font-semibold leading-4 opacity-95">
        {card.label}
      </p>
    </button>
  );
}

function GreyStatCard({
  value,
  label,
}: {
  value: number | null;
  label: string;
}) {
  return (
    <div className="flex min-h-[88px] min-w-[140px] flex-1 flex-col items-center justify-center rounded-[10px] bg-[#EDEEF2] px-3 py-3 text-center">
      <p className="text-[24px] font-semibold leading-none text-[#20242A]">
        {formatCardValue(value)}
      </p>
      <p className="mt-2.5 text-[12px] font-semibold leading-4 text-[#5F6770]">
        {label}
      </p>
    </div>
  );
}

function EmptyListState({ title }: { title: string }) {
  return (
    <section className="rounded-[14px] border border-[#e8eaed] bg-white px-5 py-6">
      <h2 className="text-[18px] font-semibold text-[#20242A]">{title}</h2>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa1a9]" />
          <input
            placeholder="Search"
            className="h-11 w-full rounded-[10px] border border-[#d7dbe0] bg-white pl-10 pr-3 text-sm text-[#30343a] outline-none focus:border-[#8996F6] focus:ring-2 focus:ring-[#EEF0FF]"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#d7dbe0] bg-white px-3.5 text-sm font-medium text-[#30343a]"
          >
            <Columns3 className="h-4 w-4" />
            Columns
          </button>
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#d7dbe0] bg-white px-3.5 text-sm font-medium text-[#30343a]"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </button>
          <button
            type="button"
            disabled
            className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#d7dbe0] bg-[#f3f4f6] px-3.5 text-sm font-medium text-[#9aa1a9]"
          >
            <Plus className="h-4 w-4" />
            Add to dashboard
            <span className="rounded bg-[#ddff35] px-1.5 py-0.5 text-[10px] font-bold text-[#2c1929]">
              New
            </span>
          </button>
        </div>
      </div>

      <div className="mt-10 flex flex-col items-center px-4 py-10 text-center">
        <svg
          width="88"
          height="72"
          viewBox="0 0 88 72"
          fill="none"
          aria-hidden="true"
          className="mb-5"
        >
          <rect x="18" y="18" width="44" height="36" rx="6" fill="#e8eaed" />
          <rect x="26" y="28" width="28" height="4" rx="2" fill="#c5cad1" />
          <rect x="26" y="36" width="20" height="4" rx="2" fill="#c5cad1" />
          <circle
            cx="62"
            cy="48"
            r="14"
            fill="#dfe3e8"
            stroke="#b8bec6"
            strokeWidth="3"
          />
          <path
            d="M71 57 L79 65"
            stroke="#b8bec6"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
        <p className="text-[16px] font-semibold text-[#30343a]">
          Oops! Nothing found, try another search
        </p>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#6b7280]">
          You can use the filter tools to narrow down your search. Check if the
          current date range suits your needs.
        </p>
      </div>
    </section>
  );
}

function unavailableSeries(start: string, end: string) {
  return enumerateDates(start, end).map((date) => ({
    date,
    value: metricValue(null),
  }));
}

type ChartSeriesPoint = {
  date: string;
  value: number | null;
  coverage?: "confirmed" | "uncovered";
};

function seriesToPoints(
  series: ChartSeriesPoint[] | undefined,
  start: string,
  end: string,
) {
  if (!series) {
    return unavailableSeries(start, end);
  }
  return series.map((point) => ({
    date: point.date,
    value:
      point.coverage === "uncovered" || point.value === null
        ? metricValue(null)
        : metricValue(point.value),
  }));
}

function ChartBlock({
  title,
  cards,
  greyStats,
  start,
  end,
  seriesLabel,
  series,
  seriesByKey,
  defaultSeriesKey,
  notice,
}: {
  title: string;
  cards: ColorCard[];
  greyStats?: Array<{ value: number | null; label: string }>;
  start: string;
  end: string;
  seriesLabel: string;
  /** Default series when seriesByKey is not used. */
  series?: ChartSeriesPoint[];
  /**
   * Per-card series. Hover/focus switches the plotted series.
   * Missing / undefined entry → empty chart (no fabricated zeros).
   */
  seriesByKey?: Record<string, ChartSeriesPoint[] | undefined>;
  /** Card key whose series is shown when nothing is hovered. */
  defaultSeriesKey?: string;
  notice?: string | null;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const resolvedKey = activeKey ?? defaultSeriesKey ?? null;
  const active = cards.find((card) => card.key === resolvedKey) ?? null;
  const activeSeries = useMemo(() => {
    if (seriesByKey && resolvedKey) {
      return seriesByKey[resolvedKey];
    }
    if (seriesByKey && defaultSeriesKey) {
      return seriesByKey[defaultSeriesKey];
    }
    return series;
  }, [seriesByKey, series, resolvedKey, defaultSeriesKey]);

  const points = useMemo(
    () => seriesToPoints(activeSeries, start, end),
    [activeSeries, start, end],
  );

  return (
    <section className="rounded-[14px] border border-[#e8eaed] bg-white px-5 py-6 sm:px-6">
      <h2 className="mb-4 text-[18px] font-semibold text-[#20242A]">{title}</h2>

      {notice ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-[10px] border border-[#f0d48a] bg-[#fff8e6] px-4 py-3 text-sm text-[#6b5400]">
          <span aria-hidden="true" className="mt-0.5 text-[#d4a017]">
            ▲
          </span>
          <p>{notice}</p>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2.5">
        {cards.map((card) => (
          <ColorMetricCard
            key={card.key}
            card={card}
            active={activeKey === card.key}
            onActive={setActiveKey}
          />
        ))}
      </div>

      <SocialSummaryChart
        points={points}
        seriesLabel={active?.label ?? seriesLabel}
        seriesColor={active?.color ?? "#98A2AB"}
        showMarkers={false}
      />

      {greyStats?.length ? (
        <div className="mt-4 flex flex-wrap gap-2.5">
          {greyStats.map((stat) => (
            <GreyStatCard
              key={stat.label}
              value={stat.value}
              label={stat.label}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function InfoBanners() {
  return (
    <div className="space-y-3">
      <div className="flex gap-3 rounded-[10px] border border-[#c5d4f7] bg-[#eef3ff] px-4 py-3 text-[13px] leading-5 text-[#3d4a66]">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6b82c7] text-[11px] font-bold text-white">
          i
        </span>
        <p>
          Meta replaced legacy Page impressions with media views. TAKATAK maps
          Views to Meta&apos;s page_media_view metric when available.
        </p>
      </div>
      <div className="flex gap-3 rounded-[10px] border border-[#c5d4f7] bg-[#eef3ff] px-4 py-3 text-[13px] leading-5 text-[#3d4a66]">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6b82c7] text-[11px] font-bold text-white">
          i
        </span>
        <p>
          On June 16, 2026, Meta deprecated the metric behind the Views box in
          Posts viewed in period, so it is only available for date ranges up to
          that day.
        </p>
      </div>
    </div>
  );
}

export type FacebookAnalyticsLiveData = {
  /** Point-in-time Page total (followers_count|fan_count). */
  lifetimeFollowers: number | null;
  /** Display date for the lifetime snapshot (≤ selected end). */
  lifetimeFollowersAsOf?: string | null;
  lifetimeFollowersProvenance?: string | null;
  /** End − start when both confirmed; otherwise null (—). */
  netFollowerChange: number | null;
  followersAcquired: number | null;
  followersLost: number | null;
  mediaViews: number | null;
  mediaViewsCoveredThrough?: string | null;
  mediaViewsCoveredFrom?: string | null;
  mediaViewsIsPartial?: boolean;
  uniqueMediaViews: number | null;
  viewsSeries?: Array<{
    date: string;
    value: number | null;
    coverage?: "confirmed" | "uncovered";
  }>;
  metricCoverage?: Record<
    string,
    {
      value: number | null;
      coveredThrough: string | null;
      coveredFrom?: string | null;
      isPartial: boolean;
      provenance: string;
      status: string;
      notice: string | null;
      kind?: string;
      chartAvailable?: boolean;
    }
  > | null;
  coverageNotice?: string | null;
  coveragePartial?: boolean;
};

function OverviewSection({
  start,
  end,
  live,
}: {
  start: string;
  end: string;
  live?: FacebookAnalyticsLiveData | null;
}) {
  const hasLive = Boolean(live);
  const hasConfirmedGrowth =
    live?.mediaViews != null || live?.lifetimeFollowers != null;
  const viewsUnavailableNotice =
    live?.mediaViews == null
      ? (live?.metricCoverage?.views?.notice ?? live?.coverageNotice ?? null)
      : null;
  const growthNotice = viewsUnavailableNotice
    ? viewsUnavailableNotice
    : live?.coveragePartial
      ? live.coverageNotice ??
        "Partial coverage for this range — confirmed totals are shown through the last synchronized day."
      : !hasLive
        ? "Growth metrics load after a successful Page sync."
        : !hasConfirmedGrowth
          ? "Media views and lifetime followers are not available for this period."
          : null;

  const viewsHoverLabel =
    live?.mediaViews != null && live.mediaViewsCoveredThrough
      ? live.mediaViewsCoveredFrom &&
        live.mediaViewsCoveredFrom !== live.mediaViewsCoveredThrough
        ? `Views · ${displayDateShort(live.mediaViewsCoveredFrom)}–${displayDateShort(live.mediaViewsCoveredThrough)}`
        : live.mediaViewsIsPartial
          ? `Views · through ${displayDateShort(live.mediaViewsCoveredThrough)}`
          : "Views"
      : "Views";

  const lifetimeHoverLabel = live?.lifetimeFollowersAsOf
    ? `Lifetime followers · ${displayDateShort(live.lifetimeFollowersAsOf)}`
    : "Lifetime followers";

  const chartSeries =
    live?.metricCoverage?.views?.chartAvailable === true
      ? live?.viewsSeries
      : undefined;

  return (
    <div id="fb-overview" className="scroll-mt-[220px] space-y-6">
      <InfoBanners />

      <ChartBlock
        title="Growth"
        start={start}
        end={end}
        seriesLabel="Views"
        defaultSeriesKey="views"
        seriesByKey={{
          // Lifetime is a point-in-time snapshot — never plot Views dailies as Followers.
          "lifetime-followers": undefined,
          "net-followers": undefined,
          views: chartSeries,
          visits: undefined,
          content: undefined,
        }}
        notice={growthNotice}
        cards={[
          {
            key: "lifetime-followers",
            label: "Lifetime followers",
            hoverLabel: lifetimeHoverLabel,
            color: "#51A76A",
            value: hasLive ? live!.lifetimeFollowers : null,
          },
          {
            key: "net-followers",
            label: "Net follower change",
            color: "#6BAE6B",
            value: hasLive ? live!.netFollowerChange : null,
          },
          {
            key: "views",
            label: "Views",
            hoverLabel: viewsHoverLabel,
            color: "#E7A4B8",
            value: hasLive ? live!.mediaViews : null,
          },
          {
            key: "visits",
            label: "Page visits",
            color: "#98A2AB",
            value: hasLive
              ? (live!.metricCoverage?.page_visits?.value ?? null)
              : null,
          },
          {
            key: "content",
            label: "Total content",
            color: "#E4A934",
            value: hasLive
              ? (live!.metricCoverage?.total_content?.value ?? null)
              : null,
          },
        ]}
        greyStats={[
          { value: null, label: "Average daily new followers" },
          { value: null, label: "Daily page views" },
          { value: null, label: "Daily posts" },
          { value: null, label: "Posts per week" },
        ]}
      />

      <ChartBlock
        title="Balance of Followers"
        start={start}
        end={end}
        seriesLabel="Acquired"
        defaultSeriesKey="acquired"
        seriesByKey={{
          acquired: undefined,
          lost: undefined,
          "total-content": undefined,
        }}
        notice={
          live?.metricCoverage?.followers_acquired?.status === "unavailable" &&
          live?.metricCoverage?.followers_lost?.status === "unavailable"
            ? live?.metricCoverage?.followers_acquired?.notice ??
              "Acquired and Lost require daily Meta follow/unfollow insights, which are not synchronized yet. Values stay — (not zero)."
            : live?.metricCoverage?.followers_acquired?.notice ??
              live?.metricCoverage?.followers_lost?.notice ??
              null
        }
        cards={[
          {
            key: "acquired",
            label: "Acquired",
            color: "#8B95F4",
            value: hasLive ? live!.followersAcquired : null,
          },
          {
            key: "lost",
            label: "Lost",
            color: "#FEB1E9",
            value: hasLive ? live!.followersLost : null,
          },
          {
            key: "total-content",
            label: "Total content",
            color: "#E4A934",
            value: null,
          },
        ]}
      />

      <ChartBlock
        title="Posts viewed in period"
        start={start}
        end={end}
        seriesLabel="Reactions"
        defaultSeriesKey="reactions"
        seriesByKey={{
          reactions: undefined,
        }}
        notice={
          live?.metricCoverage?.reactions?.notice ??
          "Reactions are unavailable until post-level Meta engagement is synchronized."
        }
        cards={[
          {
            key: "reactions",
            label: "Reactions",
            color: "#51A76A",
            value: null,
          },
        ]}
      />
    </div>
  );
}

function TypesAndViews() {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-[14px] border border-[#e8eaed] bg-white px-5 py-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-[#20242A]">Types</h3>
          <button
            type="button"
            className="text-xs font-semibold text-[#566DF1]"
          >
            View table
          </button>
        </div>
        <div className="flex min-h-[120px] items-center justify-center text-sm text-[#6b7280]">
          No post types in this period.
        </div>
      </div>
      <div className="rounded-[14px] border border-[#e8eaed] bg-white px-5 py-5">
        <h3 className="mb-3 text-[16px] font-semibold text-[#20242A]">Views</h3>
        <div className="flex items-start gap-2.5 rounded-[10px] border border-[#f0d48a] bg-[#fff8e6] px-4 py-3 text-sm text-[#6b5400]">
          <span aria-hidden="true" className="mt-0.5 text-[#d4a017]">
            ▲
          </span>
          <p>Impressions data is not available for the current period.</p>
        </div>
      </div>
    </section>
  );
}

function DemographicsSection({ start, end }: { start: string; end: string }) {
  return (
    <div id="fb-demographics" className="scroll-mt-[220px] space-y-6">
      <section className="rounded-[14px] border border-[#e8eaed] bg-white px-5 py-6 sm:px-6">
        <h2 className="mb-4 text-[18px] font-semibold text-[#20242A]">
          Demographics
        </h2>
        <div className="mb-5 flex items-start gap-2.5 rounded-[10px] border border-[#f0d48a] bg-[#fff8e6] px-4 py-3 text-sm text-[#6b5400]">
          <span aria-hidden="true" className="mt-0.5 text-[#d4a017]">
            ▲
          </span>
          <p>
            Follower demographics appear only when Meta returns breakdowns that
            clear privacy thresholds. Missing segments stay empty — values are
            never inferred.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#30343A]">
                Followers by country
              </h3>
              <button
                type="button"
                className="text-xs font-semibold text-[#566DF1]"
              >
                View table
              </button>
            </div>
            <div className="flex min-h-[180px] items-center justify-center rounded-[10px] border border-dashed border-[#e1e4e7] bg-[#fafbfc] text-sm text-[#6b7280]">
              No data available
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#30343A]">
                Followers by city
              </h3>
              <button
                type="button"
                className="text-xs font-semibold text-[#566DF1]"
              >
                View chart
              </button>
            </div>
            <div className="overflow-hidden rounded-[10px] border border-[#e1e4e7]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#fafbfc] text-xs uppercase tracking-wide text-[#6b7280]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Group</th>
                    <th className="px-4 py-3 font-semibold">Count</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-10 text-center text-[#6b7280]"
                    >
                      No data available
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <ChartBlock
        title="Posts published in period"
        start={start}
        end={end}
        seriesLabel="Posts"
        notice="Post counts and engagement are unavailable until post-level Meta sync is enabled."
        cards={[
          {
            key: "engagement",
            label: "Engagement",
            color: "#8B95F4",
            value: null,
          },
          {
            key: "interactions",
            label: "Interactions",
            color: "#6BAE6B",
            value: null,
          },
          {
            key: "avg-reach",
            label: "Avg. reach per post",
            color: "#E7A4B8",
            value: null,
          },
          { key: "views", label: "Views", color: "#A08DB8", value: null },
          { key: "posts", label: "Posts", color: "#E4A934", value: null },
        ]}
      />
    </div>
  );
}

function PostsSection({
  start,
  end,
  liveMode,
  compareEnabled,
}: {
  start: string;
  end: string;
  liveMode: boolean;
  compareEnabled: boolean;
}) {
  return (
    <div id="fb-posts" className="scroll-mt-[220px] space-y-6">
      <h2 className="text-[18px] font-semibold text-[#20242A]">
        Posts published in period
      </h2>
      <p className="text-sm text-[#6b7280]">
        Confirmed post-level metrics only. Page daily insights are not mixed
        into this view. 0 means confirmed zero; — means unavailable.
      </p>
      <FacebookContentListPanel
        contentType="post"
        start={start}
        end={end}
        compareEnabled={compareEnabled}
        liveMode={liveMode}
      />
    </div>
  );
}

function ReelsSection({
  start,
  end,
  liveMode,
  compareEnabled,
}: {
  start: string;
  end: string;
  liveMode: boolean;
  compareEnabled: boolean;
}) {
  return (
    <div id="fb-reels" className="scroll-mt-[220px] space-y-6">
      <h2 className="text-[18px] font-semibold text-[#20242A]">
        Reels published in period
      </h2>
      <p className="text-sm text-[#6b7280]">
        Reels stay separate from posts and stories. Metrics appear only when
        Meta returns confirmed values for this Reel.
      </p>
      <FacebookContentListPanel
        contentType="reel"
        start={start}
        end={end}
        compareEnabled={compareEnabled}
        liveMode={liveMode}
      />
    </div>
  );
}

function StoriesSection({
  start,
  end,
  liveMode,
  compareEnabled,
}: {
  start: string;
  end: string;
  liveMode: boolean;
  compareEnabled: boolean;
}) {
  return (
    <div id="fb-stories" className="scroll-mt-[220px] space-y-6">
      <h2 className="text-[18px] font-semibold text-[#20242A]">
        Stories published in period
      </h2>
      <p className="text-sm text-[#6b7280]">
        Expired Stories keep confirmed historical metrics and are marked
        expired. Missing Story metrics stay —.
      </p>
      <FacebookContentListPanel
        contentType="story"
        start={start}
        end={end}
        compareEnabled={compareEnabled}
        liveMode={liveMode}
      />
    </div>
  );
}

function CompetitorsSection({ liveMode }: { liveMode: boolean }) {
  return <FacebookCompetitorsPanel liveMode={liveMode} />;
}

export function FacebookSubscribedDashboard({
  mode = "preview",
  live = null,
  rangeDays,
  onRangeDaysChange,
  compareEnabled = false,
  onCompareEnabledChange,
  rangeLabel,
}: {
  mode?: "preview" | "live";
  live?: FacebookAnalyticsLiveData | null;
  /** Controlled main period length (days). Uncontrolled uses local state. */
  rangeDays?: number;
  onRangeDaysChange?: (days: number) => void;
  compareEnabled?: boolean;
  onCompareEnabledChange?: (enabled: boolean) => void;
  /** Optional override for the main-period date label (e.g. sync-selected range). */
  rangeLabel?: { start: string; end: string } | null;
} = {}) {
  const [tab, setTab] = useState<FacebookTab>("overview");
  const [localRange, setLocalRange] = useState<number>(30);
  const range = rangeDays ?? localRange;
  const setRange = onRangeDaysChange ?? setLocalRange;
  const isPreview = mode === "preview";

  const { start, end } = useMemo(() => {
    if (rangeLabel?.start && rangeLabel?.end) {
      return { start: rangeLabel.start, end: rangeLabel.end };
    }
    const endDate = new Date();
    endDate.setUTCHours(12, 0, 0, 0);
    const startDate = new Date(endDate);
    startDate.setUTCDate(endDate.getUTCDate() - range + 1);
    return { start: dateKey(startDate), end: dateKey(endDate) };
  }, [range, rangeLabel?.start, rangeLabel?.end]);

  function scrollToSection(id: string, key: FacebookTab) {
    setTab(key);
    const node = document.getElementById(id);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div
      className="space-y-5 px-1 pb-24"
      style={{ backgroundColor: SUMMARY_PAGE_BG }}
    >
      {isPreview ? (
        <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Preview layout only. Metrics below are placeholders (—), not
          synchronized Facebook data. Connect and confirm a Page to load real
          analytics.
        </div>
      ) : null}
      <div
        className="sticky top-[66px] z-20 -mx-1 mb-1 flex flex-col gap-3 border-b border-[#E1E4E7] px-1 pb-3 pt-3 sm:flex-row sm:items-end sm:justify-between"
        style={{ backgroundColor: SUMMARY_PAGE_BG }}
      >
        <nav
          aria-label="Facebook analytics sections"
          className="hidden min-w-0 flex-1 gap-1 overflow-x-auto lg:flex"
        >
          {TABS.map((item) => {
            const selected = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => scrollToSection(item.href, item.key)}
                className={`relative min-w-fit px-3 py-3 text-[12px] font-semibold tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#566DF1] ${
                  selected
                    ? "text-[#20242A]"
                    : "text-[#6B7280] hover:text-[#20242A]"
                }`}
              >
                {item.label}
                {selected ? (
                  <span className="absolute inset-x-2 bottom-0 h-[2px] bg-[#20242A]" />
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="mb-2 ml-auto flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#6B7280]">
            <span>Main period</span>
            <span className="flex h-11 items-center gap-2 rounded-[10px] border border-[#D7DBE0] bg-white px-3 text-sm text-[#30343A] shadow-sm">
              <span className="font-medium text-[#20242A]">
                {displayDate(start)} - {displayDate(end)}
              </span>
              <CalendarDays className="h-4 w-4 text-[#9AA1A9]" />
              <select
                value={range}
                onChange={(event) => setRange(Number(event.target.value))}
                aria-label="Select Facebook date range"
                className="max-w-[130px] bg-transparent text-[#505761] outline-none"
              >
                {RANGES.map((days) => (
                  <option key={days} value={days}>
                    {days === 365 ? "Last 12 months" : `Last ${days} days`}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#6B7280]">
            <span>Comparison period</span>
            <button
              type="button"
              onClick={() => {
                onCompareEnabledChange?.(!compareEnabled);
              }}
              className={`inline-flex h-11 items-center gap-2 rounded-[10px] border px-3 text-sm font-medium shadow-sm ${
                compareEnabled
                  ? "border-[#8996F6] bg-[#EEF0FF] text-[#30343A]"
                  : "border-[#D7DBE0] bg-white text-[#505761]"
              }`}
            >
              <GitCompareArrows className="h-4 w-4 text-[#9AA1A9]" />
              {compareEnabled
                ? "Comparison on"
                : "Create comparison view"}
            </button>
          </label>
        </div>
      </div>

      <div className="lg:hidden">
        <label className="sr-only" htmlFor="facebook-mobile-tab">
          Facebook section
        </label>
        <select
          id="facebook-mobile-tab"
          value={tab}
          onChange={(event) => {
            const next = event.target.value as FacebookTab;
            const match = TABS.find((item) => item.key === next);
            if (match) {
              scrollToSection(match.href, match.key);
            }
          }}
          className="h-11 w-full rounded-[10px] border border-[#D7DBE0] bg-white px-3 text-sm font-semibold text-[#20242A]"
        >
          {TABS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-10 pt-4">
        <OverviewSection
          start={start}
          end={end}
          live={isPreview ? null : live}
        />
        <DemographicsSection start={start} end={end} />
        <PostsSection
          start={start}
          end={end}
          liveMode={!isPreview}
          compareEnabled={compareEnabled}
        />
        <ReelsSection
          start={start}
          end={end}
          liveMode={!isPreview}
          compareEnabled={compareEnabled}
        />
        <StoriesSection
          start={start}
          end={end}
          liveMode={!isPreview}
          compareEnabled={compareEnabled}
        />
        <CompetitorsSection liveMode={!isPreview} />
      </div>
    </div>
  );
}
