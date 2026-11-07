// Social publishing engine — durable queue and worker on the existing Job model.
//
// Job type `approve_post` with metadata.source = "social_publication_v1" is a
// publication delivery job for one SocialPost. Claims are atomic (lease
// columns), every provider attempt leaves a durable receipt on the post before
// the network call, ambiguous attempts are reconciled before any retry, and
// only a provider post id may mark the post `published`.

import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import { loadClientSocialEntitlementContext } from "@/lib/billing/social/entitlement-gates";
import { evaluateWorkspaceWriteAccess } from "@/lib/billing/social/entitlement-gates-policy";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { META_OAUTH_PERMISSION_PUBLISH } from "@/lib/social/providers/meta-pages";
import {
  buildSocialCredentialAad,
  decryptSocialTokenPayload,
  readMetaFacebookPageCredential,
} from "@/lib/social/security/social-crypto";
import {
  publishFacebookPagePost,
  reconcileFacebookPagePost,
  type FacebookPublishTransport,
} from "@/lib/social/publishing/facebook-page-publisher";
import {
  SOCIAL_PUBLICATION_JOB_SOURCE,
  SOCIAL_PUBLICATION_LEASE_MS,
  SOCIAL_PUBLICATION_MAX_ATTEMPTS,
  SOCIAL_PUBLICATION_RECEIPT_VERSION,
  SOCIAL_RECONCILE_LOOKBACK_MS,
  assessPublicationReadiness,
  canQueuePublication,
  publicationBackoffMs,
  publicationContentHash,
  readPublicationReceipt,
  receiptNeedsReconciliation,
  record,
  withPublicationReceipt,
  type PublicationBlockReason,
  type PublicationErrorCategory,
  type PublicationReceipt,
} from "@/lib/social/publishing/publication-model";

export type SocialPublicationJobMetadata = {
  source: typeof SOCIAL_PUBLICATION_JOB_SOURCE;
  version: 1;
  clientId: string;
  socialPostId: string;
  requestedByProfileId: string | null;
  requestedAt: string;
};

export function isSocialPublicationJobMetadata(value: unknown): value is SocialPublicationJobMetadata {
  const raw = record(value);
  return (
    raw.source === SOCIAL_PUBLICATION_JOB_SOURCE &&
    raw.version === 1 &&
    typeof raw.clientId === "string" &&
    typeof raw.socialPostId === "string" &&
    (raw.requestedByProfileId === null || typeof raw.requestedByProfileId === "string") &&
    typeof raw.requestedAt === "string"
  );
}

type ClaimedJob = {
  id: string;
  clientId: string;
  attempts: number;
  maxAttempts: number;
  leaseOwner: string;
  metadata: SocialPublicationJobMetadata;
};

/** Minimal database surface so tests can inject fakes. */
export type PublicationDb = {
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  $transaction: <T>(fn: (tx: PublicationDb) => Promise<T>) => Promise<T>;
  job: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
    findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
    findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
    updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
  jobLog: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> };
  socialPost: {
    findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
    updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
};

export type PublicationWorkerDependencies = {
  db?: PublicationDb;
  transport?: FacebookPublishTransport;
  now?: () => Date;
  /** Re-checks workspace write access at dispatch time. Default uses billing entitlements. */
  workspaceCanWrite?: (clientId: string) => Promise<{ allowed: true } | { allowed: false; message: string }>;
};

const now = () => new Date();

async function defaultWorkspaceCanWrite(
  clientId: string,
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  const prisma = getPrisma();
  if (!prisma) return { allowed: false, message: "Billing is temporarily unavailable." };
  const { lifecycle } = await loadClientSocialEntitlementContext(prisma, clientId);
  const write = evaluateWorkspaceWriteAccess(lifecycle.access);
  return write.allowed ? { allowed: true } : { allowed: false, message: write.message };
}

function resolveDb(dependencies: PublicationWorkerDependencies): PublicationDb {
  const db = dependencies.db ?? (getPrisma() as unknown as PublicationDb | null);
  if (!db) throw new ServiceError("unavailable", "Publishing is temporarily unavailable.");
  return db;
}

