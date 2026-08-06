"use client";

import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Columns3,
  Download,
  Megaphone,
  MousePointerClick,
  Search,
  Share2,
  TrendingUp,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useState,
  type MouseEvent,
} from "react";

export type SocialPlatformKey =
  | "facebook"
  | "instagram"
  | "threads"
  | "tiktok"
  | "google_business"
  | "linkedin"
  | "x"
  | "youtube"
  | "pinterest"
  | "bluesky"
  | "twitch";

export type SocialAdPlatformKey =
  | "meta_ads"
  | "google_ads";

export type SocialSummaryData = {
  activeBrandId: string | null;
  activeBrandName: string | null;
  hasConnectedAccounts: boolean;
  dataUnavailable: boolean;

  accounts: Array<{
    id: string;
    platform: SocialPlatformKey;
    displayName: string | null;
    handle: string | null;
  }>;

  accountDaily: Array<{
    date: string;
    platform: SocialPlatformKey;
    followers: number;
    impressions: number;
    reach: number;
    engagement: number;
    clicks: number;
  }>;

  posts: Array<{
    id: string;
    platform: SocialPlatformKey;
    caption: string;
    status: string;
    scheduledAt: string | null;
    publishedAt: string | null;
    createdAt: string;
  }>;

  adAccounts: Array<{
    id: string;
    platform: SocialAdPlatformKey;
    displayName: string | null;
    externalAccountId: string;
    currency: string;
  }>;

  adDaily: Array<{
    date: string;
    platform: SocialAdPlatformKey;
    impressions: number;
    clicks: number;
    spendMinor: number;
    currency: string;
  }>;
};

type Tab =
  | "account"
  | "posts"
  | "ads";

type Series = {
  key: string;
  label: string;
  color: string;
  mark: string;
  values: number[];
};

type PlatformConfig = {
  label: string;
  color: string;
  mark: string;
};

const SOCIAL: Record<
  SocialPlatformKey,
  PlatformConfig
> = {
  facebook: {
    label: "Facebook",
    color: "#1877F2",
    mark: "f",
  },
  instagram: {
    label: "Instagram",
    color: "#E1306C",
    mark: "IG",
  },
  threads: {
    label: "Threads",
    color: "#111827",
    mark: "@",
  },
  tiktok: {
    label: "TikTok",
    color: "#111827",
    mark: "TT",
  },
  google_business: {
    label:
      "Google Business Profile",
    color: "#4285F4",
    mark: "G",
  },
  linkedin: {
    label: "LinkedIn",
    color: "#0A66C2",
    mark: "in",
  },
  x: {
    label: "X",
    color: "#111827",
    mark: "X",
  },
  youtube: {
    label: "YouTube",
    color: "#FF0000",
    mark: "▶",
  },
  pinterest: {
    label: "Pinterest",
    color: "#E60023",
    mark: "P",
  },
  bluesky: {
    label: "Bluesky",
    color: "#0285FF",
    mark: "BS",
  },
  twitch: {
    label: "Twitch",
    color: "#9146FF",
    mark: "TW",
  },
};

const ADS: Record<
  SocialAdPlatformKey,
  PlatformConfig
> = {
  meta_ads: {
    label: "Meta Ads",
    color: "#0866FF",
    mark: "M",
  },
  google_ads: {
    label: "Google Ads",
    color: "#34A853",
    mark: "G",
  },
};

const PREVIEW_SOCIAL: SocialPlatformKey[] =
  [
    "facebook",
    "instagram",
    "bluesky",
    "google_business",
    "pinterest",
    "tiktok",
    "youtube",
    "twitch",
  ];

const PREVIEW_ADS: SocialAdPlatformKey[] =
  [
    "meta_ads",
    "google_ads",
  ];

const RANGES = [
  30,
  90,
  180,
  365,
] as const;

function dateKey(
  date: Date,
) {
  return date
    .toISOString()
    .slice(0, 10);
}

function makeDates(
  days: number,
) {
  const today = new Date();

  today.setUTCHours(
    12,
    0,
    0,
    0,
  );

  return Array.from(
    {
      length: days,
    },
    (_, index) => {
      const value =
        new Date(today);

      value.setUTCDate(
        today.getUTCDate() -
          (days - index - 1),
      );

      return dateKey(value);
    },
  );
}

function displayDate(
  value: string,
  long = false,
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      year: long
        ? "numeric"
        : undefined,

      month: long
        ? "long"
        : "short",

      day: "numeric",
    },
  ).format(
    new Date(
      `${value}T12:00:00.000Z`,
    ),
  );
}

function number(
  value: number,
) {
  return new Intl.NumberFormat(
    "en-CA",
    {
      maximumFractionDigits: 1,
    },
  ).format(value);
}

function money(
  value: number,
  currency: string,
) {
  try {
    return new Intl.NumberFormat(
      "en-CA",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      },
    ).format(value);
  } catch {
    return `${value.toFixed(
      2,
    )} ${currency}`;
  }
}

