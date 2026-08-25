"use client";

import {
  Columns3,
  Download,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { SocialSummaryData } from "@/components/social/analytics/social-summary-types";
import {
  MetricSection,
} from "@/components/social/analytics/social-summary-metric-section";
import {
  PLATFORM_CARD_COLORS,
  PLATFORM_NAMES,
  POST_PLATFORM_ORDER,
  displayDate,
  enumerateDates,
  metricValue,
  type SocialPlatformKey,
} from "@/components/social/analytics/social-summary-tokens";

type PostColumn = "platform" | "caption" | "status" | "date";

const COLUMN_LABELS: Record<PostColumn, string> = {
  platform: "Platform",
  caption: "Caption",
  status: "Status",
  date: "Date",
};

function postDate(post: SocialSummaryData["posts"][number]) {
  return (post.publishedAt ?? post.scheduledAt ?? post.createdAt).slice(0, 10);
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export function SocialSummaryPostsTab({
  data,
  start,
  end,
}: {
  data: SocialSummaryData;
  start: string;
  end: string;
}) {
  const [query, setQuery] = useState("");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<PostColumn[]>([
    "platform",
    "caption",
    "status",
    "date",
  ]);

  const periodPosts = useMemo(
    () =>
      data.posts.filter((post) => {
        const date = postDate(post);
        return date >= start && date <= end;
      }),
    [data.posts, start, end],
  );

  const filteredPosts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return periodPosts;
    }

    return periodPosts.filter((post) => {
      const haystack = [
        PLATFORM_NAMES[post.platform],
        post.caption,
        post.status,
        postDate(post),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [periodPosts, query]);

  const platforms = useMemo(() => {
    const extras = [
      ...new Set([
        ...data.accounts.map((account) => account.platform),
        ...periodPosts.map((post) => post.platform),
      ]),
    ].filter((platform) => !POST_PLATFORM_ORDER.includes(platform));

    return [...POST_PLATFORM_ORDER, ...extras];
  }, [data.accounts, periodPosts]);

  const countsByPlatform = useMemo(() => {
    const map = new Map<SocialPlatformKey, number>();

    for (const post of periodPosts) {
      map.set(post.platform, (map.get(post.platform) ?? 0) + 1);
    }

    return map;
  }, [periodPosts]);

  const total = metricValue(periodPosts.length);

  const cards = platforms.map((platform) => ({
    key: platform,
    label: PLATFORM_NAMES[platform],
    color: PLATFORM_CARD_COLORS[platform],
    value: metricValue(countsByPlatform.get(platform) ?? 0),
  }));

  const dates = enumerateDates(start, end);

  const points = dates.map((date) => {
    const count = periodPosts.filter((post) => postDate(post) === date).length;
    return { date, value: metricValue(count) };
  });

  function toggleColumn(column: PostColumn) {
    setVisibleColumns((current) => {
      if (current.includes(column)) {
        if (current.length === 1) {
          return current;
        }

        return current.filter((item) => item !== column);
      }

      return [...current, column];
    });
  }

  function downloadCsv() {
    const headers = visibleColumns.map((column) => COLUMN_LABELS[column]);
    const rows = filteredPosts.map((post) =>
      visibleColumns.map((column) => {
        switch (column) {
          case "platform":
            return PLATFORM_NAMES[post.platform];
          case "caption":
            return post.caption;
          case "status":
            return post.status;
          case "date":
            return postDate(post);
        }
      }),
    );

    const body = [headers, ...rows]
      .map((row) => row.map((cell) => csvEscape(cell)).join(","))
      .join("\n");

    const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `takatak-posts-${start}-to-${end}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const searchActive = query.trim().length > 0;
  const emptyPeriod = periodPosts.length === 0;
  const emptySearch = searchActive && filteredPosts.length === 0;

  return (
    <div className="space-y-8">
      <h2 className="text-[22px] font-semibold text-[#20242A]">Posts</h2>

      <MetricSection
        title="Number of posts"
        total={total}
        cards={cards}
        points={points}
        seriesLabel="Posts"
      />

      <section className="space-y-4">
        <h2 className="text-[18px] font-semibold text-[#20242a]">
          List of posts
        </h2>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search posts</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa1a9]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-11 w-full rounded-[10px] border border-[#d7dbe0] bg-white pl-10 pr-3 text-sm text-[#30343a] outline-none transition focus:border-[#a8b0ff] focus:ring-2 focus:ring-[#efeeff]"
            />
          </label>

          <div className="relative flex gap-2">
            <button
              type="button"
              aria-expanded={columnsOpen}
              aria-haspopup="menu"
              onClick={() => setColumnsOpen((open) => !open)}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#d7dbe0] bg-white px-3.5 text-sm font-medium text-[#30343a] transition hover:bg-[#f8f9fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c4cff]"
            >
              <Columns3 className="h-4 w-4" />
              Columns
            </button>

            <button
              type="button"
              onClick={downloadCsv}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#d7dbe0] bg-white px-3.5 text-sm font-medium text-[#30343a] transition hover:bg-[#f8f9fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c4cff]"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </button>

            {columnsOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-12 z-20 w-48 rounded-xl border border-[#e1e4e7] bg-white p-2 shadow-[0_12px_30px_rgba(15,23,42,0.12)]"
              >
                {(Object.keys(COLUMN_LABELS) as PostColumn[]).map((column) => {
                  const checked = visibleColumns.includes(column);

                  return (
                    <label
                      key={column}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[#30343a] hover:bg-[#f5f6f8]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleColumn(column)}
                        className="rounded border-[#c5cad1]"
                      />
                      {COLUMN_LABELS[column]}
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        {emptySearch ? (
          <EmptyPostsState
            title="Oops! Nothing found, try another search"
            description="You can use the filter tools to narrow down your search. Check if the current date range suits your needs."
          />
        ) : emptyPeriod ? (
          <EmptyPostsState
            title="No posts in this period"
            description="Try another date range, or publish content to see posts appear here."
          />
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
                {filteredPosts.map((post) => (
                  <tr key={post.id} className="text-[#30343a]">
                    {visibleColumns.includes("platform") ? (
                      <td className="px-4 py-3 font-medium">
                        {PLATFORM_NAMES[post.platform]}
                      </td>
                    ) : null}
                    {visibleColumns.includes("caption") ? (
                      <td className="max-w-[420px] truncate px-4 py-3 text-[#505761]">
                        {post.caption || "—"}
                      </td>
                    ) : null}
                    {visibleColumns.includes("status") ? (
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-[#f3f4f6] px-2 py-1 text-xs font-medium text-[#505761]">
                          {post.status}
                        </span>
                      </td>
                    ) : null}
                    {visibleColumns.includes("date") ? (
                      <td className="whitespace-nowrap px-4 py-3 text-[#6b7280]">
                        {displayDate(postDate(post))}
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

function EmptyPostsState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[12px] border border-[#e8eaed] bg-[#fafbfc] px-6 py-16 text-center">
      <svg
        width="88"
        height="72"
        viewBox="0 0 88 72"
        fill="none"
        aria-hidden="true"
        className="mb-5"
      >
        <rect
          x="18"
          y="18"
          width="44"
          height="36"
          rx="6"
          fill="#e8eaed"
        />
        <rect x="26" y="28" width="28" height="4" rx="2" fill="#c5cad1" />
        <rect x="26" y="36" width="20" height="4" rx="2" fill="#c5cad1" />
        <circle cx="62" cy="48" r="14" fill="#dfe3e8" stroke="#b8bec6" strokeWidth="3" />
        <path
          d="M71 57 L79 65"
          stroke="#b8bec6"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>

      <p className="text-[16px] font-semibold text-[#30343a]">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#6b7280]">
        {description}
      </p>
    </div>
  );
}