async function jobLog(db: PublicationDb, jobId: string, level: "info" | "warning" | "error", message: string, metadata?: Record<string, unknown>) {
  try {
    await db.jobLog.create({ data: { jobId, level, message: message.slice(0, 500), metadata: metadata ?? undefined } });
  } catch {
    // Logging never fails a publication.
  }
}

// ── Queueing ──────────────────────────────────────────

export type QueuePublicationResult =
  | { ok: true; jobId: string; replayed: boolean; scheduledFor: string }
  | { ok: false; reason: PublicationBlockReason | "not_found" | "unavailable" };

/**
 * Move a post to `scheduled` and create (or reuse) its delivery job. One
 * active job per post; replaying with the same post returns the existing job.
 */
export async function queueSocialPostPublication(
  input: {
    clientId: string;
    socialPostId: string;
    requestedByProfileId: string | null;
    scheduledFor: Date;
  },
  dependencies: PublicationWorkerDependencies = {},
): Promise<QueuePublicationResult> {
  const db = resolveDb(dependencies);
  const at = dependencies.now ?? now;
  return db.$transaction(async (tx) => {
    const post = await tx.socialPost.findFirst({
      where: { id: input.socialPostId, clientId: input.clientId },
      select: {
        id: true,
        status: true,
        platform: true,
        socialAccountId: true,
        approvals: { select: { status: true }, orderBy: { requestedAt: "desc" }, take: 1 },
      },
    });
    if (!post) return { ok: false, reason: "not_found" } as const;
    const approvals = Array.isArray(post.approvals) ? (post.approvals as Array<{ status: string }>) : [];
    const latestApprovalStatus = approvals[0]?.status ?? null;
    const decision = canQueuePublication({
      postStatus: String(post.status),
      latestApprovalStatus,
      approvalsRequired: latestApprovalStatus !== null,
    });
    if (!decision.ok) return { ok: false, reason: decision.reason } as const;
    if (post.platform !== "facebook") return { ok: false, reason: "unsupported_platform" } as const;
    if (!post.socialAccountId) return { ok: false, reason: "no_account" } as const;

    const existing = await tx.job.findFirst({
      where: {
        clientId: input.clientId,
        type: "approve_post",
        status: { in: ["queued", "running", "retrying"] },
        metadata: { path: ["socialPostId"], equals: input.socialPostId },
      },
      select: { id: true, scheduledFor: true },
    });
    if (existing) {
      const scheduledFor = existing.scheduledFor instanceof Date ? existing.scheduledFor : input.scheduledFor;
      // Keep the latest requested time for an unstarted job.
      await tx.job.updateMany({
        where: { id: existing.id, clientId: input.clientId, status: "queued" },
        data: { scheduledFor: input.scheduledFor },
      });
      await tx.socialPost.updateMany({
        where: { id: post.id, clientId: input.clientId, status: { in: ["approved", "scheduled", "draft", "failed"] } },
        data: { status: "scheduled", scheduledAt: input.scheduledFor },
      });
      return { ok: true, jobId: String(existing.id), replayed: true, scheduledFor: scheduledFor.toISOString() } as const;
    }

    const moved = await tx.socialPost.updateMany({
      where: { id: post.id, clientId: input.clientId, status: post.status },
      data: { status: "scheduled", scheduledAt: input.scheduledFor },
    });
    if (moved.count !== 1) return { ok: false, reason: "publication_in_flight" } as const;

    const metadata: SocialPublicationJobMetadata = {
      source: SOCIAL_PUBLICATION_JOB_SOURCE,
      version: 1,
      clientId: input.clientId,
      socialPostId: post.id as string,
      requestedByProfileId: input.requestedByProfileId,
      requestedAt: at().toISOString(),
    };
    const job = await tx.job.create({
      data: {
        clientId: input.clientId,
        type: "approve_post",
        status: "queued",
        provider: "meta",
        attempts: 0,
        maxAttempts: SOCIAL_PUBLICATION_MAX_ATTEMPTS,
        scheduledFor: input.scheduledFor,
        metadata: metadata as unknown as Prisma.InputJsonObject,
      },
    });
    await jobLog(tx, job.id, "info", "Publication queued.", { socialPostId: post.id, scheduledFor: input.scheduledFor.toISOString() });
    return { ok: true, jobId: job.id, replayed: false, scheduledFor: input.scheduledFor.toISOString() } as const;
  });
}

