"use client";

import Link from "next/link";
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
  filterCockpit,
  type CockpitSnapshot,
} from "@/lib/reputation/cockpit-model";
import { REVIEW_SOURCES, reviewSource } from "@/lib/reputation/sources";

export function ReviewCockpit({
  snapshot,
  canManage,
}: {
  snapshot: CockpitSnapshot | null;
  canManage: boolean;
}) {
  const [source, setSource] = useState("all"),
    [query, setQuery] = useState(""),
    [state, setState] = useState("all"),
    [rating, setRating] = useState("all"),
    [days, setDays] = useState("all"),
    [expanded, setExpanded] = useState<string | null>(null),
    [page, setPage] = useState(1);
  const records = snapshot?.records;
  const filtered = useMemo(
    () =>
      filterCockpit(records || [], {
        source,
        query,
        state,
        rating: rating === "all" ? null : Number(rating),
        days: days === "all" ? null : Number(days),
      }),
    [records, source, query, state, rating, days],
  );
  const stats = cockpitStats(filtered);
  const missing = snapshot?.unavailable.length === 3;
  function reset(fn: () => void) {
    fn();
    setPage(1);
  }
  const exportQuery = new URLSearchParams({
    format: "csv",
    source,
    q: query,
    state,
    rating,
    days,
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
            <p className="mt-3 text-[11px] text-slate-600">
              {filtered.length} loaded records · Star averages exclude
              recommendations, non-rated records and excluded reviews. Response
              rate counts only confirmed replies and reply-capable records.
            </p>
          </Card>
          <div className="space-y-3">
            {filtered.slice((page - 1) * 12, page * 12).map((r) => (
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
                    {!r.recommended && <Badge>Excluded by source</Badge>}
                  </div>
                </div>
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                  {r.text || "No written comment."}
                </p>
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
                    (r.origin === "feedback" || r.origin === "external") && (
                      <ReviewDraftForm reviewId={r.id} origin={r.origin} />
                    )}
                  <span className="text-[11px] text-slate-500">
                    {r.origin === "feedback"
                      ? "First-party feedback"
                      : "Recorded in TAKATAK; provider access is checked when an action runs."}
                  </span>
                </div>
                {expanded === r.key && canManage && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    {r.source === "google" ? (
                      <GoogleReplyForm reviewId={r.id} draft={null} />
                    ) : r.source === "qmaps" && r.qmapsReviewId ? (
                      <QmapsReplyForm
                        reviewId={r.qmapsReviewId}
                        listingReviewId={r.id}
                      />
                    ) : null}
                  </div>
                )}
              </article>
            ))}
          </div>
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
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border px-3 py-2 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {page} of {Math.ceil(filtered.length / 12)}
              </span>
              <button
                disabled={page * 12 >= filtered.length}
                onClick={() => setPage(page + 1)}
                className="rounded-lg border px-3 py-2 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h3 className="font-semibold text-slate-900">
            Source API capabilities
          </h3>
          <p className="mt-2 text-xs leading-6 text-slate-600">
            A source catalog is not a live connection. Read access, management
            access and display rights are separate. Documentation access and
            account approval must be verified before activation.
          </p>
        </div>
        <div className="grid gap-px bg-slate-100 md:grid-cols-2 xl:grid-cols-3">
          {REVIEW_SOURCES.map((s) => (
            <div key={s.id} className="bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900">
                  {s.name}
                </h4>
                <Badge>{s.delivery.replaceAll("_", " ")}</Badge>
              </div>
              <p className="mt-3 text-xs leading-6 text-slate-700">{s.read}</p>
              <p className="mt-2 text-xs leading-6 text-slate-600">{s.reply}</p>
              <p className="mt-2 text-[11px] leading-6 text-slate-600">
                {s.publication}
              </p>
              <div className="mt-4 flex gap-4">
                <Link
                  href={s.route}
                  className="text-xs font-medium text-[#1565D8]"
                >
                  Open module
                </Link>
                <a
                  href={s.docs}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#1565D8]"
                >
                  API reference <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
