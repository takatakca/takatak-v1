"use client";

import {
  CalendarDays,
  GitCompareArrows,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SocialSummaryChart } from "@/components/social/analytics/social-summary-chart";
import {
  dateKey,
  displayDate,
  enumerateDates,
  metricValue,
} from "@/components/social/analytics/social-summary-tokens";

type InstagramTab =
  | "community"
  | "account"
  | "posts"
  | "reels"
  | "stories"
  | "collabs"
  | "competitors";

type InstagramMetric = number | null;

export type InstagramCommunityData = {
  followers: InstagramMetric;
  following: InstagramMetric;
  totalContent: InstagramMetric;
  dailyFollowers: InstagramMetric;
  followersPerPost: InstagramMetric;
  dailyPosts: InstagramMetric;
  postsPerWeek: InstagramMetric;
  acquired: InstagramMetric;
  lost: InstagramMetric;
  followersSeries?: Array<{
    date: string;
    value: number | null;
  }>;
  acquiredSeries?: Array<{
    date: string;
    value: number | null;
  }>;
  lostSeries?: Array<{
    date: string;
    value: number | null;
  }>;
};

const EMPTY_DATA: InstagramCommunityData = {
  followers: null,
  following: null,
  totalContent: null,
  dailyFollowers: null,
  followersPerPost: null,
  dailyPosts: null,
  postsPerWeek: null,
  acquired: null,
  lost: null,
};

const TABS: Array<{
  key: InstagramTab;
  label: string;
}> = [
  { key: "community", label: "COMMUNITY" },
  { key: "account", label: "ACCOUNT" },
  { key: "posts", label: "POSTS" },
  { key: "reels", label: "REELS" },
  { key: "stories", label: "STORIES" },
  { key: "collabs", label: "COLLABS" },
  { key: "competitors", label: "COMPETITORS" },
];

const RANGES = [30, 90, 180, 365] as const;

function formatValue(value: number | null): string {
  return value === null ? "—" : value.toLocaleString();
}

function dateSeries(
  series: Array<{ date: string; value: number | null }> | undefined,
  start: string,
  end: string,
) {
  const values = new Map(
    (series ?? []).map((point) => [point.date, point.value]),
  );

  return enumerateDates(start, end).map((date) => ({
    date,
    value: metricValue(values.has(date) ? (values.get(date) ?? null) : null),
  }));
}