/** Cancel a queued (not yet running) publication and return the post to `approved`. */
export async function cancelSocialPostPublication(
  input: { clientId: string; socialPostId: string },
  dependencies: PublicationWorkerDependencies = {},
): Promise<{ ok: true; cancelled: number } | { ok: false; reason: "running" | "not_found" }> {
  const db = resolveDb(dependencies);
  return db.$transaction(async (tx) => {
    const running = await tx.job.findFirst({
      where: {
        clientId: input.clientId,
        type: "approve_post",
        status: "running",
        metadata: { path: ["socialPostId"], equals: input.socialPostId },
      },
      select: { id: true },
    });
    if (running) return { ok: false, reason: "running" } as const;
    const cancelled = await tx.job.updateMany({
      where: {
        clientId: input.clientId,
        type: "approve_post",
        status: { in: ["queued", "retrying"] },
        metadata: { path: ["socialPostId"], equals: input.socialPostId },
      },
      data: { status: "cancelled", leaseOwner: null, leaseExpiresAt: null, completedAt: now() },
    });
    const post = await tx.socialPost.updateMany({
      where: { id: input.socialPostId, clientId: input.clientId, status: "scheduled" },
      data: { status: "approved" },
    });
    if (cancelled.count === 0 && post.count === 0) return { ok: false, reason: "not_found" } as const;
    return { ok: true, cancelled: cancelled.count } as const;
  });
}

// ── Claiming ──────────────────────────────────────────

/** Atomically lease one due publication job (or a specific job id). */
export async function claimSocialPublicationJob(
  options: { jobId?: string; leaseOwner?: string; leaseMs?: number },
  dependencies: PublicationWorkerDependencies = {},
): Promise<ClaimedJob | null> {
  const db = resolveDb(dependencies);
  const leaseOwner = options.leaseOwner ?? randomUUID();
  const at = (dependencies.now ?? now)();
  const leaseExpiresAt = new Date(at.getTime() + (options.leaseMs ?? SOCIAL_PUBLICATION_LEASE_MS));
  const jobFilter = options.jobId ?? null;

  const rows = await db.$queryRaw<
    Array<{ id: string; clientId: string | null; attempts: number; maxAttempts: number; leaseOwner: string | null; metadata: unknown }>
  >`
    UPDATE jobs
    SET
      status = 'running',
      "leaseOwner" = ${leaseOwner}::uuid,
      "leaseExpiresAt" = ${leaseExpiresAt},
      attempts = attempts + 1,
      "startedAt" = COALESCE("startedAt", ${at}),
      "updatedAt" = ${at},
      "errorMessage" = NULL
    WHERE id = (
      SELECT id FROM jobs
      WHERE type = 'approve_post'
        AND metadata->>'source' = ${SOCIAL_PUBLICATION_JOB_SOURCE}
        AND (${jobFilter}::uuid IS NULL OR id = ${jobFilter}::uuid)
        AND attempts < "maxAttempts"
        AND (
          (status IN ('queued', 'retrying') AND ("scheduledFor" IS NULL OR "scheduledFor" <= ${at}))
          OR (status = 'running' AND "leaseExpiresAt" IS NOT NULL AND "leaseExpiresAt" < ${at})
        )
      ORDER BY "scheduledFor" ASC NULLS FIRST, "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, "clientId", attempts, "maxAttempts", "leaseOwner", metadata
  `;
  const row = rows[0];
  if (!row?.clientId || !row.leaseOwner || !isSocialPublicationJobMetadata(row.metadata)) return null;
  if (row.metadata.clientId !== row.clientId) return null;
  return {
    id: row.id,
    clientId: row.clientId,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    leaseOwner: row.leaseOwner,
    metadata: row.metadata,
  };
}

type Finalize =
  | { outcome: "completed" }
  | { outcome: "failed"; error: string }
  | { outcome: "retrying"; error: string; delayMs: number };

