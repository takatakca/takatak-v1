"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  BLOCK_REASON_LABELS,
  PUBLICATION_STATE_LABELS,
  type PublicationBlockReason,
  type PublicationState,
} from "@/lib/social/publishing/publication-model";

export type PublicationSummary = {
  state: PublicationState | null;
  remotePostId: string | null;
  permalinkUrl: string | null;
  errorMessage: string | null;
  confirmedAt: string | null;
};

type Props = {
  postId: string;
  postStatus: string;
  platform: string;
  approvalStatus: string | null;
  publication: PublicationSummary | null;
  canReview: boolean;
  canPublish: boolean;
  lang?: "en" | "fr";
};

type Notice = { tone: "ok" | "warn"; text: string };

const COPY = {
  en: {
    approve: "Approve",
    reject: "Reject",
    changes: "Request changes",
    publishNow: "Publish now",
    schedule: "Schedule",
    cancel: "Cancel schedule",
    working: "Working…",
    pickTime: "Choose a date and time",
    published: "Published on Facebook",
    open: "Open post",
    approved: "Approved. Choose Publish now or Schedule.",
    rejected: "Rejected. The post is back in drafts.",
    changesRequested: "Changes requested. The post is back in drafts.",
    scheduled: "Scheduled. It will publish automatically.",
    cancelled: "Schedule cancelled.",
    onlyFacebook: "Automatic publishing is available for Facebook Pages. Other networks: coming soon.",
    failed: "Publication failed",
  },
  fr: {
    approve: "Approuver",
    reject: "Refuser",
    changes: "Demander des changements",
    publishNow: "Publier maintenant",
    schedule: "Planifier",
    cancel: "Annuler la planification",
    working: "En cours…",
    pickTime: "Choisissez une date et une heure",
    published: "Publié sur Facebook",
    open: "Ouvrir la publication",
    approved: "Approuvé. Choisissez Publier maintenant ou Planifier.",
    rejected: "Refusé. La publication retourne aux brouillons.",
    changesRequested: "Changements demandés. La publication retourne aux brouillons.",
    scheduled: "Planifié. La publication partira automatiquement.",
    cancelled: "Planification annulée.",
    onlyFacebook: "La publication automatique est offerte pour les Pages Facebook. Autres réseaux : bientôt.",
    failed: "Échec de publication",
  },
} as const;

async function call(method: "POST" | "DELETE", url: string, body: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
    credentials: "same-origin",
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  return { status: response.status, data };
}

function blockLabel(code: unknown, lang: "en" | "fr"): string | null {
  if (typeof code !== "string") return null;
  const label = BLOCK_REASON_LABELS[code as PublicationBlockReason];
  return label ? label[lang] : null;
}