function ColoredMetricCard({
  value,
  label,
  color,
  muted = false,
}: {
  value: number | null;
  label: string;
  color: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex h-[88px] min-w-[150px] flex-1 flex-col items-center justify-center rounded-[10px] px-4 py-3 text-center ${
        muted ? "opacity-35" : ""
      }`}
      style={{ backgroundColor: color }}
    >
      <p className="text-[27px] font-medium leading-none text-[#20242A]">
        {formatValue(value)}
      </p>
      <p className="mt-2 text-[13px] font-medium text-[#30343A]">
        {label}
      </p>
    </div>
  );
}

function GreyMetricCard({
  value,
  label,
}: {
  value: number | null;
  label: string;
}) {
  return (
    <div className="flex min-h-[88px] min-w-[145px] flex-1 flex-col items-center justify-center rounded-[10px] bg-[#EDEEF2] px-3 py-3 text-center">
      <p className="text-[24px] font-medium leading-none text-[#20242A]">
        {formatValue(value)}
      </p>
      <p className="mt-2 text-[12px] font-medium text-[#5F6770]">
        {label}
      </p>
    </div>
  );
}

function CommunitySection({
  data,
  start,
  end,
  accountName,
  profileImageUrl,
}: {
  data: InstagramCommunityData;
  start: string;
  end: string;
  accountName: string;
  profileImageUrl: string | null;
}) {
  const growthPoints = useMemo(
    () => dateSeries(data.followersSeries, start, end),
    [data.followersSeries, start, end],
  );

  const balancePoints = useMemo(() => {
    if (data.acquiredSeries?.length) {
      return dateSeries(data.acquiredSeries, start, end);
    }

    return dateSeries(data.lostSeries, start, end);
  }, [data.acquiredSeries, data.lostSeries, start, end]);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[23px] font-medium text-[#20242A]">
          Community
        </h1>

        <div className="flex min-w-0 items-center gap-3">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
            {profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profileImageUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-9 w-9 rounded-full border border-[#E5E7EB] object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCAF45] text-sm font-semibold text-white">
                {accountName.slice(0, 1).toUpperCase()}
              </span>
            )}

            <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-2 border-[#FCFCFD] bg-[#FF0069] text-white shadow-sm">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </span>
          </span>

          <span
            className="max-w-[240px] truncate text-sm font-medium text-[#20242A]"
            title={accountName}
          >
            {accountName}
          </span>
        </div>
      </div>

      <section className="rounded-[14px] border border-[#E8EAED] bg-white px-5 py-6 shadow-[0_2px_12px_rgba(31,41,55,0.04)] sm:px-7">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <h2 className="pt-2 text-[18px] font-medium text-[#20242A]">
              Growth
            </h2>

            <div className="flex w-full flex-wrap gap-3 xl:max-w-[600px]">
              <ColoredMetricCard
                value={data.followers}
                label="Followers"
                color="#8994F0"
              />
              <ColoredMetricCard
                value={data.following}
                label="Following"
                color="#DDEDE2"
                muted={data.following === null}
              />
              <ColoredMetricCard
                value={data.totalContent}
                label="Total content"
                color="#E9AA2C"
              />
            </div>
          </div>

          <SocialSummaryChart
            points={growthPoints}
            seriesLabel="Followers"
            seriesColor="#C58AB5"
            showMarkers
          />

          <div className="flex flex-wrap gap-3">
            <GreyMetricCard
              value={data.followers}
              label="Followers"
            />
            <GreyMetricCard
              value={data.dailyFollowers}
              label="Daily followers"
            />
            <GreyMetricCard
              value={data.followersPerPost}
              label="Followers per post"
            />
            <GreyMetricCard
              value={data.following}
              label="Following"
            />
            <GreyMetricCard
              value={data.dailyPosts}
              label="Daily posts"
            />
            <GreyMetricCard
              value={data.postsPerWeek}
              label="Posts per week"
            />
          </div>
        </div>
      </section>

      <section className="rounded-[14px] border border-[#E8EAED] bg-white px-5 py-6 shadow-[0_2px_12px_rgba(31,41,55,0.04)] sm:px-7">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <h2 className="pt-2 text-[18px] font-medium text-[#20242A]">
              Balance of Followers
            </h2>

            <div className="flex w-full flex-wrap gap-3 xl:max-w-[600px]">
              <ColoredMetricCard
                value={data.acquired}
                label="Acquired"
                color="#8994F0"
              />
              <ColoredMetricCard
                value={data.lost}
                label="Lost"
                color="#EFA0DA"
              />
              <ColoredMetricCard
                value={data.totalContent}
                label="Total content"
                color="#E9AA2C"
              />
            </div>
          </div>

          <SocialSummaryChart
            points={balancePoints}
            seriesLabel={
              data.acquiredSeries?.length ? "Acquired" : "Lost"
            }
            seriesColor={
              data.acquiredSeries?.length ? "#8994F0" : "#EFA0DA"
            }
            showMarkers
          />
        </div>
      </section>

          </div>
  );
}


function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EmptyAccountChart() {
  return (
    <div className="flex min-h-[390px] flex-col items-center justify-center px-5 py-10 text-center">
      <span className="flex h-[142px] w-[142px] items-center justify-center rounded-full bg-[#F1F5FD] text-white">
        <svg
          viewBox="0 0 96 96"
          aria-hidden="true"
          className="h-[78px] w-[78px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 72V53" />
          <path d="M36 72V42" />
          <path d="M54 72V58" />
          <path d="M72 72V34" />
          <path d="m17 35 18-15 17 13 25-24" />
          <path d="m68 9h9v9" />
        </svg>
      </span>

      <h3 className="mt-5 text-[22px] font-medium text-[#30343A]">
        No data available
      </h3>

      <p className="mt-3 text-[15px] text-[#93A0AD]">
        Start publishing content to see how your results evolve
      </p>

      <Link
        href="/dashboard/social/calendar"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-[9px] border border-[#493546] bg-white px-6 text-sm font-medium text-[#30242E] transition hover:bg-[#F8F8F8]"
      >
        Go to calendar
      </Link>
    </div>
  );
}

type InstagramAccountView =
  | "general"
  | "reach"
  | "interactions"
  | "profile";

const ACCOUNT_VIEWS: Array<{
  key: InstagramAccountView;
  label: string;
  locked: boolean;
}> = [
  {
    key: "general",
    label: "General evolution",
    locked: false,
  },
  {
    key: "reach",
    label: "Reach / Views",
    locked: true,
  },
  {
    key: "interactions",
    label: "Interactions",
    locked: true,
  },
  {
    key: "profile",
    label: "Profile activity",
    locked: true,
  },
];

const ADVANCED_ACCOUNT_CONTENT: Record<
  Exclude<InstagramAccountView, "general">,
  {
    metric: string;
    divideBy: string;
    title: string;
  }
> = {
  reach: {
    metric: "Views",
    divideBy: "Follower type",
    title: "Activate Advanced to see this data",
  },
  interactions: {
    metric: "Total interactions",
    divideBy: "Content type",
    title:
      "Understand which content generates the most interaction",
  },
  profile: {
    metric: "Profile clicks",
    divideBy: "Button type",
    title:
      "Identify what generates the most clicks on your profile",
  },
};

function AdvancedAccountContent({
  view,
}: {
  view: Exclude<InstagramAccountView, "general">;
}) {
  const content = ADVANCED_ACCOUNT_CONTENT[view];

  return (
    <>
      <div className="mt-8 flex flex-col gap-5 sm:flex-row">
        <label className="block w-full max-w-[325px] text-sm text-[#81909D]">
          <span className="mb-2 block">
            Metric
          </span>

          <select
            value={content.metric}
            onChange={() => undefined}
            aria-label={`${content.metric} metric`}
            className="h-[58px] w-full rounded-[9px] border border-[#9EAFBC] bg-white px-4 text-[16px] text-[#81909D] outline-none"
          >
            <option value={content.metric}>
              {content.metric}
            </option>
          </select>
        </label>

        <label className="block w-full max-w-[325px] text-sm text-[#81909D]">
          <span className="mb-2 block">
            Divide by
          </span>

          <select
            value={content.divideBy}
            onChange={() => undefined}
            aria-label="Divide Instagram account analytics"
            className="h-[58px] w-full rounded-[9px] border border-[#9EAFBC] bg-white px-4 text-[16px] text-[#81909D] outline-none"
          >
            <option value={content.divideBy}>
              {content.divideBy}
            </option>
          </select>
        </label>
      </div>

      <div className="flex min-h-[500px] flex-col items-center justify-center px-5 pb-14 pt-12 text-center">
        <span className="flex h-[142px] w-[142px] items-center justify-center rounded-[48%_52%_46%_54%/55%_44%_56%_45%] bg-[#F1F5FD] text-white">
          <svg
            viewBox="0 0 96 96"
            aria-hidden="true"
            className="h-[78px] w-[78px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 72V53" />
            <path d="M36 72V42" />
            <path d="M54 72V58" />
            <path d="M72 72V34" />
            <path d="m17 35 18-15 17 13 25-24" />
            <path d="m68 9h9v9" />
          </svg>
        </span>

        <h3 className="mt-6 max-w-[820px] text-[25px] font-normal leading-tight text-[#292D34]">
          {content.title}
        </h3>

        <p className="mt-4 text-[16px] text-[#91A0AC]">
          This data starts being collected when you activate Advanced
        </p>

        <Link
          href="/dashboard/billing"
          className="mt-6 inline-flex h-[53px] items-center justify-center rounded-[9px] bg-[#2C1929] px-7 text-[15px] font-semibold text-[#DDFF35] transition hover:bg-[#3B2237]"
        >
          Upgrade your plan
        </Link>
      </div>
    </>
  );
}

function AccountSection({
  data,
}: {
  data: InstagramCommunityData;
}) {
  const [accountView, setAccountView] =
    useState<InstagramAccountView>("general");

  const hasAccountData =
    data.totalContent !== null ||
    Boolean(data.followersSeries?.length);

  return (
    <div className="space-y-7">
      <h1 className="text-[23px] font-medium text-[#20242A]">
        Account
      </h1>

      <section className="overflow-hidden rounded-[14px] border border-[#E8EAED] bg-white px-5 pb-2 pt-6 shadow-[0_2px_12px_rgba(31,41,55,0.04)] sm:px-7">
        <div
          role="tablist"
          aria-label="Instagram Account analytics"
          className="grid overflow-hidden rounded-[9px] bg-[#ECEFF1] sm:grid-cols-4"
        >
          {ACCOUNT_VIEWS.map((item) => {
            const selected = accountView === item.key;

            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`instagram-account-${item.key}`}
                id={`instagram-account-tab-${item.key}`}
                onClick={() => setAccountView(item.key)}
                className={`flex min-h-[48px] items-center justify-center gap-2 rounded-[8px] px-4 py-3 text-sm font-semibold transition ${
                  selected
                    ? "border border-[#E3E6E9] bg-white text-[#20242A] shadow-sm"
                    : "text-[#8A929A] hover:text-[#505761]"
                }`}
              >
                {item.locked ? <LockIcon /> : null}
                {item.label}
              </button>
            );
          })}
        </div>

        <div
          id={`instagram-account-${accountView}`}
          role="tabpanel"
          aria-labelledby={`instagram-account-tab-${accountView}`}
        >
          {accountView === "general" ? (
            <>
              <label className="mt-8 block max-w-[260px] text-sm text-[#8B97A2]">
                <span className="mb-2 block">
                  Metric
                </span>

                <select
                  className="h-12 w-full rounded-[9px] border border-[#B7C0C9] bg-white px-3 text-sm text-[#87939E] outline-none"
                  defaultValue="general"
                  aria-label="Instagram account metric"
                >
                  <option value="general">
                    General evolution
                  </option>
                </select>
              </label>

              {hasAccountData ? (
                <div className="mt-8 min-h-[390px]">
                  <SocialSummaryChart
                    points={dateSeries(
                      data.followersSeries,
                      data.followersSeries?.[0]?.date ??
                        dateKey(new Date()),
                      data.followersSeries?.at(-1)?.date ??
                        dateKey(new Date()),
                    )}
                    seriesLabel="General evolution"
                    seriesColor="#8994F0"
                    showMarkers
                  />
                </div>
              ) : (
                <EmptyAccountChart />
              )}
            </>
          ) : (
            <AdvancedAccountContent view={accountView} />
          )}
        </div>
      </section>

    </div>
  );
}


function PostsActionIcon({
  kind,
}: {
  kind: "table" | "columns" | "download" | "dashboard";
}) {
  if (kind === "table") {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="4" y="5" width="16" height="14" rx="1.5" />
        <path d="M4 10h16M9 5v14M15 5v14" />
      </svg>
    );
  }

  if (kind === "columns") {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M8 5v14M16 5v14" />
      </svg>
    );
  }

  if (kind === "download") {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3v12" />
        <path d="m8 11 4 4 4-4" />
        <path d="M5 20h14" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 18V9" />
      <path d="M10 18V5" />
      <path d="M16 18v-7" />
      <path d="m3 6 5-3 5 3 7-4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  );
}

function PremiumDiamond() {
  return (
    <span className="flex h-[21px] w-[21px] items-center justify-center rounded-full bg-[#DDFF35] text-[#59610A]">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m12 20 8-9-3-6H7l-3 6 8 9Z" />
        <path d="M4 11h16M9 5l3 6 3-6" />
      </svg>
    </span>
  );
}

function EmptySearchIllustration() {
  return (
    <svg
      viewBox="0 0 280 210"
      aria-hidden="true"
      className="h-[190px] w-[250px]"
      fill="none"
    >
      <path
        d="M112 32c44-14 96 17 99 71 3 48-39 84-86 76-44-8-69-55-49-96 8-17 18-39 36-51Z"
        fill="#F1F5FD"
      />
      <circle
        cx="154"
        cy="104"
        r="55"
        stroke="#1F2329"
        strokeWidth="10"
      />
      <path
        d="m194 145 42 42"
        stroke="#1F2329"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <rect
        x="29"
        y="83"
        width="127"
        height="42"
        rx="9"
        fill="white"
        stroke="#E2EAF4"
        strokeWidth="2"
      />
      <rect
        x="45"
        y="96"
        width="25"
        height="16"
        rx="8"
        fill="#E4ECF5"
      />
      <circle cx="51" cy="104" r="6" fill="white" />
      <rect
        x="78"
        y="97"
        width="35"
        height="14"
        rx="4"
        fill="#E4ECF5"
      />
      <rect
        x="119"
        y="97"
        width="16"
        height="14"
        rx="4"
        fill="#E4ECF5"
      />
      <rect
        x="139"
        y="97"
        width="16"
        height="14"
        rx="4"
        fill="#E4ECF5"
      />
    </svg>
  );
}

function PostsMetricCard({
  value,
  label,
}: {
  value: number | null;
  label: string;
}) {
  return (
    <div className="flex min-h-[92px] min-w-[165px] flex-1 flex-col items-center justify-center rounded-[9px] bg-[#E8EAEC] px-4 py-4 text-center">
      <p className="text-[22px] font-normal leading-none text-[#20242A]">
        {formatValue(value)}
      </p>
      <p className="mt-3 text-[12px] font-medium text-[#505761]">
        {label}
      </p>
    </div>
  );
}

function PostsChartPanel({
  title,
}: {
  title: string;
}) {
  /*
   * This state belongs to this individual panel instance.
   * Types and Views therefore toggle independently.
   */
  const [isTableVisible, setIsTableVisible] =
    useState(false);

  return (
    <article className="min-w-0">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-[20px] font-medium text-[#20242A]">
          {title}
        </h3>

        <button
          type="button"
          aria-expanded={isTableVisible}
          aria-controls={`instagram-posts-${title.toLowerCase()}-view`}
          onClick={() => {
            setIsTableVisible((current) => !current);
          }}
          className={[
            "inline-flex min-h-8 items-center gap-2 rounded-lg px-3",
            "text-xs font-medium text-[#393D43] transition",
            "hover:bg-[#F4F5F6] hover:text-black",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-[#8994F0]",
            isTableVisible ? "bg-[#F4F5F6]" : "",
          ].join(" ")}
        >
          {isTableVisible ? (
            <>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path d="M12 3a9 9 0 1 0 9 9h-9V3Z" />
                <path d="M15 3.6A9 9 0 0 1 20.4 9H15V3.6Z" />
              </svg>
              View chart
            </>
          ) : (
            <>
              <PostsActionIcon kind="table" />
              View table
            </>
          )}
        </button>
      </div>

      <div
        id={`instagram-posts-${title.toLowerCase()}-view`}
        className="mt-5 min-h-[330px]"
      >
        {isTableVisible ? (
          <div
            role="table"
            aria-label={`${title} data table`}
            className="w-full text-sm text-[#20242A]"
          >
            <div
              role="row"
              className={[
                "grid grid-cols-[minmax(0,1fr)_auto]",
                "items-center gap-5 bg-[#FAFAFA]",
                "px-5 py-4",
              ].join(" ")}
            >
              <span role="columnheader" className="font-normal">
                Group
              </span>
              <span
                role="columnheader"
                className="min-w-16 text-right font-normal"
              >
                Count
              </span>
            </div>

            <div
              role="row"
              className="flex min-h-14 items-center justify-center px-5 py-4"
            >
              <span role="cell" className="text-[#393D43]">
                No data available
              </span>
            </div>
          </div>
        ) : (
          <div
            aria-label={`${title} chart has no synchronized data`}
            className="min-h-[330px] rounded-[10px] bg-white"
          />
        )}
      </div>
    </article>
  );
}

function downloadEmptyInstagramCsv(
  filename: string,
  columns: string[],
) {
  const csv = `${columns.join(",")}\n`;
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function PostsToolbar({
  search,
  onSearchChange,
  type,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  type: "posts" | "hashtags";
}) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">
          Search {type}
        </span>

        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#5D6670]">
          <SearchIcon />
        </span>

        <input
          type="search"
          value={search}
          onChange={(event) =>
            onSearchChange(event.target.value)
          }
          placeholder="Search"
          className="h-[42px] w-full rounded-[9px] border border-[#9EAFBC] bg-white pl-11 pr-4 text-sm text-[#30343A] outline-none transition placeholder:text-[#91A0AC] focus:border-[#6F7E89] focus:ring-2 focus:ring-[#E7EBEF]"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label={`Choose ${type} table columns`}
          className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] border border-[#D7DBE0] bg-white px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F8F9FA]"
        >
          <PostsActionIcon kind="columns" />
          Columns
        </button>

        <button
          type="button"
          onClick={() =>
            downloadEmptyInstagramCsv(
              `instagram-${type}.csv`,
              type === "posts"
                ? [
                    "post",
                    "published_at",
                    "likes",
                    "comments",
                    "views",
                  ]
                : [
                    "hashtag",
                    "posts",
                    "interactions",
                  ],
            )
          }
          className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-[#FAFDE8] px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F3F9D5]"
        >
          <PostsActionIcon kind="download" />
          Download CSV
          <PremiumDiamond />
        </button>

        {type === "posts" ? (
          <div className="relative">
            <span className="absolute -right-2 -top-4 rounded-full bg-[#DDF8ED] px-2.5 py-1 text-[10px] font-medium text-[#4E7B68]">
              New
            </span>

            <Link
              href="/dashboard/billing"
              className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-[#FAFDE8] px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F3F9D5]"
            >
              <PostsActionIcon kind="dashboard" />
              Add to dashboard
              <PremiumDiamond />
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EmptyPostsTable({
  type,
  search,
}: {
  type: "posts" | "hashtags";
  search: string;
}) {
  const hasSearch = search.trim().length > 0;

  return (
    <div className="flex min-h-[500px] flex-col items-center justify-center px-5 py-14 text-center">
      <EmptySearchIllustration />

      <h3 className="mt-2 text-[23px] font-normal text-[#292D34]">
        Oops! Nothing found, try another search
      </h3>

      <p className="mt-4 max-w-[760px] text-[14px] leading-6 text-[#91A0AC]">
        {hasSearch
          ? `No ${type} match “${search.trim()}”. Try a different search.`
          : "You can use the filter tools to narrow down your search. Check if the current date range suits your needs."}
      </p>
    </div>
  );
}

function PublishedMetricCard({
  value,
  label,
  color,
  help = false,
}: {
  value: number | null;
  label: string;
  color: string;
  help?: boolean;
}) {
  return (
    <div
      className="relative flex min-h-[86px] min-w-[155px] flex-1 flex-col items-center justify-center rounded-[9px] px-4 py-3 text-center"
      style={{ backgroundColor: color }}
    >
      {help ? (
        <span className="absolute right-2 top-2 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#28334A] text-[11px] text-[#28334A]">
          ?
        </span>
      ) : null}

      <p className="text-[24px] font-normal leading-none text-[#27303A]">
        {formatValue(value)}
      </p>

      <p className="mt-3 text-[12px] font-medium text-[#3F454C]">
        {label}
      </p>
    </div>
  );
}

function PublishedPostsChart({
  title,
  cards,
  start,
  end,
}: {
  title: string;
  cards: Array<{
    value: number | null;
    label: string;
    color: string;
    help?: boolean;
  }>;
  start: string;
  end: string;
}) {
  const emptyPoints = useMemo(
    () =>
      enumerateDates(start, end).map((date) => ({
        date,
        value: metricValue(0),
      })),
    [start, end],
  );

  return (
    <section className="px-5 py-7 sm:px-7">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <h3 className="pt-2 text-[18px] font-medium text-[#20242A]">
          {title}
        </h3>

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:max-w-[920px] xl:grid-cols-5">
          {cards.map((card) => (
            <PublishedMetricCard
              key={card.label}
              value={card.value}
              label={card.label}
              color={card.color}
              help={card.help}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 min-h-[270px]">
        <SocialSummaryChart
          points={emptyPoints}
          seriesLabel={title}
          seriesColor="#C58AB5"
          showMarkers
        />
      </div>
    </section>
  );
}

function InstagramPostsSection({
  data,
  start,
  end,
}: {
  data: InstagramCommunityData;
  start: string;
  end: string;
}) {
  const [postSearch, setPostSearch] = useState("");
  const [hashtagSearch, setHashtagSearch] = useState("");

  const confirmedEmpty = data.totalContent === 0;

  const zeroWhenConfirmedEmpty = confirmedEmpty
    ? 0
    : null;

  const organicSummaryCards = [
    {
      value: null,
      label: "Engagement",
      color: "#8994F0",
      help: true,
    },
    {
      value: zeroWhenConfirmedEmpty,
      label: "Interactions",
      color: "#96D0A7",
    },
    {
      value: null,
      label: "Avg. reach per post",
      color: "#F0A0DB",
    },
    {
      value: zeroWhenConfirmedEmpty,
      label: "Views",
      color: "#BA89B2",
    },
    {
      value: data.totalContent,
      label: "Posts",
      color: "#E9AA2C",
    },
  ];

  const organicInteractionCards = [
    {
      value: zeroWhenConfirmedEmpty,
      label: "Likes",
      color: "#96D0A7",
    },
    {
      value: zeroWhenConfirmedEmpty,
      label: "Comments",
      color: "#F0A0DB",
    },
    {
      value: zeroWhenConfirmedEmpty,
      label: "Saved",
      color: "#BA89B2",
    },
    {
      value: zeroWhenConfirmedEmpty,
      label: "Shares",
      color: "#AEB8F4",
    },
    {
      value: data.totalContent,
      label: "Posts",
      color: "#E9AA2C",
    },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-[23px] font-medium text-[#20242A]">
        Posts published in period
      </h1>

      <div className="overflow-hidden rounded-[14px] border border-[#E8EAED] bg-white shadow-[0_2px_12px_rgba(31,41,55,0.04)]">
        <PublishedPostsChart
          title="Organic Summary"
          cards={organicSummaryCards}
          start={start}
          end={end}
        />

        <div className="border-t border-[#E8EAED]">
          <PublishedPostsChart
            title="Organic Interactions"
            cards={organicInteractionCards}
            start={start}
            end={end}
          />
        </div>

        <div className="border-t border-[#E8EAED] px-5 pb-8 pt-7 sm:px-7">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <PostsMetricCard
              value={zeroWhenConfirmedEmpty}
              label="Daily likes"
            />
            <PostsMetricCard
              value={null}
              label="Likes per post"
            />
            <PostsMetricCard
              value={zeroWhenConfirmedEmpty}
              label="Daily comments"
            />
            <PostsMetricCard
              value={null}
              label="Comments per post"
            />
            <PostsMetricCard
              value={null}
              label="Likes per comment"
            />
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-2">
            <PostsChartPanel title="Types" />
            <PostsChartPanel title="Views" />
          </div>
        </div>

        <section className="border-t border-[#E8EAED] px-5 pb-0 pt-8 sm:px-7">
          <h2 className="mb-5 text-[20px] font-medium text-[#20242A]">
            List of posts
          </h2>

          <PostsToolbar
            search={postSearch}
            onSearchChange={setPostSearch}
            type="posts"
          />

          <EmptyPostsTable
            type="posts"
            search={postSearch}
          />
        </section>

        <section className="border-t border-[#E8EAED] px-5 pb-0 pt-8 sm:px-7">
          <h2 className="mb-5 text-[20px] font-medium text-[#20242A]">
            List of hashtags
          </h2>

          <PostsToolbar
            search={hashtagSearch}
            onSearchChange={setHashtagSearch}
            type="hashtags"
          />

          <EmptyPostsTable
            type="hashtags"
            search={hashtagSearch}
          />
        </section>
      </div>
    </div>
  );
}

function InstagramReelsSection({
  data,
  start,
  end,
}: {
  data: InstagramCommunityData;
  start: string;
  end: string;
}) {
  const [reelSearch, setReelSearch] = useState("");

  /*
   * A confirmed empty Instagram account supports a real zero.
   * Otherwise, unavailable Reels-only metrics remain unknown.
   */
  const confirmedEmpty = data.totalContent === 0;
  const zeroWhenConfirmedEmpty = confirmedEmpty
    ? 0
    : null;

  const organicSummaryCards = [
    {
      value: null,
      label: "Engagement",
      color: "#8994F0",
      help: true,
    },
    {
      value: zeroWhenConfirmedEmpty,
      label: "Interactions",
      color: "#96D0A7",
    },
    {
      value: null,
      label: "Avg. reach per reel",
      color: "#F0A0DB",
    },
    {
      value: zeroWhenConfirmedEmpty,
      label: "Views",
      color: "#BA89B2",
    },
    {
      value: zeroWhenConfirmedEmpty,
      label: "Reels",
      color: "#E9AA2C",
    },
  ];

  const organicInteractionCards = [
    {
      value: zeroWhenConfirmedEmpty,
      label: "Likes",
      color: "#96D0A7",
    },
    {
      value: zeroWhenConfirmedEmpty,
      label: "Comments",
      color: "#F0A0DB",
    },
    {
      value: zeroWhenConfirmedEmpty,
      label: "Saved",
      color: "#BA89B2",
    },
    {
      value: zeroWhenConfirmedEmpty,
      label: "Shares",
      color: "#AEB8F4",
    },
    {
      value: zeroWhenConfirmedEmpty,
      label: "Reels",
      color: "#E9AA2C",
    },
  ];

  const hasSearch = reelSearch.trim().length > 0;

  return (
    <div className="space-y-5">
      <h1 className="text-[23px] font-medium text-[#20242A]">
        Reels published in period
      </h1>

      <div className="overflow-hidden rounded-[14px] border border-[#E8EAED] bg-white shadow-[0_2px_12px_rgba(31,41,55,0.04)]">
        <PublishedPostsChart
          title="Organic Summary"
          cards={organicSummaryCards}
          start={start}
          end={end}
        />

        <div className="border-t border-[#E8EAED]">
          <PublishedPostsChart
            title="Organic Interactions"
            cards={organicInteractionCards}
            start={start}
            end={end}
          />
        </div>

        <section className="border-t border-[#E8EAED] px-5 pb-0 pt-8 sm:px-7">
          <h2 className="mb-5 text-[20px] font-medium text-[#20242A]">
            List of reels
          </h2>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">
                Search reels
              </span>

              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#5D6670]">
                <SearchIcon />
              </span>

              <input
                type="search"
                value={reelSearch}
                onChange={(event) =>
                  setReelSearch(event.target.value)
                }
                placeholder="Search"
                className="h-[42px] w-full rounded-[9px] border border-[#9EAFBC] bg-white pl-11 pr-4 text-sm text-[#30343A] outline-none transition placeholder:text-[#91A0AC] focus:border-[#6F7E89] focus:ring-2 focus:ring-[#E7EBEF]"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-label="Choose reels table columns"
                className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] border border-[#D7DBE0] bg-white px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F8F9FA]"
              >
                <PostsActionIcon kind="columns" />
                Columns
              </button>

              <button
                type="button"
                onClick={() =>
                  downloadEmptyInstagramCsv(
                    "instagram-reels.csv",
                    [
                      "reel",
                      "published_at",
                      "likes",
                      "comments",
                      "views",
                      "shares",
                    ],
                  )
                }
                className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-[#FAFDE8] px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F3F9D5]"
              >
                <PostsActionIcon kind="download" />
                Download CSV
                <PremiumDiamond />
              </button>

              <div className="relative">
                <span className="absolute -right-2 -top-4 rounded-full bg-[#DDF8ED] px-2.5 py-1 text-[10px] font-medium text-[#4E7B68]">
                  New
                </span>

                <Link
                  href="/dashboard/billing"
                  className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-[#FAFDE8] px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F3F9D5]"
                >
                  <PostsActionIcon kind="dashboard" />
                  Add to dashboard
                  <PremiumDiamond />
                </Link>
              </div>
            </div>
          </div>

          <div className="flex min-h-[500px] flex-col items-center justify-center px-5 py-14 text-center">
            <EmptySearchIllustration />

            <h3 className="mt-2 text-[23px] font-normal text-[#292D34]">
              Oops! Nothing found, try another search
            </h3>

            <p className="mt-4 max-w-[760px] text-[14px] leading-6 text-[#91A0AC]">
              {hasSearch
                ? `No reels match “${reelSearch.trim()}”. Try a different search.`
                : "You can use the filter tools to narrow down your search. Check if the current date range suits your needs."}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function InstagramStoriesEvolution({
  impressions,
  averageReach,
  stories,
  start,
  end,
}: {
  impressions: number | null;
  averageReach: number | null;
  stories: number | null;
  start: string;
  end: string;
}) {
  const emptyPoints = useMemo(
    () =>
      enumerateDates(start, end).map((date) => ({
        date,
        value: metricValue(0),
      })),
    [start, end],
  );

  return (
    <section className="px-5 py-7 sm:px-7">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <h3 className="pt-2 text-[18px] font-medium text-[#20242A]">
          Evolution
        </h3>

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 xl:max-w-[610px]">
          <PublishedMetricCard
            value={impressions}
            label="Impressions"
            color="#8994F0"
          />

          <PublishedMetricCard
            value={averageReach}
            label="Avg. reach per story"
            color="#96D0A7"
          />

          <PublishedMetricCard
            value={stories}
            label="Stories"
            color="#E9AA2C"
          />
        </div>
      </div>

      <div className="mt-2 min-h-[270px]">
        <SocialSummaryChart
          points={emptyPoints}
          seriesLabel="Stories Evolution"
          seriesColor="#8994F0"
          showMarkers
        />
      </div>
    </section>
  );
}

function InstagramStoriesSection({
  data,
  start,
  end,
}: {
  data: InstagramCommunityData;
  start: string;
  end: string;
}) {
  const [storySearch, setStorySearch] = useState("");

  /*
   * Stories-specific totals are not yet part of the data contract.
   * We only display zero when the synchronized account is confirmed empty.
   */
  const confirmedEmpty = data.totalContent === 0;
  const zeroWhenConfirmedEmpty = confirmedEmpty
    ? 0
    : null;
  const hasSearch = storySearch.trim().length > 0;

  return (
    <div className="space-y-5">
      <h1 className="text-[23px] font-medium text-[#20242A]">
        Stories published in period
      </h1>

      <div className="overflow-hidden rounded-[14px] border border-[#E8EAED] bg-white shadow-[0_2px_12px_rgba(31,41,55,0.04)]">
        <InstagramStoriesEvolution
          impressions={zeroWhenConfirmedEmpty}
          averageReach={null}
          stories={zeroWhenConfirmedEmpty}
          start={start}
          end={end}
        />

        <section className="border-t border-[#E8EAED] px-5 pb-0 pt-8 sm:px-7">
          <h2 className="mb-5 text-[20px] font-medium text-[#20242A]">
            List of stories
          </h2>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">
                Search stories
              </span>

              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#5D6670]">
                <SearchIcon />
              </span>

              <input
                type="search"
                value={storySearch}
                onChange={(event) =>
                  setStorySearch(event.target.value)
                }
                placeholder="Search"
                className="h-[42px] w-full rounded-[9px] border border-[#9EAFBC] bg-white pl-11 pr-4 text-sm text-[#30343A] outline-none transition placeholder:text-[#91A0AC] focus:border-[#6F7E89] focus:ring-2 focus:ring-[#E7EBEF]"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-label="Choose stories table columns"
                className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] border border-[#D7DBE0] bg-white px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F8F9FA]"
              >
                <PostsActionIcon kind="columns" />
                Columns
              </button>

              <button
                type="button"
                onClick={() =>
                  downloadEmptyInstagramCsv(
                    "instagram-stories.csv",
                    [
                      "story",
                      "published_at",
                      "impressions",
                      "reach",
                    ],
                  )
                }
                className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-[#FAFDE8] px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F3F9D5]"
              >
                <PostsActionIcon kind="download" />
                Download CSV
                <PremiumDiamond />
              </button>

              <div className="relative">
                <span className="absolute -right-2 -top-4 rounded-full bg-[#DDF8ED] px-2.5 py-1 text-[10px] font-medium text-[#4E7B68]">
                  New
                </span>

                <Link
                  href="/dashboard/billing"
                  className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-[#FAFDE8] px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F3F9D5]"
                >
                  <PostsActionIcon kind="dashboard" />
                  Add to dashboard
                  <PremiumDiamond />
                </Link>
              </div>
            </div>
          </div>

          <div className="flex min-h-[500px] flex-col items-center justify-center px-5 py-14 text-center">
            <EmptySearchIllustration />

            <h3 className="mt-2 text-[23px] font-normal text-[#292D34]">
              Oops! Nothing found, try another search
            </h3>

            <p className="mt-4 max-w-[760px] text-[14px] leading-6 text-[#91A0AC]">
              {hasSearch
                ? `No stories match “${storySearch.trim()}”. Try a different search.`
                : "You can use the filter tools to narrow down your search. Check if the current date range suits your needs."}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function InstagramCollabsEvolution({
  value,
  start,
  end,
}: {
  value: number | null;
  start: string;
  end: string;
}) {
  const emptyPoints = useMemo(
    () =>
      enumerateDates(start, end).map((date) => ({
        date,
        value: metricValue(0),
      })),
    [start, end],
  );

  const cards = [
    {
      label: "Collabs",
      color: "#E9AA2C",
    },
    {
      label: "Views",
      color: "#8994F0",
    },
    {
      label: "Likes",
      color: "#F0A0DB",
    },
    {
      label: "Comments",
      color: "#96D0A7",
    },
    {
      label: "Reposts",
      color: "#BA89B2",
    },
    {
      label: "Saved",
      color: "#AEB8F4",
    },
    {
      label: "Shares",
      color: "#55AD70",
    },
  ];

  return (
    <section className="px-5 py-7 sm:px-7">
      <h3 className="text-[18px] font-medium text-[#20242A]">
        Evolution
      </h3>

      <div className="mt-5 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        {cards.map((card) => (
          <PublishedMetricCard
            key={card.label}
            value={value}
            label={card.label}
            color={card.color}
          />
        ))}
      </div>

      <div className="mt-2 min-h-[270px]">
        <SocialSummaryChart
          points={emptyPoints}
          seriesLabel="Collabs Evolution"
          seriesColor="#8994F0"
          showMarkers
        />
      </div>
    </section>
  );
}

function InstagramCollabsSection({
  data,
  start,
  end,
}: {
  data: InstagramCommunityData;
  start: string;
  end: string;
}) {
  const [collabSearch, setCollabSearch] = useState("");

  /*
   * Collabs-specific values are unavailable until the
   * Instagram synchronization contract provides them.
   */
  const confirmedEmpty = data.totalContent === 0;
  const zeroWhenConfirmedEmpty = confirmedEmpty
    ? 0
    : null;
  const hasSearch = collabSearch.trim().length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-medium text-[#20242A]">
          Collabs published in period
        </h1>

        <span className="rounded-full bg-[#DDF8ED] px-3 py-1 text-[11px] font-medium text-[#4E7B68]">
          New
        </span>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[#E8EAED] bg-white shadow-[0_2px_12px_rgba(31,41,55,0.04)]">
        <InstagramCollabsEvolution
          value={zeroWhenConfirmedEmpty}
          start={start}
          end={end}
        />

        <section className="border-t border-[#E8EAED] px-5 pb-0 pt-8 sm:px-7">
          <h2 className="mb-5 text-[20px] font-medium text-[#20242A]">
            List of Collabs
          </h2>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">
                Search Collabs
              </span>

              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#5D6670]">
                <SearchIcon />
              </span>

              <input
                type="search"
                value={collabSearch}
                onChange={(event) =>
                  setCollabSearch(event.target.value)
                }
                placeholder="Search"
                className="h-[42px] w-full rounded-[9px] border border-[#9EAFBC] bg-white pl-11 pr-4 text-sm text-[#30343A] outline-none transition placeholder:text-[#91A0AC] focus:border-[#6F7E89] focus:ring-2 focus:ring-[#E7EBEF]"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-label="Choose Collabs table columns"
                className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] border border-[#D7DBE0] bg-white px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F8F9FA]"
              >
                <PostsActionIcon kind="columns" />
                Columns
              </button>

              <button
                type="button"
                onClick={() =>
                  downloadEmptyInstagramCsv(
                    "instagram-collabs.csv",
                    [
                      "collab",
                      "published_at",
                      "views",
                      "likes",
                      "comments",
                      "reposts",
                      "saved",
                      "shares",
                    ],
                  )
                }
                className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-[#FAFDE8] px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F3F9D5]"
              >
                <PostsActionIcon kind="download" />
                Download CSV
                <PremiumDiamond />
              </button>
            </div>
          </div>

          <div className="flex min-h-[500px] flex-col items-center justify-center px-5 py-14 text-center">
            <EmptySearchIllustration />

            <h3 className="mt-2 text-[23px] font-normal text-[#292D34]">
              Oops! Nothing found, try another search
            </h3>

            <p className="mt-4 max-w-[760px] text-[14px] leading-6 text-[#91A0AC]">
              {hasSearch
                ? `No Collabs match “${collabSearch.trim()}”. Try a different search.`
                : "You can use the filter tools to narrow down your search. Check if the current date range suits your needs."}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}


function CompetitorsDiamondIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-8 w-8"
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
  );
}

function CompetitorsHelpIcon() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#777D84] text-[11px] font-medium text-[#777D84]"
    >
      ?
    </span>
  );
}

function CompetitorsPostListIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    >
      <path d="M5 20V10" />
      <path d="M10 20V4" />
      <path d="M15 20v-7" />
      <path d="M20 20V7" />
    </svg>
  );
}

function InstagramCompetitorsSection() {
  const [competitorSearch, setCompetitorSearch] = useState("");

  const hasSearch =
    competitorSearch.trim().length > 0;

  return (
    <div className="space-y-1">
      <h2 className="pb-5 text-[23px] font-medium text-[#20242A]">
        Competitors
      </h2>

      <section className="rounded-[14px] border border-[#E8EAED] bg-white px-6 py-6 shadow-[0_2px_12px_rgba(31,41,55,0.04)] sm:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-[#E5FF3F] text-[#59656D]">
              <CompetitorsDiamondIcon />
            </div>

            <div className="min-w-0">
              <h3 className="text-[22px] font-semibold text-[#20242A]">
                Do you need a higher plan?
              </h3>

              <p className="mt-1 text-[15px] leading-6 text-[#68717A]">
                Upgrade your plan and add up to{" "}
                <strong className="font-semibold text-[#46505A]">
                  100 competitors
                </strong>{" "}
                which you can modify and/or delete at any time
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/billing"
            className="inline-flex h-[38px] shrink-0 items-center justify-center self-start rounded-[9px] bg-[#2B1725] px-5 text-sm font-semibold text-[#DFFF38] transition hover:bg-[#3A2133] lg:self-auto"
          >
            Upgrade your plan
          </Link>
        </div>
      </section>

      <section className="min-h-[610px] rounded-[14px] border border-[#E8EAED] bg-white px-6 py-7 shadow-[0_2px_12px_rgba(31,41,55,0.04)] sm:px-7">
        <div className="flex items-center gap-2">
          <h3 className="text-[20px] font-medium text-[#20242A]">
            List of competitors
          </h3>

          <CompetitorsHelpIcon />
        </div>

        <div className="mt-9 flex flex-col gap-3 2xl:flex-row 2xl:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">
              Search competitors
            </span>

            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#5D6670]">
              <SearchIcon />
            </span>

            <input
              type="search"
              value={competitorSearch}
              onChange={(event) =>
                setCompetitorSearch(event.target.value)
              }
              placeholder="Search"
              className="h-[42px] w-full rounded-[9px] border border-[#9EAFBC] bg-white pl-11 pr-4 text-sm text-[#30343A] outline-none transition placeholder:text-[#91A0AC] focus:border-[#6F7E89] focus:ring-2 focus:ring-[#E7EBEF]"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled
              aria-label="Filter competitors"
              className="inline-flex h-[42px] min-w-[158px] cursor-not-allowed items-center justify-between gap-4 rounded-[9px] border border-[#E4E7EA] bg-white px-3 text-xs font-medium text-[#C1C6CA]"
            >
              All competitors

              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="m5 7 5 5 5-5" />
              </svg>
            </button>

            <button
              type="button"
              aria-label="Choose competitors table columns"
              className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] border border-[#D7DBE0] bg-white px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F8F9FA]"
            >
              <PostsActionIcon kind="columns" />
              Columns
            </button>

            <button
              type="button"
              onClick={() =>
                downloadEmptyInstagramCsv(
                  "instagram-competitors.csv",
                  [
                    "competitor",
                    "followers",
                    "posts",
                    "interactions",
                    "engagement",
                  ],
                )
              }
              className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-[#FAFDE8] px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F3F9D5]"
            >
              <PostsActionIcon kind="download" />
              Download CSV
              <PremiumDiamond />
            </button>

            <button
              type="button"
              aria-label="Show all competitor posts"
              className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] border border-[#D7DBE0] bg-white px-3 text-xs font-medium text-[#30343A] transition hover:bg-[#F8F9FA]"
            >
              <CompetitorsPostListIcon />
              Post List (All)
            </button>

            <Link
              href="/dashboard/billing"
              className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-[#2B1725] px-4 text-sm font-semibold text-[#DFFF38] transition hover:bg-[#3A2133]"
            >
              <span
                aria-hidden="true"
                className="text-[25px] font-light leading-none"
              >
                +
              </span>
              Add
            </Link>
          </div>
        </div>

        <div className="flex min-h-[440px] flex-col items-center justify-center px-5 py-14 text-center">
          <EmptySearchIllustration />

          <h3 className="mt-2 text-[23px] font-normal text-[#292D34]">
            Oops! Nothing found, try another search
          </h3>

          <p className="mt-4 max-w-[760px] text-[14px] leading-6 text-[#91A0AC]">
            {hasSearch
              ? `No competitors match “${competitorSearch.trim()}”. Try a different search.`
              : "You can use the filter tools to narrow down your search. Check if the current date range suits your needs."}
          </p>
        </div>
      </section>
    </div>
  );
}

export function InstagramSubscribedDashboard({
  data = EMPTY_DATA,
  accountName,
  profileImageUrl = null,
  isConnected,
}: {
  data?: InstagramCommunityData;
  accountName: string;
  profileImageUrl?: string | null;
  isConnected: boolean;
}) {
  const [tab, setTab] = useState<InstagramTab>("community");
  const [range, setRange] = useState<number>(30);
  const [compareEnabled, setCompareEnabled] = useState(false);

  function scrollToSection(section: InstagramTab) {
    setTab(section);

    document
      .getElementById(`instagram-${section}`)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  useEffect(() => {
    const sections = TABS.map((item) =>
      document.getElementById(`instagram-${item.key}`),
    ).filter(
      (section): section is HTMLElement =>
        section !== null,
    );

    if (!sections.length) {
      return;
    }

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

        if (!visibleId) {
          return;
        }

        setTab(
          visibleId.replace(
            "instagram-",
            "",
          ) as InstagramTab,
        );
      },
      {
        rootMargin: "-190px 0px -55% 0px",
        threshold: [0, 0.1, 0.25, 0.5],
      },
    );

    sections.forEach((section) => {
      observer.observe(section);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const { start, end } = useMemo(() => {
    const endDate = new Date();
    endDate.setUTCHours(12, 0, 0, 0);

    const startDate = new Date(endDate);
    startDate.setUTCDate(endDate.getUTCDate() - range + 1);

    return {
      start: dateKey(startDate),
      end: dateKey(endDate),
    };
  }, [range]);

  const hasConfirmedData =
    [
      data.followers,
      data.following,
      data.totalContent,
      data.dailyFollowers,
      data.followersPerPost,
      data.dailyPosts,
      data.postsPerWeek,
      data.acquired,
      data.lost,
    ].some((value) => value !== null) ||
    Boolean(data.followersSeries?.length) ||
    Boolean(data.acquiredSeries?.length) ||
    Boolean(data.lostSeries?.length);

  const accountStatus = !isConnected
    ? "History saved"
    : hasConfirmedData
      ? "Data available"
      : "No data";

  return (
    <div className="-mx-1 space-y-5 bg-[#FCFCFD] px-4 pb-24 pt-1 sm:px-5 lg:px-6">
      <section className="rounded-[14px] border border-[#E8EAED] bg-white px-5 py-4 shadow-[0_2px_12px_rgba(31,41,55,0.045)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
                Instagram account
              </p>

              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  !isConnected
                    ? "bg-slate-100 text-slate-800"
                    : hasConfirmedData
                      ? "bg-emerald-100 text-emerald-900"
                      : "bg-amber-100 text-amber-900"
                }`}
              >
                {accountStatus}
              </span>
            </div>

            <h1
              className="mt-1 truncate text-[22px] font-semibold text-[#20242A]"
              title={accountName}
            >
              {accountName}
            </h1>

            <p className="mt-1 text-sm text-[#5F6770]">
              Selected {start} → {end}
              {hasConfirmedData
                ? " · Confirmed account-specific Instagram data"
                : " · Waiting for synchronized Instagram data"}
            </p>

            {!hasConfirmedData ? (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                No synchronized Instagram data overlaps this range.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="sticky top-[66px] z-20 flex flex-col gap-3 border-b border-[#E1E4E7] bg-[#FCFCFD]/95 pb-3 pt-3 backdrop-blur-sm lg:flex-row lg:items-end lg:justify-between">
        <nav
          aria-label="Instagram analytics sections"
          className="hidden min-w-0 flex-1 gap-1 overflow-x-auto lg:flex"
        >
          {TABS.map((item) => {
            const selected = tab === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => scrollToSection(item.key)}
                className={`relative min-w-fit px-3 py-3 text-[12px] font-semibold tracking-wide transition ${
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

        <div className="ml-auto flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#6B7280]">
            <span>Main period</span>
            <span className="flex h-11 items-center gap-2 rounded-[10px] border border-[#D7DBE0] bg-white px-3 text-sm shadow-sm">
              <span className="font-medium text-[#20242A]">
                {displayDate(start)} - {displayDate(end)}
              </span>
              <CalendarDays className="h-4 w-4 text-[#9AA1A9]" />
              <select
                value={range}
                onChange={(event) => setRange(Number(event.target.value))}
                aria-label="Select Instagram date range"
                className="max-w-[130px] bg-transparent text-[#505761] outline-none"
              >
                {RANGES.map((days) => (
                  <option key={days} value={days}>
                    {days === 365
                      ? "Last 12 months"
                      : `Last ${days} days`}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#6B7280]">
            <span>Comparison period</span>
            <button
              type="button"
              onClick={() => setCompareEnabled((current) => !current)}
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
        <label className="sr-only" htmlFor="instagram-mobile-tab">
          Instagram section
        </label>
        <select
          id="instagram-mobile-tab"
          value={tab}
          onChange={(event) =>
            scrollToSection(
              event.target.value as InstagramTab,
            )
          }
          className="h-11 w-full rounded-[10px] border border-[#D7DBE0] bg-white px-3 text-sm font-semibold text-[#20242A]"
        >
          {TABS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <section
        id="instagram-community"
        aria-labelledby="instagram-community-heading"
        className="scroll-mt-[190px] space-y-5"
      >
        <h2
          id="instagram-community-heading"
          className="sr-only"
        >
          Instagram Community analytics
        </h2>

        <div className="rounded-[10px] border border-[#A8B4FF] bg-[#F0F1FF] px-4 py-3 text-[13px] leading-5 text-[#46516A]">
          Followers and Stories metrics are available from the day the
          Instagram account is connected. TAKATAK preserves confirmed
          historical data for this account.
        </div>

        <CommunitySection
          data={data}
          start={start}
          end={end}
          accountName={accountName}
          profileImageUrl={profileImageUrl}
        />
      </section>

      <section
        id="instagram-account"
        aria-labelledby="instagram-account-heading"
        className="scroll-mt-[190px]"
      >
        <h2
          id="instagram-account-heading"
          className="sr-only"
        >
          Instagram Account analytics
        </h2>

        <AccountSection data={data} />
      </section>

      <section
        id="instagram-posts"
        aria-labelledby="instagram-posts-heading"
        className="scroll-mt-[190px]"
      >
        <h2
          id="instagram-posts-heading"
          className="sr-only"
        >
          Instagram Posts analytics
        </h2>

        <InstagramPostsSection
          data={data}
          start={start}
          end={end}
        />
      </section>

      <section
        id="instagram-reels"
        aria-labelledby="instagram-reels-heading"
        className="scroll-mt-[190px]"
      >
        <h2
          id="instagram-reels-heading"
          className="sr-only"
        >
          Instagram Reels analytics
        </h2>

        <InstagramReelsSection
          data={data}
          start={start}
          end={end}
        />
      </section>

      <section
        id="instagram-stories"
        aria-labelledby="instagram-stories-heading"
        className="scroll-mt-[190px]"
      >
        <h2
          id="instagram-stories-heading"
          className="sr-only"
        >
          Instagram Stories analytics
        </h2>

        <InstagramStoriesSection
          data={data}
          start={start}
          end={end}
        />
      </section>

      <section
        id="instagram-collabs"
        aria-labelledby="instagram-collabs-heading"
        className="scroll-mt-[190px]"
      >
        <h2
          id="instagram-collabs-heading"
          className="sr-only"
        >
          Instagram Collabs analytics
        </h2>

        <InstagramCollabsSection
          data={data}
          start={start}
          end={end}
        />
      </section>

      <section
        id="instagram-competitors"
        aria-labelledby="instagram-competitors-heading"
        className="scroll-mt-[190px]"
      >
        <h2
          id="instagram-competitors-heading"
          className="sr-only"
        >
          Instagram Competitors analytics
        </h2>

        <InstagramCompetitorsSection />
      </section>

    </div>
  );
}