async function finalizeJob(db: PublicationDb, job: ClaimedJob, finalize: Finalize, at: Date): Promise<boolean> {
  const exhausted = finalize.outcome === "retrying" && job.attempts >= job.maxAttempts;
  const data =
    finalize.outcome === "completed"
      ? { status: "completed", completedAt: at, leaseOwner: null, leaseExpiresAt: null, errorMessage: null }
      : finalize.outcome === "failed" || exhausted
        ? { status: "failed", completedAt: at, leaseOwner: null, leaseExpiresAt: null, errorMessage: finalize.error.slice(0, 500) }
        : {
            status: "retrying",
            leaseOwner: null,
            leaseExpiresAt: null,
            scheduledFor: new Date(at.getTime() + finalize.delayMs),
            errorMessage: finalize.error.slice(0, 500),
          };
  const result = await db.job.updateMany({
    where: { id: job.id, leaseOwner: job.leaseOwner, status: "running" },
    data,
  });
  return result.count === 1;
}

// ── Processing ────────────────────────────────────────

export type ProcessOutcome =
  | { outcome: "published"; socialPostId: string; remotePostId: string; replayed: boolean }
  | { outcome: "blocked"; socialPostId: string; reason: PublicationBlockReason | "not_found" | "workspace_locked" }
  | { outcome: "failed"; socialPostId: string; category: PublicationErrorCategory; retryable: boolean }
  | { outcome: "uncertain"; socialPostId: string }
  | { outcome: "contended"; socialPostId: string };

type LoadedPost = {
  id: string;
  clientId: string;
  status: string;
  caption: string;
  platform: string;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  socialAccountId: string | null;
  mediaUrls: unknown;
  metadata: unknown;
  approvals: Array<{ status: string }>;
  socialAccount: {
    id: string;
    platform: string;
    status: string;
    accountType: string | null;
    externalAccountId: string | null;
    metadata: unknown;
    providerConnection: {
      id: string;
      clientId: string;
      provider: string;
      status: string;
      scopes: string[];
      credential: { status: string; encryptedPayload: string; iv: string; authTag: string; keyVersion: number } | null;
    } | null;
  } | null;
};

async function loadPost(db: PublicationDb, clientId: string, socialPostId: string): Promise<LoadedPost | null> {
  const row = await db.socialPost.findFirst({
    where: { id: socialPostId, clientId },
    select: {
      id: true,
      clientId: true,
      status: true,
      caption: true,
      platform: true,
      scheduledAt: true,
      publishedAt: true,
      socialAccountId: true,
      mediaUrls: true,
      metadata: true,
      approvals: { select: { status: true }, orderBy: { requestedAt: "desc" }, take: 1 },
      socialAccount: {
        select: {
          id: true,
          platform: true,
          status: true,
          accountType: true,
          externalAccountId: true,
          metadata: true,
          providerConnection: {
            select: {
              id: true,
              clientId: true,
              provider: true,
              status: true,
              scopes: true,
              credential: { select: { status: true, encryptedPayload: true, iv: true, authTag: true, keyVersion: true } },
            },
          },
        },
      },
    },
  });
  return (row as LoadedPost | null) ?? null;
}

function readMediaUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && /^https:\/\//.test(item)).slice(0, 1);
}

function readLink(metadata: unknown): string | null {
  const link = record(metadata).link;
  return typeof link === "string" && /^https:\/\//.test(link) ? link.slice(0, 2000) : null;
}

/** Resolve the Page credential for a connected, selected Facebook Page. */
function resolvePageCredential(post: LoadedPost): { ok: true; pageId: string; accessToken: string } | { ok: false; message: string } {
  const account = post.socialAccount;
  if (!account || account.platform !== "facebook" || account.accountType !== "facebook_page" || account.status !== "connected") {
    return { ok: false, message: "The Facebook Page is not connected." };
  }
  const connection = account.providerConnection;
  if (!connection || connection.provider !== "meta" || connection.status !== "connected" || !connection.credential || connection.credential.status !== "active") {
    return { ok: false, message: "Facebook authorization is missing. Reconnect to continue." };
  }
  if (connection.clientId !== post.clientId) {
    return { ok: false, message: "The connection does not belong to this workspace." };
  }
  if (!connection.scopes.includes(META_OAUTH_PERMISSION_PUBLISH)) {
    return { ok: false, message: "Publishing permission (pages_manage_posts) was not granted. Reconnect with publishing access." };
  }
  if (record(account.metadata).canPublish === false) {
    return { ok: false, message: "This Page does not allow TAKATAK to create content. Reconnect with publishing access." };
  }
  let payload;
  try {
    payload = decryptSocialTokenPayload(
      {
        ciphertext: connection.credential.encryptedPayload,
        iv: connection.credential.iv,
        authTag: connection.credential.authTag,
        keyVersion: connection.credential.keyVersion,
      },
      buildSocialCredentialAad({ clientId: connection.clientId, connectionId: connection.id, provider: connection.provider }),
    );
  } catch {
    return { ok: false, message: "Facebook credentials could not be read. Reconnect to continue." };
  }
  const page = readMetaFacebookPageCredential(payload);
  if (!page || !account.externalAccountId || page.pageId !== account.externalAccountId) {
    return { ok: false, message: "The Page credential is missing. Select the Page again." };
  }
  return { ok: true, pageId: page.pageId, accessToken: page.accessToken };
}

