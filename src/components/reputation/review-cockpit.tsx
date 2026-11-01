"use client";

import Link from "next/link";
import {
  ReviewLayoutPicker,
  useReviewLayout,
  type ReviewLayout,
} from "./review-layout-picker";
import { ReviewInsights } from "./review-insights";
import { BrandHeroBackdrop } from "@/components/brand/brand-hero-backdrop";
import { Card } from "@/components/ui/card";
import { GrowthKpi } from "@/components/growth/growth-header";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCheck,
  Download,
  MessageSquare,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import { ReviewDraftForm } from "./review-draft-form";
import { GoogleReplyForm } from "./google-reply-form";
import { QmapsReplyForm } from "@/components/local-listings/qmaps-reply-form";
import { Badge } from "@/components/ui/badge";
import {
  cockpitStats,
  cockpitPage,
  sourceLocationGroups,
  filterCockpit,
  type CockpitSnapshot,
  type ReviewRecord,
} from "@/lib/reputation/cockpit-model";
import { REVIEW_SOURCES, reviewSource } from "@/lib/reputation/sources";

function ReviewSelection({
  review,
  active,
  onSelect,
  compact = false,
}: {
  review: ReviewRecord;
  active: boolean;
  onSelect: (key: string) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onSelect(review.key)}
      className={`block w-full min-w-0 border-l-4 p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 ${active ? "border-[#1565D8] bg-blue-50" : "border-transparent bg-white hover:bg-slate-50"}`}
    >
      <span
        className={
          compact
            ? "grid min-w-0 gap-x-4 gap-y-1 sm:grid-cols-[minmax(120px,0.7fr)_minmax(160px,1fr)_minmax(140px,1fr)_80px]"
            : "block"
        }
      >
        <span className="flex min-w-0 items-center justify-between gap-2">
          <span className="break-words text-sm font-semibold text-slate-900">
            {review.author}
          </span>
          <span className="shrink-0 text-xs text-slate-600">
            {review.rating === null ? "Not rated" : `${review.rating}/5`}
          </span>
        </span>
        <span
          className={`${compact ? "" : "mt-1"} block min-w-0 break-words text-xs text-slate-600`}
        >
          {reviewSource(review.source)?.name || "Other source"} ·{" "}
          {review.location}
        </span>
        <span
          className={`${compact ? "line-clamp-1" : "mt-2 line-clamp-2"} block min-w-0 break-words text-xs leading-5 text-slate-600`}
        >
          {review.text || "No written comment."}
        </span>
        <span
          className={`${compact ? "" : "mt-2"} flex flex-wrap justify-between gap-x-2 gap-y-1 text-[11px] text-slate-600`}
        >
          <span>{review.state.replaceAll("_", " ")}</span>
          <span>{review.createdAt.slice(0, 10)}</span>
        </span>
      </span>
      {review.ingestion && (
        <span className="mt-2 block text-[11px] text-slate-600">
          Imported · {review.ingestion}
        </span>
      )}
    </button>
  );
}

