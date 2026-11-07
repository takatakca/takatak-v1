// Social publishing engine — pure state model (no database, no network).
//
// One SocialPost is one delivery target (one platform, one connected account).
// Its durable publication receipt lives in SocialPost.metadata.publication and
// is the only evidence that may mark a post `published`. A Job row
// (type `approve_post`, metadata.source = SOCIAL_PUBLICATION_JOB_SOURCE) is the
// durable queue entry with lease/attempt columns. No schema change.

import { createHash } from "node:crypto";

export const SOCIAL_PUBLICATION_JOB_SOURCE = "social_publication_v1" as const;
export const SOCIAL_PUBLICATION_RECEIPT_VERSION = 1 as const;
export const SOCIAL_PUBLICATION_MAX_ATTEMPTS = 3;
export const SOCIAL_PUBLICATION_LEASE_MS = 120_000;
export const SOCIAL_PUBLICATION_CAPTION_LIMIT = 8_000;
/** Facebook Page feed posts accept up to 63,206 characters; keep a product cap. */
export const FACEBOOK_FEED_MESSAGE_LIMIT = 8_000;
/** Reconciliation looks this far back before the attempt start for a matching post. */
export const SOCIAL_RECONCILE_LOOKBACK_MS = 10 * 60_000;

export type PublicationState =
  | "sending"
  | "confirmed"
  | "failed"
  | "uncertain"
  | "needs_reconnect";

export type PublicationErrorCategory =
  | "permission_denied"
  | "authorization_expired"
  | "invalid_content"
  | "rate_limited"
  | "provider_unavailable"
  | "timeout"
  | "not_configured"
  | "unknown";

export type PublicationReceipt = {
  version: typeof SOCIAL_PUBLICATION_RECEIPT_VERSION;
  attemptId: string;
  jobId: string | null;
  state: PublicationState;
  provider: "meta";
  platform: "facebook";
  targetExternalId: string;
  contentHash: string;
  startedAt: string;
  confirmedAt: string | null;
  remotePostId: string | null;
  permalinkUrl: string | null;
  errorCategory: PublicationErrorCategory | null;
  errorMessage: string | null;
  attempts: number;
};

export type SocialPostLike = {
  status: string;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  caption: string;
  platform: string;
  socialAccountId: string | null;
  metadata: unknown;
};

export const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const iso = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 64 &&
  Number.isFinite(Date.parse(value));

const STATES: PublicationState[] = [
  "sending",
  "confirmed",
  "failed",
  "uncertain",
  "needs_reconnect",
];

const CATEGORIES: PublicationErrorCategory[] = [
  "permission_denied",
  "authorization_expired",
  "invalid_content",
  "rate_limited",
  "provider_unavailable",
  "timeout",
  "not_configured",
  "unknown",
];

/** Canonical caption used for hashing and for the provider request. */
export function canonicalCaption(caption: string): string {
  return caption.replace(/\r\n/g, "\n").trim();
}

export function publicationContentHash(input: {
  caption: string;
  link?: string | null;
  mediaUrls?: string[];
}): string {
  const hash = createHash("sha256");
  hash.update(canonicalCaption(input.caption));
  hash.update("\u0000");
  hash.update(input.link?.trim() ?? "");
  hash.update("\u0000");
  hash.update((input.mediaUrls ?? []).map((url) => url.trim()).join("\n"));
  return hash.digest("hex");
}

/** Read a durable receipt; anything malformed is treated as absent. */
export function readPublicationReceipt(metadata: unknown): PublicationReceipt | null {
  const raw = record(record(metadata).publication);
  if (raw.version !== SOCIAL_PUBLICATION_RECEIPT_VERSION) return null;
  if (typeof raw.attemptId !== "string" || !raw.attemptId) return null;
  if (!STATES.includes(raw.state as PublicationState)) return null;
  if (raw.provider !== "meta" || raw.platform !== "facebook") return null;
  if (typeof raw.targetExternalId !== "string" || !raw.targetExternalId) return null;
  if (typeof raw.contentHash !== "string" || !/^[0-9a-f]{64}$/.test(raw.contentHash)) return null;
  if (!iso(raw.startedAt)) return null;
  return {
    version: SOCIAL_PUBLICATION_RECEIPT_VERSION,
    attemptId: raw.attemptId,
    jobId: typeof raw.jobId === "string" ? raw.jobId : null,
    state: raw.state as PublicationState,
    provider: "meta",
    platform: "facebook",
    targetExternalId: raw.targetExternalId,
    contentHash: raw.contentHash,
    startedAt: raw.startedAt,
    confirmedAt: iso(raw.confirmedAt) ? raw.confirmedAt : null,
    remotePostId: typeof raw.remotePostId === "string" && raw.remotePostId ? raw.remotePostId : null,
    permalinkUrl: typeof raw.permalinkUrl === "string" && raw.permalinkUrl ? raw.permalinkUrl : null,
    errorCategory: CATEGORIES.includes(raw.errorCategory as PublicationErrorCategory)
      ? (raw.errorCategory as PublicationErrorCategory)
      : null,
    errorMessage: typeof raw.errorMessage === "string" ? raw.errorMessage.slice(0, 500) : null,
    attempts: typeof raw.attempts === "number" && Number.isInteger(raw.attempts) && raw.attempts >= 0 ? raw.attempts : 0,
  };
}

