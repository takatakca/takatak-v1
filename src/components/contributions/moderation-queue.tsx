"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type QueueItem = {
  id: string;
  publisherCode: string;
  resourceType: string;
  resourceKey: string;
  action: string;
  reason: string | null;
  proposedPatch: unknown;
  evidenceUrls: string[];
  attachmentUrls: string[];
  contributorTier: string;
  priority: string;
  reviewDueAt: string;
  status: string;
  aiReviewStatus: string;
  aiReview: unknown;
  createdAt: string;
  contributor: {
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

function contributorName(item: QueueItem) {
  return (
    item.contributor?.displayName ||
    [item.contributor?.firstName, item.contributor?.lastName].filter(Boolean).join(" ") ||
    (item.contributorTier === "guest" ? "Guest contributor" : "Registered contributor")
  );
}

export function ModerationQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/contributions?publisher=ahmv&status=pending_review", {
        cache: "no-store",
      });
      const payload = await response.json() as { ok?: boolean; items?: QueueItem[]; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Queue load failed.");
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Queue load failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(item: QueueItem, decision: "approve" | "reject" | "changes_requested") {
    const comment =
      window.prompt(
        decision === "approve"
          ? "Moderator note (optional)"
          : "Moderator explanation",
      ) ?? "";

    let officialSourceVerified = false;
    if (decision === "approve" && item.resourceType === "schedule") {
      officialSourceVerified = window.confirm(
        "Official-source gate: have you personally verified the schedule correction against an authoritative AHMV/league source?",
      );
      if (!officialSourceVerified) return;
    }

    setBusyId(item.id);
    setError("");
    try {
      const response = await fetch(`/api/contributions/${item.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          comment,
          officialSourceVerified,
        }),
      });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Moderation update failed.");
      setItems((current) => current.filter((row) => row.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Moderation update failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        Loading moderation queue…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">
            {items.length} contribution{items.length === 1 ? "" : "s"} waiting
          </p>
          <p className="text-xs text-slate-500">
            Member priority targets 48 hours. Standard contributions target 1–7 days.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <BadgeCheck className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="mt-3 font-semibold text-slate-900">Moderation queue is clear</p>
          <p className="mt-1 text-sm text-slate-500">No AHMV contributions currently require review.</p>
        </div>
      ) : null}

      {items.map((item) => {
        const high = item.priority === "member_priority";
        const flagged = item.aiReviewStatus === "flagged";
        const due = new Date(item.reviewDueAt);
        return (
          <article
            key={item.id}
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${high ? "border-orange-300" : "border-slate-200"}`}
          >
            <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${high ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-600"}`}>
                    {high ? "High priority · 48h" : "Low priority · 1–7 days"}
                  </span>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                    {item.resourceType}
                  </span>
                  <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {item.action}
                  </span>
                  {flagged ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                      <AlertTriangle className="h-3 w-3" /> machine flagged
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                      <ShieldCheck className="h-3 w-3" /> pre-screen passed
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-lg font-semibold text-slate-950">{item.resourceKey}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {contributorName(item)} · {item.contributorTier}
                </p>
              </div>
              <div className="text-left lg:text-right">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Clock3 className="h-3.5 w-3.5" />
                  Due {Number.isNaN(due.getTime()) ? item.reviewDueAt : due.toLocaleString()}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">ID {item.id}</p>
              </div>
            </div>

            <div className="grid gap-5 p-5 xl:grid-cols-[1fr_1fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contributor reason</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{item.reason || "No explanation supplied."}</p>

                {item.evidenceUrls.length ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence</p>
                    <div className="mt-2 space-y-1">
                      {item.evidenceUrls.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-indigo-600 hover:underline">
                          {url}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                {item.attachmentUrls.length ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attachments / proposed media</p>
                    <div className="mt-2 space-y-1">
                      {item.attachmentUrls.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-indigo-600 hover:underline">
                          {url}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proposed patch</p>
                <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  {JSON.stringify(item.proposedPatch, null, 2)}
                </pre>
                {flagged ? (
                  <pre className="mt-3 max-h-40 overflow-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                    {JSON.stringify(item.aiReview, null, 2)}
                  </pre>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50 p-4">
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => void review(item, "approve")}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve & queue publication
              </button>
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => void review(item, "changes_requested")}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
              >
                <AlertTriangle className="h-4 w-4" />
                Request changes
              </button>
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => void review(item, "reject")}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