async function writeReceipt(db: PublicationDb, post: { id: string; clientId: string; status: string; metadata: unknown }, receipt: PublicationReceipt, postData: Record<string, unknown>): Promise<boolean> {
  const result = await db.socialPost.updateMany({
    where: {
      id: post.id,
      clientId: post.clientId,
      status: post.status,
      ...(post.metadata === null || post.metadata === undefined
        ? { metadata: { equals: Prisma.JsonNull } }
        : { metadata: { equals: post.metadata as Prisma.InputJsonValue } }),
    },
    data: { ...postData, metadata: withPublicationReceipt(post.metadata, receipt) as Prisma.InputJsonObject },
  });
  return result.count === 1;
}

/**
 * Process one claimed job: re-verify everything under the lease, write a
 * `sending` receipt, call Meta, and persist the outcome. Never throws for
 * provider failures; database failures propagate so the lease expires.
 */
export async function processSocialPublicationJob(
  job: ClaimedJob,
  dependencies: PublicationWorkerDependencies = {},
): Promise<ProcessOutcome> {
  const db = resolveDb(dependencies);
  const at = dependencies.now ?? now;
  const transport = dependencies.transport;
  const canWrite = dependencies.workspaceCanWrite ?? defaultWorkspaceCanWrite;
  const socialPostId = job.metadata.socialPostId;

  const post = await loadPost(db, job.clientId, socialPostId);
  if (!post) {
    await finalizeJob(db, job, { outcome: "failed", error: "post_not_found" }, at());
    return { outcome: "blocked", socialPostId, reason: "not_found" };
  }

  const latestApprovalStatus = post.approvals[0]?.status ?? null;
  const readiness = assessPublicationReadiness({
    post,
    latestApprovalStatus,
    approvalsRequired: latestApprovalStatus !== null,
    now: at(),
  });
  if (!readiness.ok) {
    if (readiness.reason === "already_published") {
      const receipt = readPublicationReceipt(post.metadata);
      await finalizeJob(db, job, { outcome: "completed" }, at());
      return { outcome: "published", socialPostId, remotePostId: receipt?.remotePostId ?? "", replayed: true };
    }
    if (readiness.reason === "publication_in_flight") {
      await finalizeJob(db, job, { outcome: "retrying", error: "publication_in_flight", delayMs: SOCIAL_PUBLICATION_LEASE_MS }, at());
      return { outcome: "contended", socialPostId };
    }
    await jobLog(db, job.id, "warning", `Publication blocked: ${readiness.reason}`);
    await finalizeJob(db, job, { outcome: "failed", error: readiness.reason }, at());
    return { outcome: "blocked", socialPostId, reason: readiness.reason };
  }

  const write = await canWrite(post.clientId);
  if (!write.allowed) {
    await jobLog(db, job.id, "warning", "Workspace cannot publish: " + write.message);
    await finalizeJob(db, job, { outcome: "failed", error: "workspace_locked" }, at());
    return { outcome: "blocked", socialPostId, reason: "workspace_locked" };
  }

  const credential = resolvePageCredential(post);
  const link = readLink(post.metadata);
  const mediaUrls = readMediaUrls(post.mediaUrls);
  const contentHash = publicationContentHash({ caption: post.caption, link, mediaUrls });
  const targetExternalId = post.socialAccount?.externalAccountId ?? "";
  const previous = readiness.receipt;

  if (!credential.ok) {
    const receipt: PublicationReceipt = {
      version: SOCIAL_PUBLICATION_RECEIPT_VERSION,
      attemptId: previous?.attemptId ?? randomUUID(),
      jobId: job.id,
      state: "needs_reconnect",
      provider: "meta",
      platform: "facebook",
      targetExternalId,
      contentHash,
      startedAt: at().toISOString(),
      confirmedAt: null,
      remotePostId: null,
      permalinkUrl: null,
      errorCategory: "authorization_expired",
      errorMessage: credential.message,
      attempts: previous?.attempts ?? 0,
    };
    await writeReceipt(db, post, receipt, { status: "failed" });
    await jobLog(db, job.id, "error", credential.message);
    await finalizeJob(db, job, { outcome: "failed", error: "needs_reconnect" }, at());
    return { outcome: "blocked", socialPostId, reason: "needs_reconnect" };
  }

  // Reconcile an ambiguous earlier attempt before sending anything new.
  if (previous && receiptNeedsReconciliation(previous) && previous.contentHash === contentHash) {
    const since = new Date(Date.parse(previous.startedAt) - SOCIAL_RECONCILE_LOOKBACK_MS);
    const found = await reconcileFacebookPagePost(
      { pageId: credential.pageId, pageAccessToken: credential.accessToken, message: post.caption, since },
      transport,
    );
    if (found.found === true) {
      const receipt: PublicationReceipt = {
        ...previous,
        jobId: job.id,
        state: "confirmed",
        confirmedAt: at().toISOString(),
        remotePostId: found.remotePostId,
        permalinkUrl: found.permalinkUrl,
        errorCategory: null,
        errorMessage: null,
      };
      await writeReceipt(db, post, receipt, { status: "published", publishedAt: new Date(found.createdAt) });
      await jobLog(db, job.id, "info", "Reconciled: the earlier attempt was published.", { remotePostId: found.remotePostId });
      await finalizeJob(db, job, { outcome: "completed" }, at());
      return { outcome: "published", socialPostId, remotePostId: found.remotePostId, replayed: true };
    }
    if (found.found === "unknown") {
      const receipt: PublicationReceipt = { ...previous, jobId: job.id, state: "uncertain", errorCategory: found.category, errorMessage: found.message };
      await writeReceipt(db, post, receipt, {});
      await jobLog(db, job.id, "warning", "Reconciliation unavailable: " + found.message);
      await finalizeJob(db, job, { outcome: "retrying", error: "reconcile_" + found.category, delayMs: publicationBackoffMs(job.attempts) }, at());
      return { outcome: "uncertain", socialPostId };
    }
    // Not found: the earlier attempt never landed; a fresh attempt is safe.
  }

  const attemptId = randomUUID();
  const sending: PublicationReceipt = {
    version: SOCIAL_PUBLICATION_RECEIPT_VERSION,
    attemptId,
    jobId: job.id,
    state: "sending",
    provider: "meta",
    platform: "facebook",
    targetExternalId,
    contentHash,
    startedAt: at().toISOString(),
    confirmedAt: null,
    remotePostId: null,
    permalinkUrl: null,
    errorCategory: null,
    errorMessage: null,
    attempts: (previous?.attempts ?? 0) + 1,
  };
  const leased = await writeReceipt(db, post, sending, {});
  if (!leased) {
    await finalizeJob(db, job, { outcome: "retrying", error: "post_changed", delayMs: SOCIAL_PUBLICATION_LEASE_MS }, at());
    return { outcome: "contended", socialPostId };
  }
  const leasedPost = { ...post, metadata: withPublicationReceipt(post.metadata, sending) };

  const result = await publishFacebookPagePost(
    { pageId: credential.pageId, pageAccessToken: credential.accessToken, message: post.caption, link, photoUrl: mediaUrls[0] ?? null },
    transport,
  );

  if (result.ok) {
    const receipt: PublicationReceipt = {
      ...sending,
      state: "confirmed",
      confirmedAt: at().toISOString(),
      remotePostId: result.remotePostId,
      permalinkUrl: result.permalinkUrl,
    };
    await writeReceipt(db, leasedPost, receipt, { status: "published", publishedAt: at() });
    await jobLog(db, job.id, "info", "Published on Facebook.", { remotePostId: result.remotePostId, verified: result.verified });
    logSocialOAuthEvent("social-publish", { stage: "facebook_feed", outcome: "ok", provider: "meta", writeCreated: 1 });
    await finalizeJob(db, job, { outcome: "completed" }, at());
    return { outcome: "published", socialPostId, remotePostId: result.remotePostId, replayed: false };
  }

  if (result.ambiguous) {
    const receipt: PublicationReceipt = { ...sending, state: "uncertain", errorCategory: result.category, errorMessage: result.message };
    await writeReceipt(db, leasedPost, receipt, {});
    await jobLog(db, job.id, "warning", "Ambiguous attempt; will reconcile before retrying.", { category: result.category });
    await finalizeJob(db, job, { outcome: "retrying", error: "uncertain_" + result.category, delayMs: publicationBackoffMs(job.attempts) }, at());
    return { outcome: "uncertain", socialPostId };
  }

  const receipt: PublicationReceipt = { ...sending, state: "failed", errorCategory: result.category, errorMessage: result.message };
  const retry = result.retryable && job.attempts < job.maxAttempts;
  await writeReceipt(db, leasedPost, receipt, retry ? {} : { status: "failed" });
  await jobLog(db, job.id, retry ? "warning" : "error", `Facebook refused the post (${result.category}).`);
  logSocialOAuthEvent("social-publish", { stage: "facebook_feed", outcome: "error", provider: "meta", malformedCount: 1 });
  await finalizeJob(
    db,
    job,
    retry
      ? { outcome: "retrying", error: result.category, delayMs: publicationBackoffMs(job.attempts) }
      : { outcome: "failed", error: result.category },
    at(),
  );
  return { outcome: "failed", socialPostId, category: result.category, retryable: retry };
}