/** Merge a receipt into existing post metadata without dropping other keys. */
export function withPublicationReceipt(
  metadata: unknown,
  receipt: PublicationReceipt,
): Record<string, unknown> {
  return { ...record(metadata), publication: { ...receipt } };
}

export type PublicationReadiness =
  | { ok: true; receipt: PublicationReceipt | null }
  | { ok: false; reason: PublicationBlockReason };

export type PublicationBlockReason =
  | "already_published"
  | "not_scheduled"
  | "blocked_by_plan"
  | "approval_missing"
  | "approval_not_approved"
  | "no_account"
  | "unsupported_platform"
  | "empty_caption"
  | "caption_too_long"
  | "publication_in_flight"
  | "needs_reconnect";

/**
 * Decide whether a post may be dispatched to the provider right now.
 * Pure: the worker re-reads the row under a lease and calls this again.
 */
export function assessPublicationReadiness(input: {
  post: SocialPostLike;
  latestApprovalStatus: string | null;
  approvalsRequired: boolean;
  now: Date;
}): PublicationReadiness {
  const { post } = input;
  const receipt = readPublicationReceipt(post.metadata);
  if (post.status === "published" || receipt?.state === "confirmed") {
    return { ok: false, reason: "already_published" };
  }
  if (post.status === "blocked_by_plan") return { ok: false, reason: "blocked_by_plan" };
  if (post.status !== "scheduled") return { ok: false, reason: "not_scheduled" };
  if (post.platform !== "facebook") return { ok: false, reason: "unsupported_platform" };
  if (!post.socialAccountId) return { ok: false, reason: "no_account" };
  if (input.latestApprovalStatus && input.latestApprovalStatus !== "approved") {
    return { ok: false, reason: "approval_not_approved" };
  }
  if (input.approvalsRequired && input.latestApprovalStatus !== "approved") {
    return { ok: false, reason: "approval_missing" };
  }
  const caption = canonicalCaption(post.caption);
  if (!caption) return { ok: false, reason: "empty_caption" };
  if (caption.length > FACEBOOK_FEED_MESSAGE_LIMIT) return { ok: false, reason: "caption_too_long" };
  if (receipt?.state === "needs_reconnect") return { ok: false, reason: "needs_reconnect" };
  if (receipt?.state === "sending") {
    const started = Date.parse(receipt.startedAt);
    // A `sending` receipt younger than the lease belongs to a live attempt.
    if (input.now.getTime() - started < SOCIAL_PUBLICATION_LEASE_MS) {
      return { ok: false, reason: "publication_in_flight" };
    }
  }
  return { ok: true, receipt };
}

/** Whether an attempt must reconcile remote state before sending again. */
export function receiptNeedsReconciliation(receipt: PublicationReceipt | null): boolean {
  if (!receipt) return false;
  return receipt.state === "uncertain" || receipt.state === "sending";
}

export type ApprovalDecision = "approve" | "reject" | "request_changes";

export function parseApprovalDecision(value: unknown): ApprovalDecision | null {
  return value === "approve" || value === "reject" || value === "request_changes" ? value : null;
}

/** Map a reviewer decision onto Approval.status and SocialPost.status. */
export function applyApprovalDecision(input: {
  decision: ApprovalDecision;
  currentApprovalStatus: string;
  currentPostStatus: string;
  scheduledAt: Date | null;
}):
  | { ok: true; approvalStatus: "approved" | "rejected" | "changes_requested"; postStatus: "approved" | "scheduled" | "draft" }
  | { ok: false; reason: "approval_closed" | "post_not_reviewable" } {
  if (
    input.currentApprovalStatus === "cancelled" ||
    (input.currentApprovalStatus === "approved" && input.decision === "approve")
  ) {
    return { ok: false, reason: "approval_closed" };
  }
  if (
    input.currentPostStatus === "published" ||
    input.currentPostStatus === "scheduled" ||
    input.currentPostStatus === "blocked_by_plan"
  ) {
    return { ok: false, reason: "post_not_reviewable" };
  }
  if (input.decision === "approve") {
    return {
      ok: true,
      approvalStatus: "approved",
      postStatus: input.scheduledAt ? "scheduled" : "approved",
    };
  }
  if (input.decision === "reject") {
    return { ok: true, approvalStatus: "rejected", postStatus: "draft" };
  }
  return { ok: true, approvalStatus: "changes_requested", postStatus: "draft" };
}