function downloadCsv(
  filename: string,
  rows: string[][],
) {
  const content = rows
    .map((row) =>
      row
        .map(
          (cell) =>
            `"${cell.replaceAll(
              '"',
              '""',
            )}"`,
        )
        .join(","),
    )
    .join("\n");

  const url =
    URL.createObjectURL(
      new Blob([content], {
        type: "text/csv;charset=utf-8",
      }),
    );

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(
    () =>
      URL.revokeObjectURL(url),
    0,
  );
}

function PlatformMark({
  config,
}: {
  config: PlatformConfig;
}) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white text-[11px] font-black"
      style={{
        color: config.color,
        borderColor: `${config.color}35`,
      }}
      aria-hidden="true"
    >
      {config.mark}
    </span>
  );
}

function LineChart({
  dates,
  series,
  formatter = number,
}: {
  dates: string[];
  series: Series[];
  formatter?: (
    value: number,
  ) => string;
}) {
  const [
    hovered,
    setHovered,
  ] = useState<
    number | null
  >(null);

  const width = 1000;
  const height = 300;
  const left = 58;
  const right = 20;
  const top = 22;
  const bottom = 42;

  const plotWidth =
    width - left - right;

  const plotHeight =
    height - top - bottom;

  const maximum = Math.max(
    1,
    ...series.flatMap(
      (item) =>
        item.values,
    ),
  );

  function x(
    index: number,
  ) {
    if (dates.length <= 1) {
      return (
        left +
        plotWidth / 2
      );
    }

    return (
      left +
      (index /
        (dates.length - 1)) *
        plotWidth
    );
  }

  function y(
    value: number,
  ) {
    return (
      top +
      plotHeight -
      (value / maximum) *
        plotHeight
    );
  }

  function path(
    values: number[],
  ) {
    return values
      .map(
        (
          value,
          index,
        ) =>
          `${
            index === 0
              ? "M"
              : "L"
          }${x(index)},${y(
            value,
          )}`,
      )
      .join(" ");
  }

  function move(
    event: MouseEvent<SVGSVGElement>,
  ) {
    const bounds =
      event.currentTarget.getBoundingClientRect();

    const ratio = Math.min(
      1,
      Math.max(
        0,
        (event.clientX -
          bounds.left) /
          bounds.width,
      ),
    );

    setHovered(
      Math.round(
        ratio *
          Math.max(
            0,
            dates.length - 1,
          ),
      ),
    );
  }

  if (
    dates.length === 0 ||
    series.length === 0
  ) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
        No verified data is
        available for this
        period.
      </div>
    );
  }

  const labels =
    Array.from(
      new Set(
        [
          0,
          1,
          2,
          3,
          4,
        ].map((step) =>
          Math.round(
            ((dates.length -
              1) *
              step) /
              4,
          ),
        ),
      ),
    );

  const hoverLeft =
    hovered === null ||
    dates.length <= 1
      ? 50
      : (hovered /
          (dates.length -
            1)) *
        100;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[300px] w-full touch-none"
        onMouseMove={move}
        onMouseLeave={() =>
          setHovered(null)
        }
        role="img"
        aria-label="Interactive social analytics line chart"
      >
        {[
          0,
          1,
          2,
          3,
          4,
        ].map((row) => {
          const gridY =
            top +
            (plotHeight *
              row) /
              4;

          return (
            <g key={row}>
              <line
                x1={left}
                x2={
                  width -
                  right
                }
                y1={gridY}
                y2={gridY}
                stroke="#e2e8f0"
                strokeDasharray="4 5"
              />

              <text
                x={left - 12}
                y={gridY + 4}
                textAnchor="end"
                className="fill-slate-400 text-[11px]"
              >
                {formatter(
                  maximum *
                    (1 -
                      row /
                        4),
                )}
              </text>
            </g>
          );
        })}

        {labels.map(
          (index) => (
            <text
              key={
                dates[index]
              }
              x={x(index)}
              y={
                height -
                14
              }
              textAnchor="middle"
              className="fill-slate-400 text-[11px]"
            >
              {displayDate(
                dates[
                  index
                ],
              )}
            </text>
          ),
        )}

        {hovered !==
        null ? (
          <line
            x1={x(hovered)}
            x2={x(hovered)}
            y1={top}
            y2={
              top +
              plotHeight
            }
            stroke="#64748b"
            strokeDasharray="4 4"
          />
        ) : null}

        {series.map(
          (item) => (
            <g key={item.key}>
              <path
                d={path(
                  item.values,
                )}
                fill="none"
                stroke={
                  item.color
                }
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {item.values.map(
                (
                  value,
                  index,
                ) => (
                  <circle
                    key={`${item.key}-${dates[index]}`}
                    cx={x(
                      index,
                    )}
                    cy={y(
                      value,
                    )}
                    r={
                      hovered ===
                      index
                        ? 5
                        : 2.8
                    }
                    fill="white"
                    stroke={
                      item.color
                    }
                    strokeWidth="2"
                  />
                ),
              )}
            </g>
          ),
        )}
      </svg>

      {hovered !== null ? (
        <div
          className={`pointer-events-none absolute top-3 z-10 min-w-[190px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl ${
            hoverLeft > 72
              ? "-translate-x-full"
              : hoverLeft < 28
                ? "translate-x-0"
                : "-translate-x-1/2"
          }`}
          style={{
            left: `${hoverLeft}%`,
          }}
        >
          <p className="text-xs font-semibold text-slate-900">
            {displayDate(
              dates[hovered],
              true,
            )}
          </p>

          <div className="mt-2 space-y-1.5">
            {series.map(
              (item) => (
                <div
                  key={
                    item.key
                  }
                  className="flex items-center justify-between gap-4 text-xs"
                >
                  <span className="flex min-w-0 items-center gap-2 text-slate-600">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          item.color,
                      }}
                    />

                    <span className="truncate">
                      {
                        item.label
                      }
                    </span>
                  </span>

                  <span className="font-semibold text-slate-950">
                    {formatter(
                      item.values[
                        hovered
                      ] ?? 0,
                    )}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricPanel({
  title,
  description,
  total,
  cards,
  dates,
  series,
  formatter,
}: {
  title: string;
  description: string;
  total: string;

  cards: Array<{
    key: string;
    config: PlatformConfig;
    value: string;
  }>;

  dates: string[];
  series: Series[];

  formatter?: (
    value: number,
  ) => string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold text-slate-950">
        {title}
      </h2>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {description}
      </p>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        <article className="min-w-[170px] rounded-xl bg-[#2a1728] px-4 py-4 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
            Total
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {total}
          </p>
        </article>

        {cards.map(
          (card) => (
            <article
              key={
                card.key
              }
              className="group relative min-w-[160px] rounded-xl border border-slate-200 px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-md"
              style={{
                backgroundColor: `${card.config.color}08`,
              }}
            >
              <div className="flex items-center gap-2.5">
                <PlatformMark
                  config={
                    card.config
                  }
                />

                <span className="truncate text-xs font-medium text-slate-600">
                  {
                    card
                      .config
                      .label
                  }
                </span>
              </div>

              <p className="mt-3 text-xl font-semibold text-slate-950">
                {
                  card.value
                }
              </p>

              <div className="pointer-events-none absolute inset-x-2 bottom-2 hidden rounded-lg bg-slate-950 px-2.5 py-1.5 text-center text-[11px] font-medium text-white shadow-lg group-hover:block">
                {
                  card.config
                    .label
                }
                :{" "}
                {
                  card.value
                }
              </div>
            </article>
          ),
        )}
      </div>

      <div className="mt-4">
        <LineChart
          dates={dates}
          series={series}
          formatter={
            formatter
          }
        />
      </div>
    </section>
  );
}

function EducationCard({
  title,
  description,
  hover,
  icon: Icon,
}: {
  title: string;
  description: string;
  hover: string;
  icon: LucideIcon;
}) {
  return (
    <article className="group relative min-h-[260px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0efff] text-[#5c4cff]">
          <Icon className="h-5 w-5" />
        </span>

        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Learn
        </span>
      </div>

      <h2 className="mt-5 text-lg font-semibold text-slate-950">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>

      <div className="mt-6 flex h-20 items-end gap-2 rounded-xl bg-slate-50 px-4 py-3">
        {[
          32,
          50,
          38,
          68,
          58,
          78,
        ].map(
          (
            height,
            index,
          ) => (
            <span
              key={`${title}-${index}`}
              className="flex-1 rounded-t-md bg-[#d9d5ff] transition group-hover:bg-[#5c4cff]"
              style={{
                height: `${height}%`,
              }}
            />
          ),
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 translate-y-full border-t border-[#d8d2ff] bg-[#2a1728] px-5 py-4 text-sm leading-6 text-white transition duration-200 group-hover:translate-y-0">
        {hover}
      </div>
    </article>
  );
}

function NewUserView() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#d8d2ff] bg-[#f7f6ff] px-5 py-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5c4cff]">
            Start with real
            data
          </p>

          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            Connect your
            social networks
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Authorize a
            provider account
            to collect
            verified audience,
            publishing, reach,
            and advertising
            data.
          </p>
        </div>

        <Link
          href="/dashboard/social?connections=open"
          className="mt-4 inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#5c4cff] px-5 text-sm font-semibold text-white hover:bg-[#4c3ee0] sm:mt-0"
        >
          Connect social
          networks
        </Link>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <EducationCard
          title="Community growth"
          description="Follow how your audience develops across connected networks."
          hover="Hover chart points to inspect the exact date, network, and follower total."
          icon={UsersRound}
        />

        <EducationCard
          title="Post reach"
          description="Understand where your content travels and engagement happens."
          hover="Compare impressions and interactions by platform without unverifiable values."
          icon={TrendingUp}
        />

        <EducationCard
          title="Ad campaigns"
          description="Compare Meta Ads and Google Ads from one reporting view."
          hover="CPM and CPC are calculated only from verified impressions, clicks, and spend."
          icon={Megaphone}
        />
      </div>

      <section className="rounded-2xl bg-[#2a1728] px-5 py-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-7">
        <div>
          <h2 className="text-xl font-semibold">
            Build your first
            analytics view
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
            TAKATAK never
            inserts sample
            performance
            numbers into a
            real account.
          </p>
        </div>

        <Link
          href="/dashboard/social?connections=open"
          className="mt-4 inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#dfff32] px-5 text-sm font-semibold text-[#2a1728] hover:brightness-95 sm:mt-0"
        >
          Add your first
          connection
        </Link>
      </section>
    </div>
  );
}

function ColumnMenu<
  T extends Record<
    string,
    boolean
  >,
>({
  columns,
  setColumns,
}: {
  columns: T;

  setColumns: (
    next:
      | T
      | ((
          current: T,
        ) => T),
  ) => void;
}) {
  return (
    <details className="relative">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <Columns3 className="h-4 w-4" />
        Columns
        <ChevronDown className="h-3.5 w-3.5" />
      </summary>

      <div className="absolute right-0 top-12 z-20 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
        {Object.entries(
          columns,
        ).map(
          ([
            key,
            enabled,
          ]) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={
                  enabled
                }
                onChange={() =>
                  setColumns(
                    (
                      current,
                    ) => ({
                      ...current,
                      [key]:
                        !current[
                          key
                        ],
                    }),
                  )
                }
              />

              {key ===
              "externalId"
                ? "External ID"
                : key[0].toUpperCase() +
                  key.slice(
                    1,
                  )}
            </label>
          ),
        )}
      </div>
    </details>
  );
}

function EmptyTable({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="mt-5 flex min-h-[210px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center">
      <Icon className="h-8 w-8 text-slate-300" />

      <p className="mt-3 text-sm font-semibold text-slate-700">
        {title}
      </p>

      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
        {text}
      </p>
    </div>
  );
}

function PostsTable({
  posts,
}: {
  posts: SocialSummaryData["posts"];
}) {
  const [
    search,
    setSearch,
  ] = useState("");

  const [
    columns,
    setColumns,
  ] = useState({
    date: true,
    network: true,
    content: true,
    status: true,
  });

  const query = search
    .trim()
    .toLowerCase();

  const rows =
    posts.filter(
      (post) =>
        !query ||
        post.caption
          .toLowerCase()
          .includes(
            query,
          ) ||
        SOCIAL[
          post.platform
        ].label
          .toLowerCase()
          .includes(
            query,
          ) ||
        post.status
          .toLowerCase()
          .includes(
            query,
          ),
    );

  function exportPosts() {
    downloadCsv(
      "takatak-social-posts.csv",
      [
        [
          "Date",
          "Network",
          "Content",
          "Status",
        ],

        ...rows.map(
          (post) => [
            (
              post.publishedAt ??
              post.scheduledAt ??
              post.createdAt
            ).slice(
              0,
              10,
            ),

            SOCIAL[
              post.platform
            ].label,

            post.caption,
            post.status,
          ],
        ),
      ],
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            List of posts
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Published and
            scheduled records
            for the selected
            period.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-[210px] flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(
                event,
              ) =>
                setSearch(
                  event.target
                    .value,
                )
              }
              placeholder="Search posts"
              className="h-10 w-full rounded-xl border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-[#5c4cff]"
            />
          </label>

          <ColumnMenu
            columns={
              columns
            }
            setColumns={
              setColumns
            }
          />

          <button
            type="button"
            onClick={
              exportPosts
            }
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyTable
          icon={Share2}
          title="No posts found"
          text="No real published or scheduled post records match this period and search."
        />
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-400">
                {columns.date ? (
                  <th className="px-3 py-3 font-semibold">
                    Date
                  </th>
                ) : null}

                {columns.network ? (
                  <th className="px-3 py-3 font-semibold">
                    Network
                  </th>
                ) : null}

                {columns.content ? (
                  <th className="px-3 py-3 font-semibold">
                    Content
                  </th>
                ) : null}

                {columns.status ? (
                  <th className="px-3 py-3 font-semibold">
                    Status
                  </th>
                ) : null}
              </tr>
            </thead>

            <tbody>
              {rows.map(
                (post) => {
                  const source =
                    post.publishedAt ??
                    post.scheduledAt ??
                    post.createdAt;

                  return (
                    <tr
                      key={
                        post.id
                      }
                      className="border-b border-slate-100 text-slate-700 last:border-0"
                    >
                      {columns.date ? (
                        <td className="whitespace-nowrap px-3 py-3">
                          {displayDate(
                            source.slice(
                              0,
                              10,
                            ),
                          )}
                        </td>
                      ) : null}

                      {columns.network ? (
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <PlatformMark
                              config={
                                SOCIAL[
                                  post
                                    .platform
                                ]
                              }
                            />

                            {
                              SOCIAL[
                                post
                                  .platform
                              ]
                                .label
                            }
                          </div>
                        </td>
                      ) : null}

                      {columns.content ? (
                        <td className="max-w-[360px] px-3 py-3">
                          <p className="line-clamp-2">
                            {
                              post.caption
                            }
                          </p>
                        </td>
                      ) : null}

                      {columns.status ? (
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">
                            {post.status.replaceAll(
                              "_",
                              " ",
                            )}
                          </span>
                        </td>
                      ) : null}
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AdTable({
  accounts,
}: {
  accounts: SocialSummaryData["adAccounts"];
}) {
  const [
    search,
    setSearch,
  ] = useState("");

  const [
    columns,
    setColumns,
  ] = useState({
    platform: true,
    account: true,
    externalId: true,
    currency: true,
  });

  const query = search
    .trim()
    .toLowerCase();

  const rows =
    accounts.filter(
      (account) =>
        !query ||
        (
          account.displayName ??
          ""
        )
          .toLowerCase()
          .includes(
            query,
          ) ||
        account.externalAccountId
          .toLowerCase()
          .includes(
            query,
          ) ||
        ADS[
          account.platform
        ].label
          .toLowerCase()
          .includes(
            query,
          ),
    );

  function exportAccounts() {
    downloadCsv(
      "takatak-ad-accounts.csv",
      [
        [
          "Platform",
          "Account",
          "External account ID",
          "Currency",
        ],

        ...rows.map(
          (account) => [
            ADS[
              account.platform
            ].label,

            account.displayName ??
              "",

            account.externalAccountId,
            account.currency,
          ],
        ),
      ],
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Ad accounts
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Native
            advertising
            accounts connected
            to the active
            brand.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-[210px] flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(
                event,
              ) =>
                setSearch(
                  event.target
                    .value,
                )
              }
              placeholder="Search ad accounts"
              className="h-10 w-full rounded-xl border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-[#5c4cff]"
            />
          </label>

          <ColumnMenu
            columns={
              columns
            }
            setColumns={
              setColumns
            }
          />

          <button
            type="button"
            onClick={
              exportAccounts
            }
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyTable
          icon={Megaphone}
          title="No advertising accounts found"
          text="Connect a real Meta Ads or Google Ads account before advertising metrics can appear."
        />
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-400">
                {columns.platform ? (
                  <th className="px-3 py-3 font-semibold">
                    Platform
                  </th>
                ) : null}

                {columns.account ? (
                  <th className="px-3 py-3 font-semibold">
                    Account
                  </th>
                ) : null}

                {columns.externalId ? (
                  <th className="px-3 py-3 font-semibold">
                    External ID
                  </th>
                ) : null}

                {columns.currency ? (
                  <th className="px-3 py-3 font-semibold">
                    Currency
                  </th>
                ) : null}
              </tr>
            </thead>

            <tbody>
              {rows.map(
                (account) => (
                  <tr
                    key={
                      account.id
                    }
                    className="border-b border-slate-100 text-slate-700 last:border-0"
                  >
                    {columns.platform ? (
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <PlatformMark
                            config={
                              ADS[
                                account
                                  .platform
                              ]
                            }
                          />

                          {
                            ADS[
                              account
                                .platform
                            ].label
                          }
                        </div>
                      </td>
                    ) : null}

                    {columns.account ? (
                      <td className="px-3 py-3 font-medium text-slate-900">
                        {account.displayName ??
                          "Unnamed account"}
                      </td>
                    ) : null}

                    {columns.externalId ? (
                      <td className="px-3 py-3 font-mono text-xs text-slate-500">
                        {
                          account.externalAccountId
                        }
                      </td>
                    ) : null}

                    {columns.currency ? (
                      <td className="px-3 py-3">
                        {
                          account.currency
                        }
                      </td>
                    ) : null}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function socialSeries(
  dates: string[],
  platforms: SocialPlatformKey[],
  rows: SocialSummaryData["accountDaily"],
  metric:
    | "followers"
    | "impressions"
    | "engagement",
): Series[] {
  return platforms.map(
    (platform) => {
      const values =
        new Map<
          string,
          number
        >();

      rows
        .filter(
          (row) =>
            row.platform ===
            platform,
        )
        .forEach((row) => {
          values.set(
            row.date,
            (values.get(
              row.date,
            ) ?? 0) +
              row[metric],
          );
        });

      let carry = 0;

      if (
        metric ===
          "followers" &&
        dates[0]
      ) {
        const previous =
          Array.from(
            values.keys(),
          )
            .filter(
              (date) =>
                date <
                dates[0],
            )
            .sort()
            .at(-1);

        if (previous) {
          carry =
            values.get(
              previous,
            ) ?? 0;
        }
      }

      return {
        key: platform,
        ...SOCIAL[platform],

        values:
          dates.map(
            (date) => {
              const value =
                values.get(
                  date,
                );

              if (
                metric ===
                "followers"
              ) {
                if (
                  value !==
                  undefined
                ) {
                  carry =
                    value;
                }

                return carry;
              }

              return (
                value ??
                0
              );
            },
          ),
      };
    },
  );
}

function postSeries(
  dates: string[],
  platforms: SocialPlatformKey[],
  posts: SocialSummaryData["posts"],
): Series[] {
  return platforms.map(
    (platform) => {
      const counts =
        new Map<
          string,
          number
        >();

      posts
        .filter(
          (post) =>
            post.platform ===
            platform,
        )
        .forEach((post) => {
          const value =
            post.publishedAt ??
            post.scheduledAt;

          if (!value) {
            return;
          }

          const date =
            value.slice(
              0,
              10,
            );

          counts.set(
            date,
            (counts.get(
              date,
            ) ?? 0) + 1,
          );
        });

      return {
        key: platform,
        ...SOCIAL[platform],

        values:
          dates.map(
            (date) =>
              counts.get(
                date,
              ) ?? 0,
          ),
      };
    },
  );
}

function adSeries(
  dates: string[],
  platforms: SocialAdPlatformKey[],
  rows: SocialSummaryData["adDaily"],
  metric:
    | "impressions"
    | "clicks"
    | "cpm"
    | "cpc"
    | "spent",
): Series[] {
  return platforms.map(
    (platform) => {
      const byDate =
        new Map<
          string,
          {
            impressions: number;
            clicks: number;
            spend: number;
          }
        >();

      rows
        .filter(
          (row) =>
            row.platform ===
            platform,
        )
        .forEach((row) => {
          const current =
            byDate.get(
              row.date,
            ) ?? {
              impressions: 0,
              clicks: 0,
              spend: 0,
            };

          current.impressions +=
            row.impressions;

          current.clicks +=
            row.clicks;

          current.spend +=
            row.spendMinor /
            100;

          byDate.set(
            row.date,
            current,
          );
        });

      return {
        key: platform,
        ...ADS[platform],

        values:
          dates.map(
            (date) => {
              const value =
                byDate.get(
                  date,
                ) ?? {
                  impressions: 0,
                  clicks: 0,
                  spend: 0,
                };

              if (
                metric ===
                "impressions"
              ) {
                return value.impressions;
              }

              if (
                metric ===
                "clicks"
              ) {
                return value.clicks;
              }

              if (
                metric ===
                "spent"
              ) {
                return value.spend;
              }

              if (
                metric ===
                "cpm"
              ) {
                return value.impressions
                  ? (value.spend /
                      value.impressions) *
                      1000
                  : 0;
              }

              return value.clicks
                ? value.spend /
                    value.clicks
                : 0;
            },
          ),
      };
    },
  );
}

function cards(
  series: Series[],
  mode:
    | "sum"
    | "latest",
  formatter = number,
) {
  return series.map(
    (item) => ({
      key: item.key,

      config: {
        label:
          item.label,

        color:
          item.color,

        mark:
          item.mark,
      },

      value: formatter(
        mode === "latest"
          ? (item.values.at(
              -1,
            ) ?? 0)
          : item.values.reduce(
              (
                sum,
                value,
              ) =>
                sum +
                value,
              0,
            ),
      ),
    }),
  );
}

function total(
  series: Series[],
  mode:
    | "sum"
    | "latest",
) {
  return series.reduce(
    (
      sum,
      item,
    ) =>
      sum +
      (mode === "latest"
        ? (item.values.at(
            -1,
          ) ?? 0)
        : item.values.reduce(
            (
              inside,
              value,
            ) =>
              inside +
              value,
            0,
          )),
    0,
  );
}

export function SocialSummaryDashboard({
  data,
}: {
  data: SocialSummaryData;
}) {
  const searchParams =
    useSearchParams();

  const [
    tab,
    setTab,
  ] = useState<Tab>(
    "account",
  );

  const [
    range,
    setRange,
  ] = useState(30);

  const preview =
    searchParams.get(
      "preview",
    );

  const newPreview =
    preview === "new";

  const subscribedPreview =
    preview ===
    "subscribed";

  const previewing =
    newPreview ||
    subscribedPreview;

  const newUser =
    newPreview ||
    (!subscribedPreview &&
      !data.hasConnectedAccounts);

  const dates =
    makeDates(range);

  const fallback =
    dateKey(
      new Date(),
    );

  const start =
    dates[0] ??
    fallback;

  const end =
    dates.at(-1) ??
    fallback;

  const socialPlatforms =
    subscribedPreview
      ? PREVIEW_SOCIAL
      : Array.from(
          new Set<SocialPlatformKey>(
            [
              ...data.accounts.map(
                (item) =>
                  item.platform,
              ),

              ...data.accountDaily.map(
                (item) =>
                  item.platform,
              ),

              ...data.posts.map(
                (item) =>
                  item.platform,
              ),
            ],
          ),
        );

  const adPlatforms =
    subscribedPreview
      ? PREVIEW_ADS
      : Array.from(
          new Set<SocialAdPlatformKey>(
            [
              ...data.adAccounts.map(
                (item) =>
                  item.platform,
              ),

              ...data.adDaily.map(
                (item) =>
                  item.platform,
              ),
            ],
          ),
        );

  const allSocialRows =
    data.accountDaily.filter(
      (row) =>
        row.date <= end,
    );

  const periodSocialRows =
    allSocialRows.filter(
      (row) =>
        row.date >= start,
    );

  const periodPosts =
    data.posts.filter(
      (post) => {
        const value = (
          post.publishedAt ??
          post.scheduledAt ??
          post.createdAt
        ).slice(0, 10);

        return (
          value >= start &&
          value <= end
        );
      },
    );

  const periodAds =
    data.adDaily.filter(
      (row) =>
        row.date >= start &&
        row.date <= end,
    );

  const followers =
    socialSeries(
      dates,
      socialPlatforms,
      allSocialRows,
      "followers",
    );

  const impressions =
    socialSeries(
      dates,
      socialPlatforms,
      periodSocialRows,
      "impressions",
    );

  const interactions =
    socialSeries(
      dates,
      socialPlatforms,
      periodSocialRows,
      "engagement",
    );

  const posts =
    postSeries(
      dates,
      socialPlatforms,
      periodPosts,
    );

  const currency =
    data.adAccounts[0]
      ?.currency ??
    data.adDaily[0]
      ?.currency ??
    "CAD";

  function adPanel(
    metric:
      | "impressions"
      | "clicks"
      | "cpm"
      | "cpc"
      | "spent",

    title: string,
    description: string,
  ) {
    const series =
      adSeries(
        dates,
        adPlatforms,
        periodAds,
        metric,
      );

    const currencyMetric =
      metric === "cpm" ||
      metric === "cpc" ||
      metric === "spent";

    const formatter =
      currencyMetric
        ? (
            value: number,
          ) =>
            money(
              value,
              currency,
            )
        : number;

    const aggregate =
      adPlatforms.map(
        (platform) => {
          const rows =
            periodAds.filter(
              (row) =>
                row.platform ===
                platform,
            );

          const impressionsValue =
            rows.reduce(
              (
                sum,
                row,
              ) =>
                sum +
                row.impressions,
              0,
            );

          const clicksValue =
            rows.reduce(
              (
                sum,
                row,
              ) =>
                sum +
                row.clicks,
              0,
            );

          const spend =
            rows.reduce(
              (
                sum,
                row,
              ) =>
                sum +
                row.spendMinor,
              0,
            ) / 100;

          const value =
            metric ===
            "impressions"
              ? impressionsValue
              : metric ===
                  "clicks"
                ? clicksValue
                : metric ===
                    "spent"
                  ? spend
                  : metric ===
                      "cpm"
                    ? impressionsValue
                      ? (spend /
                          impressionsValue) *
                        1000
                      : 0
                    : clicksValue
                      ? spend /
                        clicksValue
                      : 0;

          return {
            platform,
            value,
          };
        },
      );

    const allImpressions =
      periodAds.reduce(
        (
          sum,
          row,
        ) =>
          sum +
          row.impressions,
        0,
      );

    const allClicks =
      periodAds.reduce(
        (
          sum,
          row,
        ) =>
          sum +
          row.clicks,
        0,
      );

    const allSpend =
      periodAds.reduce(
        (
          sum,
          row,
        ) =>
          sum +
          row.spendMinor,
        0,
      ) / 100;

    const allValue =
      metric ===
      "impressions"
        ? allImpressions
        : metric ===
            "clicks"
          ? allClicks
          : metric ===
              "spent"
            ? allSpend
            : metric ===
                "cpm"
              ? allImpressions
                ? (allSpend /
                    allImpressions) *
                  1000
                : 0
              : allClicks
                ? allSpend /
                  allClicks
                : 0;

    return (
      <MetricPanel
        title={title}
        description={
          description
        }
        total={formatter(
          allValue,
        )}
        cards={aggregate.map(
          ({
            platform,
            value,
          }) => ({
            key: platform,
            config:
              ADS[
                platform
              ],
            value:
              formatter(
                value,
              ),
          }),
        )}
        dates={dates}
        series={series}
        formatter={
          formatter
        }
      />
    );
  }

  if (
    !previewing &&
    data.dataUnavailable
  ) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-5 text-sm text-rose-700">
        TAKATAK could not
        safely load the
        social analytics
        database. No
        replacement or sample
        values are displayed.
      </div>
    );
  }

  if (
    !previewing &&
    !data.activeBrandId
  ) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center shadow-sm">
        <BarChart3 className="mx-auto h-8 w-8 text-slate-300" />

        <h1 className="mt-3 text-lg font-semibold text-slate-950">
          Choose an active
          brand
        </h1>

        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
          Social analytics are
          isolated to the
          active workspace and
          brand.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5c4cff]">
            TAKATAK Social
          </p>

          <h1 className="mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl">
            Analytics
          </h1>

          <p className="mt-1.5 text-sm text-slate-500">
            {data.activeBrandName
              ? `Summary for ${data.activeBrandName}.`
              : "Previewing the Social Summary dashboard."}
          </p>
        </div>

        {!newUser ? (
          <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm sm:w-auto">
            <CalendarDays className="h-4 w-4 text-slate-400" />

            <select
              value={range}
              onChange={(
                event,
              ) =>
                setRange(
                  Number(
                    event.target
                      .value,
                  ),
                )
              }
              className="bg-transparent font-medium outline-none"
            >
              {RANGES.map(
                (days) => (
                  <option
                    key={days}
                    value={days}
                  >
                    {days ===
                    365
                      ? "Last 12 months"
                      : `Last ${days} days`}
                  </option>
                ),
              )}
            </select>

            <span className="hidden text-xs text-slate-400 lg:inline">
              {displayDate(
                start,
              )}{" "}
              –{" "}
              {displayDate(
                end,
              )}
            </span>
          </label>
        ) : null}
      </header>

      {subscribedPreview ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
          Subscribed layout
          preview: all values
          remain zero until
          real provider
          records are
          synchronized.
        </div>
      ) : null}

      <nav
        aria-label="Analytics sections"
        className="flex gap-1 overflow-x-auto border-b border-slate-200"
      >
        {[
          {
            key:
              "account",
            label:
              "Account",
          },
          {
            key: "posts",
            label: "Posts",
          },
          {
            key: "ads",
            label:
              "Ad Accounts",
          },
        ].map((item) => (
          <button
            key={
              item.key
            }
            type="button"
            onClick={() =>
              setTab(
                item.key as Tab,
              )
            }
            className={`relative min-w-fit px-4 py-3 text-sm font-semibold ${
              tab ===
              item.key
                ? "text-[#5c4cff]"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {item.label}

            {tab ===
            item.key ? (
              <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#5c4cff]" />
            ) : null}
          </button>
        ))}
      </nav>

      {newUser ? (
        <NewUserView />
      ) : null}

      {!newUser &&
      tab === "account" ? (
        <div className="space-y-5">
          <MetricPanel
            title="Followers"
            description="Daily verified follower totals across connected social accounts."
            total={number(
              total(
                followers,
                "latest",
              ),
            )}
            cards={cards(
              followers,
              "latest",
            )}
            dates={dates}
            series={
              followers
            }
          />

          <MetricPanel
            title="Impressions"
            description="Content impressions received during the selected period."
            total={number(
              total(
                impressions,
                "sum",
              ),
            )}
            cards={cards(
              impressions,
              "sum",
            )}
            dates={dates}
            series={
              impressions
            }
          />
        </div>
      ) : null}

      {!newUser &&
      tab === "posts" ? (
        <div className="space-y-5">
          <MetricPanel
            title="Interactions"
            description="Verified engagement across connected social networks."
            total={number(
              total(
                interactions,
                "sum",
              ),
            )}
            cards={cards(
              interactions,
              "sum",
            )}
            dates={dates}
            series={
              interactions
            }
          />

          <MetricPanel
            title="Number of posts"
            description="Published and scheduled TAKATAK post records."
            total={number(
              total(
                posts,
                "sum",
              ),
            )}
            cards={cards(
              posts,
              "sum",
            )}
            dates={dates}
            series={posts}
          />

          <PostsTable
            posts={
              periodPosts
            }
          />
        </div>
      ) : null}

      {!newUser &&
      tab === "ads" ? (
        <div className="space-y-5">
          {adPanel(
            "impressions",
            "Impressions",
            "Verified paid impressions by advertising platform.",
          )}

          {adPanel(
            "clicks",
            "Clicks",
            "Verified paid clicks by advertising platform.",
          )}

          {adPanel(
            "cpm",
            "Performance CPM",
            "Calculated from real spend and impressions: spend ÷ impressions × 1,000.",
          )}

          {adPanel(
            "cpc",
            "Performance CPC",
            "Calculated from real spend and clicks: spend ÷ clicks.",
          )}

          {adPanel(
            "spent",
            "Spent",
            "Verified advertising spend in the account currency.",
          )}

          <AdTable
            accounts={
              data.adAccounts
            }
          />
        </div>
      ) : null}

      {!newUser &&
      tab !== "ads" &&
      socialPlatforms.length ===
        0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
          No connected social
          account is available
          for this view.
        </div>
      ) : null}

      {!newUser &&
      tab === "ads" &&
      adPlatforms.length ===
        0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
          No connected
          advertising
          account is available
          for this view.
        </div>
      ) : null}

      {!newUser &&
      tab === "account" &&
      periodSocialRows.length ===
        0 &&
      !subscribedPreview ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
          <MousePointerClick className="h-4 w-4 shrink-0 text-slate-400" />

          Connected accounts
          exist, but TAKATAK
          has not received
          verified provider
          analytics for this
          period.
        </div>
      ) : null}
    </div>
  );
}