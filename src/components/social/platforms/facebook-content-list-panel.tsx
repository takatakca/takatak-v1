"use client";

import { useEffect, useState } from "react";

import { displayDate } from "@/components/social/analytics/social-summary-tokens";

export type FacebookContentRow = {
  id: string;
  contentType: string;
  publishedAt: string;
  captionExcerpt: string | null;
  permalinkUrl: string | null;
  thumbnailUrl: string | null;
  availability: string;
  reach: number | null;
  views: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  engagement: number | null;
  metricStatus: Record<string, string> | null;
};

type ContentTotals = {
  count: number;
  reach: number | null;
  views: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  engagement: number | null;
};

function formatMetric(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString();
}

function availabilityLabel(value: string): string | null {
  if (value === "deleted") return "Deleted (history kept)";
  if (value === "expired") return "Expired (history kept)";
  if (value === "unknown") return "Availability unknown";
  return null;
}

function metricHint(
  status: Record<string, string> | null,
  key: string,
): string | null {
  if (!status) return null;
  const value = status[key];
  if (value === "partial") return "Partial";
  if (value === "permission_denied") return "Permission required";
  if (value === "privacy_threshold") return "Privacy threshold";
  if (value === "unsupported") return "Unsupported";
  return null;
}

export function FacebookContentListPanel({
  contentType,
  start,
  end,
  compareEnabled = false,
  liveMode,
}: {
  contentType: "post" | "reel" | "story";
  start: string;
  end: string;
  compareEnabled?: boolean;
  liveMode: boolean;
}) {
  const [sort, setSort] = useState<
    "publishedAt_desc" | "publishedAt_asc" | "engagement_desc"
  >("publishedAt_desc");
  const [items, setItems] = useState<FacebookContentRow[]>([]);
  const [totals, setTotals] = useState<ContentTotals | null>(null);
  const [compareTotals, setCompareTotals] = useState<ContentTotals | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!liveMode) {
      setItems([]);
      setTotals(null);
      setCompareTotals(null);
      setNotice("Connect a Facebook Page to load live content.");
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          type: contentType,
          range: "custom",
          start,
          end,
          sort,
        });
        if (compareEnabled) params.set("compare", "1");
        const response = await fetch(
          `/api/social/facebook/content?${params.toString()}`,
          {
            method: "GET",
            credentials: "same-origin",
            signal: controller.signal,
          },
        );
        const body = (await response.json()) as {
          ok?: boolean;
          message?: string;
          notice?: string;
          items?: FacebookContentRow[];
          totals?: ContentTotals;
          compareTotals?: ContentTotals | null;
        };
        if (cancelled) return;
        if (!response.ok || body.ok === false) {
          setError(body.message ?? "Content could not be loaded.");
          setItems([]);
          setTotals(null);
          setCompareTotals(null);
          return;
        }
        setItems(body.items ?? []);
        setTotals(body.totals ?? null);
        setCompareTotals(body.compareTotals ?? null);
        setNotice(body.notice ?? null);
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "Content could not be loaded.",
        );
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [liveMode, contentType, start, end, sort, compareEnabled]);

  const title =
    contentType === "post"
      ? "List of posts"
      : contentType === "reel"
        ? "List of reels"
        : "List of stories";

  return (
    <section className="rounded-[14px] border border-[#e8eaed] bg-white px-5 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[18px] font-semibold text-[#20242A]">{title}</h3>
          <p className="mt-1 text-sm text-[#6b7280]">
            {displayDate(start)} – {displayDate(end)}
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-[#6B7280]">
          <span>Sort</span>
          <select
            value={sort}
            onChange={(event) =>
              setSort(
                event.target.value as
                  | "publishedAt_desc"
                  | "publishedAt_asc"
                  | "engagement_desc",
              )
            }
            className="h-10 rounded-[10px] border border-[#d7dbe0] bg-white px-3 text-sm text-[#30343a]"
          >
            <option value="publishedAt_desc">Newest first</option>
            <option value="publishedAt_asc">Oldest first</option>
            <option value="engagement_desc">Highest engagement</option>
          </select>
        </label>
      </div>

      {totals ? (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["Count", totals.count, compareTotals?.count ?? null],
              ["Reach", totals.reach, compareTotals?.reach ?? null],
              ["Views", totals.views, compareTotals?.views ?? null],
              ["Reactions", totals.reactions, compareTotals?.reactions ?? null],
              ["Comments", totals.comments, compareTotals?.comments ?? null],
              ["Shares", totals.shares, compareTotals?.shares ?? null],
            ] as const
          ).map(([label, value, compareValue]) => (
            <div
              key={label}
              className="rounded-[10px] border border-[#eef0f2] bg-[#fafbfc] px-3 py-2.5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                {label}
              </p>
              <p className="mt-1 text-[18px] font-semibold text-[#20242A]">
                {label === "Count"
                  ? value.toLocaleString()
                  : formatMetric(value)}
              </p>
              {compareEnabled && compareTotals ? (
                <p className="mt-0.5 text-[11px] text-[#9aa1a9]">
                  vs{" "}
                  {label === "Count"
                    ? (compareValue ?? 0).toLocaleString()
                    : formatMetric(compareValue)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-sm text-[#6b7280]" aria-live="polite">
          Loading {contentType}s…
        </p>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {notice && !error ? (
        <div className="mb-4 rounded-[10px] border border-[#f0d48a] bg-[#fff8e6] px-4 py-3 text-sm text-[#6b5400]">
          {notice}
        </div>
      ) : null}

      {!loading && items.length === 0 && !error ? (
        <div className="flex min-h-[160px] flex-col items-center justify-center rounded-[10px] border border-dashed border-[#e1e4e7] bg-[#fafbfc] px-4 text-center">
          <p className="text-[15px] font-semibold text-[#30343a]">
            No {contentType}s in this period
          </p>
          <p className="mt-1 max-w-md text-sm text-[#6b7280]">
            Confirmed empty shows 0 in totals when the Page has no{" "}
            {contentType}s. Unavailable metrics stay —.
          </p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="divide-y divide-[#eef0f2]">
          {items.map((item) => {
            const availability = availabilityLabel(item.availability);
            return (
              <li key={item.id} className="flex gap-4 py-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-[#eef0f2]">
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-[#9aa1a9]">
                      No media
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#20242A]">
                      {new Date(item.publishedAt).toLocaleString()}
                    </p>
                    {availability ? (
                      <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-medium text-[#505761]">
                        {availability}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-[#505761]">
                    {item.captionExcerpt ?? "No caption"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#6b7280]">
                    {(
                      [
                        ["Reach", item.reach, "reach"],
                        ["Views", item.views, "views"],
                        ["Reactions", item.reactions, "reactions"],
                        ["Comments", item.comments, "comments"],
                        ["Shares", item.shares, "shares"],
                        ["Engagement", item.engagement, "engagement"],
                      ] as const
                    ).map(([label, value, key]) => {
                      const hint = metricHint(item.metricStatus, key);
                      return (
                        <span key={key}>
                          {label}:{" "}
                          <span className="font-semibold text-[#30343a]">
                            {formatMetric(value)}
                          </span>
                          {hint ? (
                            <span className="ml-1 text-[#9aa1a9]">({hint})</span>
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                  {item.permalinkUrl ? (
                    <a
                      href={item.permalinkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-semibold text-[#566DF1]"
                    >
                      Open on Facebook
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