export type ScheduleRequest =
  | { mode: "now" }
  | { mode: "schedule"; scheduledAt: Date };

/** Parse the publish request body; future dates only, at most one year ahead. */
export function parseScheduleRequest(body: unknown, now: Date): ScheduleRequest | null {
  const raw = record(body);
  if (raw.mode === "now") return { mode: "now" };
  if (raw.mode !== "schedule") return null;
  if (typeof raw.scheduledAt !== "string" || raw.scheduledAt.length > 64) return null;
  const at = Date.parse(raw.scheduledAt);
  if (!Number.isFinite(at)) return null;
  if (at < now.getTime() - 60_000) return null;
  if (at > now.getTime() + 366 * 24 * 60 * 60_000) return null;
  return { mode: "schedule", scheduledAt: new Date(at) };
}

/** Post states from which a publish/schedule request may start a job. */
export function canQueuePublication(input: {
  postStatus: string;
  latestApprovalStatus: string | null;
  approvalsRequired: boolean;
}): { ok: true } | { ok: false; reason: PublicationBlockReason } {
  if (input.postStatus === "published") return { ok: false, reason: "already_published" };
  if (input.postStatus === "blocked_by_plan") return { ok: false, reason: "blocked_by_plan" };
  if (input.latestApprovalStatus && input.latestApprovalStatus !== "approved") {
    return { ok: false, reason: "approval_not_approved" };
  }
  if (input.approvalsRequired && input.latestApprovalStatus !== "approved") {
    return { ok: false, reason: "approval_missing" };
  }
  if (input.postStatus !== "approved" && input.postStatus !== "scheduled" && input.postStatus !== "draft" && input.postStatus !== "failed") {
    return { ok: false, reason: "not_scheduled" };
  }
  return { ok: true };
}

/** Exponential backoff with deterministic jitter, capped at 15 minutes. */
export function publicationBackoffMs(attempts: number): number {
  const exp = Math.max(0, attempts - 1);
  const base = Math.min(15 * 60_000, 30_000 * 2 ** exp);
  const jitter = Math.floor(base * 0.1 * ((attempts % 3) - 1));
  return base + jitter;
}

export const PUBLICATION_STATE_LABELS: Record<PublicationState, { en: string; fr: string }> = {
  sending: { en: "Publishing…", fr: "Publication en cours…" },
  confirmed: { en: "Published (verified)", fr: "Publié (vérifié)" },
  failed: { en: "Publication failed", fr: "Échec de publication" },
  uncertain: { en: "Awaiting verification", fr: "En attente de vérification" },
  needs_reconnect: { en: "Reconnect the account", fr: "Reconnectez le compte" },
};

export const BLOCK_REASON_LABELS: Record<PublicationBlockReason, { en: string; fr: string }> = {
  already_published: { en: "This post is already published.", fr: "Cette publication est déjà publiée." },
  not_scheduled: { en: "This post is not scheduled.", fr: "Cette publication n'est pas planifiée." },
  blocked_by_plan: { en: "Your plan cannot publish this post yet.", fr: "Votre forfait ne permet pas encore cette publication." },
  approval_missing: { en: "An approval is required before publishing.", fr: "Une approbation est requise avant de publier." },
  approval_not_approved: { en: "The latest review did not approve this post.", fr: "La dernière révision n'a pas approuvé cette publication." },
  no_account: { en: "Choose a connected Facebook Page first.", fr: "Choisissez d'abord une Page Facebook connectée." },
  unsupported_platform: { en: "Only Facebook Pages can be published automatically for now.", fr: "Seules les Pages Facebook peuvent être publiées automatiquement pour l'instant." },
  empty_caption: { en: "The caption is empty.", fr: "La légende est vide." },
  caption_too_long: { en: "The caption is too long for Facebook.", fr: "La légende est trop longue pour Facebook." },
  publication_in_flight: { en: "A publication attempt is already running.", fr: "Une tentative de publication est déjà en cours." },
  needs_reconnect: { en: "Reconnect the Facebook Page with publishing access.", fr: "Reconnectez la Page Facebook avec l'accès de publication." },
};