export function PublicationActions({
  postId,
  postStatus,
  platform,
  approvalStatus,
  publication,
  canReview,
  canPublish,
  lang = "en",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [when, setWhen] = useState("");
  const t = COPY[lang];
  const working = busy || pending;

  const base = `/api/social/posts/${postId}`;

  async function run(task: () => Promise<Notice | null>) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await task();
      if (result) setNotice(result);
      startTransition(() => router.refresh());
    } catch {
      setNotice({ tone: "warn", text: lang === "fr" ? "Action indisponible pour le moment." : "The action is unavailable right now." });
    } finally {
      setBusy(false);
    }
  }

  function decide(decision: "approve" | "reject" | "request_changes") {
    void run(async () => {
      const { status, data } = await call("POST", `${base}/decision`, { decision });
      if (status >= 400) {
        return { tone: "warn", text: String(data.message ?? data.code ?? `HTTP ${status}`) };
      }
      return {
        tone: "ok",
        text: decision === "approve" ? t.approved : decision === "reject" ? t.rejected : t.changesRequested,
      };
    });
  }

  function publish(mode: "now" | "schedule") {
    void run(async () => {
      const body = mode === "now" ? { mode } : { mode, scheduledAt: new Date(when).toISOString() };
      const { status, data } = await call("POST", `${base}/publish`, body);
      if (status >= 400) {
        return { tone: "warn", text: blockLabel(data.code, lang) ?? String(data.message ?? data.code ?? `HTTP ${status}`) };
      }
      if (mode === "schedule") return { tone: "ok", text: t.scheduled };
      const outcome = (data.outcome ?? {}) as Record<string, unknown>;
      if (outcome.outcome === "published") return { tone: "ok", text: t.published };
      const receipt = (data.publication ?? {}) as Record<string, unknown>;
      const state = receipt.state as PublicationState | undefined;
      const stateLabel = state ? PUBLICATION_STATE_LABELS[state][lang] : null;
      const reason = blockLabel(outcome.reason, lang);
      const detail = typeof receipt.errorMessage === "string" ? receipt.errorMessage : null;
      return { tone: "warn", text: [stateLabel ?? t.failed, reason ?? detail].filter(Boolean).join(" — ") };
    });
  }

  function cancel() {
    void run(async () => {
      const { status, data } = await call("DELETE", `${base}/publish`, {});
      if (status >= 400) return { tone: "warn", text: String(data.message ?? data.code ?? `HTTP ${status}`) };
      return { tone: "ok", text: t.cancelled };
    });
  }

  const reviewable = canReview && approvalStatus === "pending" && (postStatus === "pending_approval" || postStatus === "draft");
  const publishable = canPublish && platform === "facebook" && (postStatus === "approved" || postStatus === "failed" || (postStatus === "draft" && !approvalStatus));
  const scheduled = postStatus === "scheduled";
  const isPublished = postStatus === "published" || publication?.state === "confirmed";

  return (
    <div className="mt-3 space-y-2">
      {isPublished ? (
        <p className="text-xs font-medium text-emerald-700">
          {t.published}
          {publication?.permalinkUrl ? (
            <>
              {" · "}
              <a href={publication.permalinkUrl} target="_blank" rel="noreferrer" className="underline">
                {t.open}
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      {!isPublished && publication?.state ? (
        <p className={`text-xs ${publication.state === "failed" || publication.state === "needs_reconnect" ? "text-rose-700" : "text-slate-500"}`}>
          {PUBLICATION_STATE_LABELS[publication.state][lang]}
          {publication.errorMessage ? ` — ${publication.errorMessage}` : ""}
        </p>
      ) : null}
      {canPublish && platform !== "facebook" && !isPublished ? (
        <p className="text-xs text-slate-500">{t.onlyFacebook}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {reviewable ? (
          <>
            <Button onClick={() => decide("approve")} disabled={working} primary>{t.approve}</Button>
            <Button onClick={() => decide("request_changes")} disabled={working}>{t.changes}</Button>
            <Button onClick={() => decide("reject")} disabled={working}>{t.reject}</Button>
          </>
        ) : null}
        {publishable && !isPublished ? (
          <>
            <Button onClick={() => publish("now")} disabled={working} primary>{t.publishNow}</Button>
            <Button onClick={() => setShowSchedule((value) => !value)} disabled={working}>{t.schedule}</Button>
          </>
        ) : null}
        {scheduled && canPublish ? (
          <Button onClick={cancel} disabled={working}>{t.cancel}</Button>
        ) : null}
      </div>

      {showSchedule && publishable && !isPublished ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (when) publish("schedule");
          }}
        >
          <label className="sr-only" htmlFor={`when-${postId}`}>{t.pickTime}</label>
          <input
            id={`when-${postId}`}
            type="datetime-local"
            required
            value={when}
            onChange={(event) => setWhen(event.target.value)}
            className="h-9 rounded-md border border-slate-300 px-2 text-sm"
          />
          <Button type="submit" disabled={working || !when} primary>{t.schedule}</Button>
        </form>
      ) : null}

      {notice ? (
        <p role={notice.tone === "warn" ? "alert" : "status"} className={`text-xs ${notice.tone === "warn" ? "text-rose-700" : "text-emerald-700"}`}>
          {working ? t.working : notice.text}
        </p>
      ) : null}
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  primary,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={
        primary
          ? "inline-flex h-9 items-center justify-center rounded-md bg-[#0a1f44] px-3 text-sm font-semibold text-white transition hover:bg-[#13306b] disabled:opacity-50"
          : "inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}