function ReviewResults({
  reviews,
  selectedKey,
  layout,
  onSelect,
}: {
  reviews: ReviewRecord[];
  selectedKey?: string;
  layout: ReviewLayout;
  onSelect: (key: string) => void;
}) {
  if (layout === "platforms") {
    const sources = Array.from(new Set(reviews.map((review) => review.source)));
    return (
      <Card className="min-w-0 overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Reviews by platform
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Source columns show this page of the filtered feed. Select any
            review to work on it below.
          </p>
        </div>
        <div
          role="region"
          aria-label="Review platform columns"
          tabIndex={0}
          className="overflow-x-auto p-3 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <div className="flex items-start gap-3">
            {sources.map((source) => {
              const items = reviews.filter(
                (review) => review.source === source,
              );
              return (
                <section
                  key={source}
                  aria-label={`${reviewSource(source)?.name || "Other source"} reviews`}
                  className="w-72 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-3">
                    <h3 className="text-xs font-semibold text-slate-900">
                      {reviewSource(source)?.name || "Other source"}
                    </h3>
                    <span className="text-xs text-slate-600">
                      {items.length} on this page
                    </span>
                  </div>
                  <ul className="max-h-[560px] space-y-2 overflow-y-auto p-2">
                    {items.map((review) => (
                      <li
                        key={review.key}
                        className="overflow-hidden rounded-lg border border-slate-200"
                      >
                        <ReviewSelection
                          review={review}
                          active={selectedKey === review.key}
                          onSelect={onSelect}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </Card>
    );
  }
  if (layout === "grid")
    return (
      <section aria-label="Review grid">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Review grid
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {reviews.map((review) => (
            <li
              key={review.key}
              className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <ReviewSelection
                review={review}
                active={selectedKey === review.key}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ul>
      </section>
    );
  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">
          {layout === "list" ? "Review list" : "Review inbox"}
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Select a customer story to review and respond
          {layout === "list" ? " below" : ""}.
        </p>
      </div>
      <ul
        className={`${layout === "inbox" ? "max-h-[560px] overflow-y-auto" : ""} divide-y divide-slate-100`}
        aria-label="Select a review"
      >
        {reviews.map((review) => (
          <li key={review.key}>
            <ReviewSelection
              review={review}
              active={selectedKey === review.key}
              onSelect={onSelect}
              compact={layout === "list"}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ReviewCockpit({
  snapshot,
  canManage,
  googleDrafts = {},
}: {
  snapshot: CockpitSnapshot | null;
  canManage: boolean;
  googleDrafts?: Record<string, { status: string; text: string }>;
}) {
  const [layout, setLayout] = useReviewLayout();
  const [source, setSource] = useState("all"),
    [query, setQuery] = useState(""),
    [location, setLocation] = useState("all"),
    [sort, setSort] = useState("newest"),
    [state, setState] = useState("all"),
    [rating, setRating] = useState("all"),
    [days, setDays] = useState("all"),
    [expanded, setExpanded] = useState<string | null>(null),
    [page, setPage] = useState(1),
    [selectedKey, setSelectedKey] = useState<string | null>(null);
  const records = snapshot?.records;
  const filtered = useMemo(
    () =>
      filterCockpit(records || [], {
        source,
        locationKey: location,
        query,
        state,
        rating: rating === "all" ? null : Number(rating),
        days: days === "all" ? null : Number(days),
      }).sort((a, b) => {
        if (
          sort === "pending" &&
          (a.state === "needs_reply") !== (b.state === "needs_reply")
        )
          return a.state === "needs_reply" ? -1 : 1;
        const difference = Date.parse(b.createdAt) - Date.parse(a.createdAt);
        return (
          (sort === "oldest" ? -difference : difference) ||
          a.key.localeCompare(b.key)
        );
      }),
    [records, source, query, state, rating, days, location, sort],
  );
  const pagination = cockpitPage(filtered.length, page);
  const visible = filtered.slice(pagination.start, pagination.end);
  const locations = sourceLocationGroups(records || []);
  const selected =
    visible.find((review) => review.key === selectedKey) || visible[0];
  const selectedIndex = selected
    ? visible.findIndex((review) => review.key === selected.key)
    : -1;
  function selectReview(key: string) {
    setSelectedKey(key);
    setExpanded(null);
  }
  const stats = cockpitStats(filtered);
  const missing = snapshot?.unavailable.length === 3;
  function reset(fn: () => void) {
    fn();
    setPage(1);
    setSelectedKey(null);
    setExpanded(null);
  }
  const exportQuery = new URLSearchParams({
    format: "csv",
    source,
    q: query,
    state,
    rating,
    days,
    locationKey: location,
  });
  return (
    <section className="space-y-5" aria-label="TAKATAK Review cockpit">
      <div className="relative isolate overflow-hidden rounded-2xl border border-blue-950 bg-[#060D1F] p-6 text-[#F5F8FC] sm:p-8">
        <BrandHeroBackdrop />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#29C3FF]">
              GROUPE TAKATAK · REVIEW
            </p>
            <h2 className="mt-4 text-balance text-2xl font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-3xl">
              Every experience. One reputation.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Your existing TAKATAK feedback, Google reviews and linked QMAPS
              records, together in the same workspace.
            </p>
          </div>
          <Link
            href="/dashboard/growth/ai-engine"
            className="inline-flex items-center gap-2 rounded-xl border border-blue-800 bg-blue-950 px-4 py-2 text-xs text-blue-100"
          >
            <Sparkles className="h-4 w-4" /> AI reply workspace{" "}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <p className="relative mt-5 border-t border-slate-700 pt-4 text-xs text-[#B8C4D3]">
          Digital Solutions. Real Results. Manage customer feedback across your
          connected TAKATAK businesses.
        </p>
      </div>
      {!snapshot ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Select an authorized client workspace to load its review cockpit. No
          sample records are mixed into this feed.
        </div>
      ) : (
        <>
          {(snapshot.unavailable.length > 0 ||
            snapshot.truncated.length > 0) && (
            <div
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900"
            >
              {snapshot.unavailable.length > 0 && (
                <p>
                  Some sources could not be loaded:{" "}
                  {snapshot.unavailable.join(", ")}. Available records remain
                  visible.
                </p>
              )}
              {snapshot.truncated.length > 0 && (
                <p>
                  The latest {snapshot.limitPerSource} records per store are
                  loaded. Older records exist in:{" "}
                  {snapshot.truncated.join(", ")}.
                </p>
              )}
              Statistics and CSV describe this loaded window, not a complete
              account export.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              {
                name: "Reviews in this view",
                value: missing ? "—" : stats.total,
                icon: MessageSquare,
              },
              {
                name: "Average star rating",
                value: stats.average?.toFixed(1) || "—",
                icon: Star,
              },
              {
                name: "Awaiting a reply",
                value: missing ? "—" : stats.unanswered,
                icon: MessageSquare,
              },
              {
                name: "Confirmed response rate",
                value:
                  stats.responseRate === null ? "—" : `${stats.responseRate}%`,
                icon: CheckCheck,
              },
            ].map(({ name, value }) => (
              <GrowthKpi key={name} label={name} value={String(value)} />
            ))}
          </div>
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative min-w-48 flex-1">
                <span className="sr-only">Search reviews</span>
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs"
                  value={query}
                  onChange={(e) => reset(() => setQuery(e.target.value))}
                  placeholder="Search a customer, location or review…"
                />
              </label>
              <label>
                <span className="sr-only">Review source</span>
                <select
                  className="rounded-lg border border-slate-300 p-2 text-xs"
                  value={source}
                  onChange={(e) => reset(() => setSource(e.target.value))}
                >
                  <option value="all">All sources</option>
                  {REVIEW_SOURCES.filter((s) => s.kind !== "social").map(
                    (s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ),
                  )}
                  <option value="other">Other / unclassified</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Business location</span>
                <select
                  value={location}
                  onChange={(event) =>
                    reset(() => setLocation(event.target.value))
                  }
                  className="max-w-full rounded-lg border border-slate-300 p-2 text-xs"
                >
                  <option value="all">All locations</option>
                  {locations.map((group) => (
                    <option key={group.key} value={group.key}>
                      {group.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Review order</span>
                <select
                  value={sort}
                  onChange={(event) => reset(() => setSort(event.target.value))}
                  className="rounded-lg border border-slate-300 p-2 text-xs"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="pending">Awaiting reply first</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Review state</span>
                <select
                  className="rounded-lg border border-slate-300 p-2 text-xs"
                  value={state}
                  onChange={(e) => reset(() => setState(e.target.value))}
                >
                  <option value="all">All statuses</option>
                  <option value="needs_reply">Needs a reply</option>
                  <option value="answered">Confirmed reply</option>
                  <option value="follow_up">Feedback to follow up</option>
                  <option value="resolved">Resolved feedback</option>
                  <option value="tracked">Tracked only</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Star rating</span>
                <select
                  className="rounded-lg border border-slate-300 p-2 text-xs"
                  value={rating}
                  onChange={(e) => reset(() => setRating(e.target.value))}
                >
                  <option value="all">All ratings</option>
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option key={r} value={r}>
                      {r} stars
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Review time period</span>
                <select
                  className="rounded-lg border border-slate-300 p-2 text-xs"
                  value={days}
                  onChange={(e) => reset(() => setDays(e.target.value))}
                >
                  <option value="all">Loaded history</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              </label>
              <a
                href={"/api/reputation/cockpit?" + exportQuery}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700"
              >
                <Download className="h-4 w-4" /> CSV window
              </a>
            </div>
            <p role="status" className="mt-3 text-[11px] text-slate-600">
              {filtered.length} loaded records · Star averages exclude
              recommendations, non-rated records and excluded reviews. Response
              rate counts only confirmed replies and reply-capable records.
            </p>
          </Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-600">
              One review feed · four ways to work
            </p>
            <ReviewLayoutPicker layout={layout} onChange={setLayout} />
          </div>
          <ReviewInsights records={filtered} />
          {visible.length > 0 && (
            <div
              className={
                layout === "inbox"
                  ? "grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)]"
                  : "min-w-0 space-y-4"
              }
            >
              <ReviewResults
                reviews={visible}
                selectedKey={selected?.key}
                layout={layout}
                onSelect={selectReview}
              />
              <div
                className="min-w-0 space-y-3"
                aria-label="Selected review detail"
              >
                {(selected ? [selected] : []).map((r) => (
                  <article
                    key={r.key}
                    className="rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {r.author}
                        </h3>
                        <p className="mt-1 text-xs text-slate-600">
                          {reviewSource(r.source)?.name || "Other source"} ·{" "}
                          {r.location} · {r.createdAt.slice(0, 10)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.rating !== null ? (
                          <span
                            aria-label={`${r.rating} out of 5 stars`}
                            className="text-sm text-amber-800"
                          >
                            {"★".repeat(r.rating)}
                            {"☆".repeat(5 - r.rating)}
                          </span>
                        ) : (
                          <Badge>Not star-rated</Badge>
                        )}
                        <Badge
                          tone={
                            r.state === "answered"
                              ? "success"
                              : r.state === "needs_reply"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {r.state.replaceAll("_", " ")}
                        </Badge>
                        {r.ingestion ? (
                          <Badge>Imported · {r.ingestion}</Badge>
                        ) : !r.recommended ? (
                          <Badge>Excluded by source</Badge>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                      {r.text || "No written comment."}
                    </p>
                    {r.origin === "external" &&
                      r.source === "google" &&
                      googleDrafts[r.id] && (
                        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                          <p className="text-xs font-semibold text-blue-900">
                            AI draft ·{" "}
                            {googleDrafts[r.id].status.replaceAll("_", " ")}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                            {googleDrafts[r.id].text}
                          </p>
                          <p className="mt-2 text-[11px] text-slate-600">
                            Review the wording before publishing. A generated
                            draft is not a public response.
                          </p>
                        </div>
                      )}
                    {r.response && (
                      <div className="mt-4 rounded-xl border-l-2 border-blue-500 bg-blue-50 p-4">
                        <p className="text-xs font-semibold text-blue-900">
                          Confirmed source response
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                          {r.response}
                        </p>
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3">
                      {canManage &&
                        r.source === "google" &&
                        r.origin === "external" && (
                          <button
                            type="button"
                            aria-expanded={expanded === r.key}
                            aria-controls={
                              expanded === r.key
                                ? `review-response-${r.key}`
                                : undefined
                            }
                            onClick={() =>
                              setExpanded(expanded === r.key ? null : r.key)
                            }
                            className="text-xs font-semibold text-[#1565D8]"
                          >
                            {expanded === r.key
                              ? "Close response"
                              : "Respond on Google"}
                          </button>
                        )}
                      {canManage && r.source === "qmaps" && r.qmapsReviewId && (
                        <button
                          type="button"
                          aria-expanded={expanded === r.key}
                          aria-controls={
                            expanded === r.key
                              ? `review-response-${r.key}`
                              : undefined
                          }
                          onClick={() =>
                            setExpanded(expanded === r.key ? null : r.key)
                          }
                          className="text-xs font-semibold text-[#1565D8]"
                        >
                          {expanded === r.key
                            ? "Close response"
                            : "Respond on QMAPS"}
                        </button>
                      )}
                      {r.sourceUrl && (
                        <a
                          href={r.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-[#1565D8]"
                        >
                          Open original review{" "}
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      )}
                      {r.origin === "feedback" && (
                        <Link
                          href="#first-party-feedback"
                          className="text-xs font-semibold text-[#1565D8]"
                        >
                          Follow up / convert to lead
                        </Link>
                      )}
                      {r.canDraft &&
                        canManage &&
                        (r.origin === "feedback" ||
                          r.origin === "external" ||
                          r.origin === "listing") && (
                          <ReviewDraftForm reviewId={r.id} origin={r.origin} />
                        )}
                      <span className="text-[11px] text-slate-500">
                        {r.ingestion
                          ? "Operator-imported; not provider-verified. Excluded from source rating averages."
                          : r.origin === "feedback"
                            ? "First-party feedback"
                            : "Recorded in TAKATAK; provider access is checked when an action runs."}
                      </span>
                    </div>
                    {expanded === r.key && canManage && (
                      <div
                        id={`review-response-${r.key}`}
                        className="mt-4 border-t border-slate-100 pt-4"
                      >
                        {r.source === "google" ? (
                          <GoogleReplyForm
                            reviewId={r.id}
                            draft={googleDrafts[r.id]?.text ?? null}
                          />
                        ) : r.source === "qmaps" && r.qmapsReviewId ? (
                          <QmapsReplyForm
                            reviewId={r.qmapsReviewId}
                            listingReviewId={r.id}
                          />
                        ) : null}
                      </div>
                    )}
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <p className="text-xs text-slate-600">
                        Review {selectedIndex + 1} of {visible.length} on this
                        page
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={selectedIndex <= 0}
                          onClick={() =>
                            selectReview(visible[selectedIndex - 1].key)
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-40"
                        >
                          Previous review
                        </button>
                        <button
                          type="button"
                          disabled={
                            selectedIndex < 0 ||
                            selectedIndex >= visible.length - 1
                          }
                          onClick={() =>
                            selectReview(visible[selectedIndex + 1].key)
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-40"
                        >
                          Next review
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
          {!filtered.length && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Star className="mx-auto h-8 w-8 text-[#1565D8]" />
              <h3 className="mt-4 font-semibold text-slate-900">
                {missing
                  ? "Review sources are temporarily unavailable"
                  : "Your next customer story starts here"}
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
                Create a first-party review page or use an approved source
                connection. Unsupported provider actions stay unavailable.
              </p>
            </div>
          )}
          {filtered.length > 12 && (
            <div className="flex items-center justify-end gap-3 text-xs">
              <button
                disabled={pagination.page === 1}
                onClick={() => {
                  setPage(pagination.page - 1);
                  setExpanded(null);
                }}
                className="rounded-lg border px-3 py-2 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page === pagination.totalPages}
                onClick={() => {
                  setPage(pagination.page + 1);
                  setExpanded(null);
                }}
                className="rounded-lg border px-3 py-2 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