// ── Worker tick ───────────────────────────────────────

/** Mark exhausted expired leases failed; others are reclaimed by the claim query. */
export async function releaseExpiredSocialPublicationLeases(
  dependencies: PublicationWorkerDependencies = {},
  limit = 25,
): Promise<{ failed: number }> {
  const db = resolveDb(dependencies);
  const at = (dependencies.now ?? now)();
  const expired = await db.job.findMany({
    where: {
      type: "approve_post",
      status: "running",
      leaseExpiresAt: { lt: at },
      metadata: { path: ["source"], equals: SOCIAL_PUBLICATION_JOB_SOURCE },
    },
    select: { id: true, attempts: true, maxAttempts: true, leaseOwner: true },
    take: limit,
  });
  let failed = 0;
  for (const job of expired) {
    if (Number(job.attempts) < Number(job.maxAttempts)) continue;
    const result = await db.job.updateMany({
      where: { id: job.id, status: "running", leaseOwner: job.leaseOwner },
      data: { status: "failed", leaseOwner: null, leaseExpiresAt: null, completedAt: at, errorMessage: "lease_expired_attempts_exhausted" },
    });
    failed += result.count;
  }
  return { failed };
}

export async function runSocialPublicationWorkerTick(
  options: { limit?: number; jobId?: string } = {},
  dependencies: PublicationWorkerDependencies = {},
): Promise<{ claimed: number; published: number; failed: number; uncertain: number; blocked: number; outcomes: ProcessOutcome[] }> {
  const summary = { claimed: 0, published: 0, failed: 0, uncertain: 0, blocked: 0, outcomes: [] as ProcessOutcome[] };
  let db: PublicationDb;
  try {
    db = resolveDb(dependencies);
  } catch {
    return summary;
  }
  const released = await releaseExpiredSocialPublicationLeases({ ...dependencies, db });
  summary.failed += released.failed;
  const limit = options.jobId ? 1 : Math.max(1, Math.min(options.limit ?? 5, 25));
  for (let index = 0; index < limit; index += 1) {
    const job = await claimSocialPublicationJob({ jobId: options.jobId }, { ...dependencies, db });
    if (!job) break;
    summary.claimed += 1;
    const outcome = await processSocialPublicationJob(job, { ...dependencies, db });
    summary.outcomes.push(outcome);
    if (outcome.outcome === "published") summary.published += 1;
    else if (outcome.outcome === "failed") summary.failed += 1;
    else if (outcome.outcome === "uncertain") summary.uncertain += 1;
    else if (outcome.outcome === "blocked") summary.blocked += 1;
  }
  return summary;
}
