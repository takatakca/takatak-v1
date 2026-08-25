import "server-only";

import { randomUUID } from "node:crypto";

import { after } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import {
  runSocialDbTransaction,
  SOCIAL_DB_TRANSACTION_TIMEOUT_MS,
  SOCIAL_SYNC_STALE_CLAIM_MS,
} from "@/lib/social/connections/social-db-transaction";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import {
  runInitialFacebookPageSync,
  type FacebookPageSyncSnapshot,
} from "@/lib/social/sync/facebook-page-initial-sync";
import type { MetaInsightsTransport } from "@/lib/social/providers/meta-insights";

export const FACEBOOK_PAGE_SYNC_JOB_KIND =
  "facebook_page_initial_sync" as const;

/** Lease duration while a worker owns a running job. */
export const FACEBOOK_SYNC_JOB_LEASE_MS = 2 * 60 * 1000;
/** Base delay for exponential backoff (attempt 1 → 5s). */
export const FACEBOOK_SYNC_BACKOFF_BASE_MS = 5_000;
/** Cap for exponential backoff. */
export const FACEBOOK_SYNC_BACKOFF_MAX_MS = 5 * 60 * 1000;
/** Default max attempts when creating jobs. */
export const FACEBOOK_SYNC_MAX_ATTEMPTS = 5;

export type FacebookSyncJobMetadata = {
  kind: typeof FACEBOOK_PAGE_SYNC_JOB_KIND;
  connectionId: string;
  socialAccountId: string;
  generation: number;
  profileId: string;
  resume: boolean;
  /** initial = first recent window; incremental = watermark+overlap; backfill = older window. */
  mode?: "initial" | "incremental" | "backfill";
  rangeSince?: string;
  rangeUntil?: string;
};

type ClaimedJob = {
  id: string;
  clientId: string;
  businessBrandId: string | null;
  attempts: number;
  maxAttempts: number;
  leaseOwner: string;
  metadata: FacebookSyncJobMetadata;
};

function isFacebookSyncJobMetadata(
  value: unknown,
): value is FacebookSyncJobMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.kind === FACEBOOK_PAGE_SYNC_JOB_KIND &&
    typeof record.connectionId === "string" &&
    typeof record.socialAccountId === "string" &&
    typeof record.generation === "number" &&
    typeof record.profileId === "string" &&
    typeof record.resume === "boolean"
  );
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function computeFacebookSyncBackoffMs(attempts: number): number {
  const exp = Math.max(0, attempts - 1);
  const raw = FACEBOOK_SYNC_BACKOFF_BASE_MS * 2 ** exp;
  const capped = Math.min(raw, FACEBOOK_SYNC_BACKOFF_MAX_MS);
  // Deterministic jitter band (±10%) without Math.random in tests.
  const jitter = Math.floor(capped * 0.1 * ((attempts % 3) - 1));
  return Math.min(
    FACEBOOK_SYNC_BACKOFF_MAX_MS,
    Math.max(FACEBOOK_SYNC_BACKOFF_BASE_MS, capped + jitter),
  );
}

/**
 * Optional immediate dispatch after the HTTP response.
 * Not the delivery guarantee — cron / `npm run worker:social-sync` is.
 *
 * Important: must be invoked while a Next.js request is still active.
 * Detached `void enqueue()` after the response has been sent will not run
 * the after() callback reliably.
 */
export function scheduleFacebookPageSyncJob(jobId: string): void {
  try {
    after(async () => {
      try {
        logSocialOAuthEvent("facebook-page-sync", {
          stage: "worker",
          outcome: "leased_attempt",
          provider: "meta",
        });
        const snapshot = await processFacebookPageSyncJob(jobId);
        logSocialOAuthEvent("facebook-page-sync", {
          stage: "worker",
          outcome: snapshot?.status ?? "lease_miss",
          provider: "meta",
          mode: snapshot ? "after_dispatch" : "after_no_claim",
        });
      } catch {
        logSocialOAuthEvent("facebook-page-sync", {
          stage: "worker",
          outcome: "failed",
          provider: "meta",
          mode: "after_dispatch",
        });
      }
    });
    logSocialOAuthEvent("facebook-page-sync", {
      stage: "dispatch",
      outcome: "after_optimization",
      provider: "meta",
    });
  } catch {
    logSocialOAuthEvent("facebook-page-sync", {
      stage: "dispatch",
      outcome: "cron_only",
      provider: "meta",
    });
  }
}

/**
 * Atomically claim sync state + create the durable Job in one short TX.
 * Either both persist or neither does (no orphan syncing / orphan job).
 */
export async function claimAndEnqueueFacebookPageSync(options: {
  clientId: string;
  businessBrandId: string;
  connectionId: string;
  socialAccountId: string;
  profileId: string;
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
  resumeCursor: string | null;
  resume?: boolean;
  mode?: "initial" | "incremental" | "backfill";
  scheduleImmediate?: boolean;
}): Promise<{
  claimed: boolean;
  generation: number;
  jobId: string | null;
  cursor: string | null;
}> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  const started = Date.now();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - SOCIAL_SYNC_STALE_CLAIM_MS);

  // Ensure row exists outside the claim TX (idempotent).
  await prisma.socialAccountSyncState.createMany({
    data: [
      {
        clientId: options.clientId,
        businessBrandId: options.businessBrandId,
        socialAccountId: options.socialAccountId,
        providerConnectionId: options.connectionId,
        status: "idle",
        retryCount: 0,
        syncGeneration: 0,
        rangeStart: parseDateOnly(options.rangeStart),
        rangeEnd: parseDateOnly(options.rangeEnd),
        timezone: options.timezone,
      },
    ],
    skipDuplicates: true,
  });

  try {
    const result = await runSocialDbTransaction(
      "facebook-page-sync-outbox",
      async (transaction) => {
        const claimed = await transaction.socialAccountSyncState.updateMany({
          where: {
            clientId: options.clientId,
            socialAccountId: options.socialAccountId,
            OR: [
              { status: { not: "syncing" } },
              { lastAttemptAt: null },
              { lastAttemptAt: { lt: staleBefore } },
            ],
          },
          data: {
            status: "syncing",
            lastAttemptAt: now,
            lastErrorCategory: null,
            lastErrorMessage: null,
            retryCount: { increment: 1 },
            syncGeneration: { increment: 1 },
            rangeStart: parseDateOnly(options.rangeStart),
            rangeEnd: parseDateOnly(options.rangeEnd),
            timezone: options.timezone,
            syncCursor: options.resumeCursor,
            partialData: false,
            providerConnectionId: options.connectionId,
            businessBrandId: options.businessBrandId,
            dispatchJobId: null,
          },
        });

        const row = await transaction.socialAccountSyncState.findUnique({
          where: { socialAccountId: options.socialAccountId },
          select: {
            syncGeneration: true,
            syncCursor: true,
            clientId: true,
            dispatchJobId: true,
            status: true,
          },
        });

        if (!row || row.clientId !== options.clientId) {
          throw new ServiceError(
            "forbidden",
            "You do not have access to this sync state.",
          );
        }

        if (claimed.count !== 1) {
          return {
            claimed: false as const,
            generation: row.syncGeneration,
            jobId: row.dispatchJobId,
            cursor: row.syncCursor,
          };
        }

        const metadata: FacebookSyncJobMetadata = {
          kind: FACEBOOK_PAGE_SYNC_JOB_KIND,
          connectionId: options.connectionId,
          socialAccountId: options.socialAccountId,
          generation: row.syncGeneration,
          profileId: options.profileId,
          resume: options.resume === true,
          mode: options.mode ?? "initial",
          rangeSince: options.rangeStart,
          rangeUntil: options.rangeEnd,
        };

        const job = await transaction.job.create({
          data: {
            clientId: options.clientId,
            businessBrandId: options.businessBrandId,
            type: "sync_analytics",
            status: "queued",
            provider: "internal",
            attempts: 0,
            maxAttempts: FACEBOOK_SYNC_MAX_ATTEMPTS,
            scheduledFor: now,
            metadata,
          },
          select: { id: true },
        });

        await transaction.socialAccountSyncState.updateMany({
          where: {
            clientId: options.clientId,
            socialAccountId: options.socialAccountId,
            syncGeneration: row.syncGeneration,
          },
          data: { dispatchJobId: job.id },
        });

        return {
          claimed: true as const,
          generation: row.syncGeneration,
          jobId: job.id,
          cursor: options.resumeCursor ?? row.syncCursor,
        };
      },
      {
        maxWaitMs: SOCIAL_DB_TRANSACTION_TIMEOUT_MS,
        timeoutMs: SOCIAL_DB_TRANSACTION_TIMEOUT_MS,
      },
    );

    logSocialOAuthEvent("facebook-page-sync-mark", {
      stage: "outbox_claim",
      outcome: result.claimed ? "claimed" : "already_running",
      provider: "meta",
      msTotal: Date.now() - started,
    });

    if (result.claimed && result.jobId) {
      logSocialOAuthEvent("facebook-page-sync", {
        stage: "worker",
        outcome: "queued",
        provider: "meta",
        msTotal: Date.now() - started,
      });
    }

    return result;
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }

    logSocialOAuthEvent("facebook-page-sync-mark", {
      stage: "outbox_claim",
      outcome: "timeout",
      provider: "meta",
      msTotal: Date.now() - started,
    });

    throw new ServiceError(
      "unavailable",
      "Facebook Page sync could not be started. You can retry.",
      { status: 503 },
    );
  }
}

/** @deprecated Prefer claimAndEnqueueFacebookPageSync for the outbox invariant. */
export async function enqueueDurableFacebookPageSyncJob(options: {
  clientId: string;
  businessBrandId: string;
  connectionId: string;
  socialAccountId: string;
  profileId: string;
  generation: number;
  resume?: boolean;
}): Promise<{ jobId: string; created: boolean }> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  const existing = await prisma.socialAccountSyncState.findUnique({
    where: { socialAccountId: options.socialAccountId },
    select: {
      syncGeneration: true,
      dispatchJobId: true,
    },
  });

  if (
    existing?.syncGeneration === options.generation &&
    existing.dispatchJobId
  ) {
    const job = await prisma.job.findFirst({
      where: {
        id: existing.dispatchJobId,
        clientId: options.clientId,
        type: "sync_analytics",
        status: { in: ["queued", "running", "retrying"] },
      },
      select: { id: true },
    });
    if (job) {
      return { jobId: job.id, created: false };
    }
  }

  const metadata: FacebookSyncJobMetadata = {
    kind: FACEBOOK_PAGE_SYNC_JOB_KIND,
    connectionId: options.connectionId,
    socialAccountId: options.socialAccountId,
    generation: options.generation,
    profileId: options.profileId,
    resume: options.resume === true,
  };

  const job = await prisma.job.create({
    data: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      type: "sync_analytics",
      status: "queued",
      provider: "internal",
      attempts: 0,
      maxAttempts: FACEBOOK_SYNC_MAX_ATTEMPTS,
      scheduledFor: new Date(),
      metadata,
    },
    select: { id: true },
  });

  await prisma.socialAccountSyncState.updateMany({
    where: {
      clientId: options.clientId,
      socialAccountId: options.socialAccountId,
      syncGeneration: options.generation,
    },
    data: { dispatchJobId: job.id },
  });

  return { jobId: job.id, created: true };
}

/**
 * Atomically claim a job lease. Only the returned leaseOwner may finalize.
 */
export async function claimFacebookPageSyncJobLease(
  jobId: string,
  options?: { leaseOwner?: string; leaseMs?: number },
): Promise<ClaimedJob | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  const leaseOwner = options?.leaseOwner ?? randomUUID();
  const leaseMs = options?.leaseMs ?? FACEBOOK_SYNC_JOB_LEASE_MS;
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      clientId: string | null;
      businessBrandId: string | null;
      attempts: number;
      maxAttempts: number;
      leaseOwner: string | null;
      metadata: unknown;
    }>
  >`
    UPDATE jobs
    SET
      status = 'running',
      "leaseOwner" = ${leaseOwner}::uuid,
      "leaseExpiresAt" = ${leaseExpiresAt},
      attempts = attempts + 1,
      "startedAt" = COALESCE("startedAt", ${now}),
      "updatedAt" = ${now},
      "errorMessage" = NULL
    WHERE id = ${jobId}::uuid
      AND type = 'sync_analytics'
      AND attempts < "maxAttempts"
      AND (
        (
          status IN ('queued', 'retrying')
          AND ("scheduledFor" IS NULL OR "scheduledFor" <= ${now})
        )
        OR (
          status = 'running'
          AND "leaseExpiresAt" IS NOT NULL
          AND "leaseExpiresAt" < ${now}
        )
      )
    RETURNING
      id,
      "clientId",
      "businessBrandId",
      attempts,
      "maxAttempts",
      "leaseOwner",
      metadata
  `;

  const row = rows[0];
  if (!row?.clientId || !row.leaseOwner || !isFacebookSyncJobMetadata(row.metadata)) {
    return null;
  }

  return {
    id: row.id,
    clientId: row.clientId,
    businessBrandId: row.businessBrandId,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    leaseOwner: row.leaseOwner,
    metadata: row.metadata,
  };
}

export async function extendFacebookPageSyncJobLease(options: {
  jobId: string;
  leaseOwner: string;
  leaseMs?: number;
}): Promise<boolean> {
  const prisma = getPrisma();
  if (!prisma) return false;

  const leaseExpiresAt = new Date(
    Date.now() + (options.leaseMs ?? FACEBOOK_SYNC_JOB_LEASE_MS),
  );

  const updated = await prisma.job.updateMany({
    where: {
      id: options.jobId,
      status: "running",
      leaseOwner: options.leaseOwner,
    },
    data: {
      leaseExpiresAt,
      updatedAt: new Date(),
    },
  });

  return updated.count === 1;
}

async function completeJobWithLease(options: {
  jobId: string;
  leaseOwner: string;
  status: "completed" | "failed" | "retrying";
  errorMessage?: string | null;
  scheduledFor?: Date | null;
}): Promise<boolean> {
  const prisma = getPrisma();
  if (!prisma) return false;

  const updated = await prisma.job.updateMany({
    where: {
      id: options.jobId,
      status: "running",
      leaseOwner: options.leaseOwner,
    },
    data: {
      status: options.status,
      completedAt:
        options.status === "retrying" ? null : new Date(),
      errorMessage: options.errorMessage ?? null,
      scheduledFor:
        options.status === "retrying"
          ? (options.scheduledFor ?? new Date())
          : undefined,
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    },
  });

  return updated.count === 1;
}

export async function processFacebookPageSyncJob(
  jobId: string,
  options?: {
    transport?: MetaInsightsTransport;
    leaseOwner?: string;
  },
): Promise<FacebookPageSyncSnapshot | null> {
  const claimed = await claimFacebookPageSyncJobLease(jobId, {
    leaseOwner: options?.leaseOwner,
  });

  if (!claimed) {
    return null;
  }

  return executeClaimedFacebookPageSyncJob(claimed, options);
}

async function executeClaimedFacebookPageSyncJob(
  claimed: ClaimedJob,
  options?: { transport?: MetaInsightsTransport },
): Promise<FacebookPageSyncSnapshot | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  const started = Date.now();
  const meta = claimed.metadata;

  // Stale generation: Page changed / newer sync claimed — abandon without writes.
  const live = await prisma.socialAccountSyncState.findFirst({
    where: {
      clientId: claimed.clientId,
      socialAccountId: meta.socialAccountId,
      syncGeneration: meta.generation,
      status: "syncing",
    },
    select: { id: true },
  });

  if (!live) {
    await completeJobWithLease({
      jobId: claimed.id,
      leaseOwner: claimed.leaseOwner,
      status: "completed",
      errorMessage: "Stale generation discarded.",
    });
    logSocialOAuthEvent("facebook-page-sync", {
      stage: "worker",
      outcome: "stale_discarded",
      provider: "meta",
      msTotal: Date.now() - started,
    });
    return null;
  }

  logSocialOAuthEvent("facebook-page-sync", {
    stage: "worker",
    outcome: "leased",
    provider: "meta",
    mode: `attempt_${claimed.attempts}`,
  });

  try {
    // Heartbeat once before Meta I/O.
    await extendFacebookPageSyncJobLease({
      jobId: claimed.id,
      leaseOwner: claimed.leaseOwner,
    });

    logSocialOAuthEvent("facebook-page-sync", {
      stage: "worker",
      outcome: "processing",
      provider: "meta",
    });

    const snapshot = await runInitialFacebookPageSync({
      clientId: claimed.clientId,
      profileId: meta.profileId,
      connectionId: meta.connectionId,
      socialAccountId: meta.socialAccountId,
      resume: meta.resume,
      claimedGeneration: meta.generation,
      claimedCursor: null,
      rangeSince: meta.rangeSince ?? null,
      rangeUntil: meta.rangeUntil ?? null,
      syncMode: meta.mode ?? "initial",
      transport: options?.transport,
      jobLease: {
        jobId: claimed.id,
        leaseOwner: claimed.leaseOwner,
      },
    });

    const finalized = await completeJobWithLease({
      jobId: claimed.id,
      leaseOwner: claimed.leaseOwner,
      status: "completed",
    });

    if (!finalized) {
      logSocialOAuthEvent("facebook-page-sync", {
        stage: "worker",
        outcome: "lease_lost_on_finalize",
        provider: "meta",
        msTotal: Date.now() - started,
      });
      return null;
    }

    // Drop the dispatch pointer so Ready snapshots do not keep showing
    // a stale "Job running" line after the worker finishes.
    await prisma.socialAccountSyncState.updateMany({
      where: {
        clientId: claimed.clientId,
        socialAccountId: meta.socialAccountId,
        dispatchJobId: claimed.id,
      },
      data: {
        dispatchJobId: null,
      },
    });

    const rowsWritten = await prisma.socialAnalyticsDaily.count({
      where: {
        clientId: claimed.clientId,
        socialAccountId: meta.socialAccountId,
        source: "provider_api",
        platform: "facebook",
      },
    });

    logSocialOAuthEvent("facebook-page-sync", {
      stage: "worker",
      outcome: snapshot.status,
      provider: "meta",
      mode: snapshot.metricsAvailable ? "metrics_ready" : "no_metrics",
      writeCreated: rowsWritten,
      errorCategory: snapshot.lastErrorCategory ?? undefined,
      msTotal: Date.now() - started,
    });

    return snapshot;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(0, 240)
        : "Facebook Page sync worker failed.";

    const retry = claimed.attempts < claimed.maxAttempts;
    const backoffMs = computeFacebookSyncBackoffMs(claimed.attempts);

    const finalized = await completeJobWithLease({
      jobId: claimed.id,
      leaseOwner: claimed.leaseOwner,
      status: retry ? "retrying" : "failed",
      errorMessage: message,
      scheduledFor: retry
        ? new Date(Date.now() + backoffMs)
        : null,
    });

    if (!retry && finalized) {
      await prisma.socialAccountSyncState.updateMany({
        where: {
          clientId: claimed.clientId,
          socialAccountId: meta.socialAccountId,
          syncGeneration: meta.generation,
          status: "syncing",
        },
        data: {
          status: "failed",
          lastErrorCategory: "worker_failed",
          lastErrorMessage:
            "Facebook Page sync failed after retries. You can retry.",
          lastAttemptAt: new Date(),
        },
      });
    }

    logSocialOAuthEvent("facebook-page-sync", {
      stage: "worker",
      outcome: retry ? "retrying" : "failed",
      provider: "meta",
      authMode: retry ? "backoff" : "terminal",
      errorCategory: retry ? "temporary" : "worker_failed",
      msTotal: Date.now() - started,
    });

    return null;
  }
}

/**
 * Release expired running leases back to retrying/failed without Meta I/O.
 * Safe for cron and optional lightweight GET hooks.
 */
export async function releaseExpiredFacebookPageSyncLeases(options?: {
  clientId?: string;
  limit?: number;
}): Promise<{ released: number; failed: number }> {
  const prisma = getPrisma();
  if (!prisma) {
    return { released: 0, failed: 0 };
  }

  const now = new Date();
  const limit = options?.limit ?? 25;
  let released = 0;
  let failed = 0;

  const expired = await prisma.job.findMany({
    where: {
      type: "sync_analytics",
      status: "running",
      leaseExpiresAt: { lt: now },
      ...(options?.clientId ? { clientId: options.clientId } : {}),
    },
    select: {
      id: true,
      attempts: true,
      maxAttempts: true,
      metadata: true,
      clientId: true,
    },
    take: limit,
  });

  for (const job of expired) {
    const retry = job.attempts < job.maxAttempts;
    const backoffMs = computeFacebookSyncBackoffMs(job.attempts);
    const updated = await prisma.job.updateMany({
      where: {
        id: job.id,
        status: "running",
        leaseExpiresAt: { lt: now },
      },
      data: {
        status: retry ? "retrying" : "failed",
        leaseOwner: null,
        leaseExpiresAt: null,
        errorMessage: retry
          ? "Facebook Page sync lease expired; retrying."
          : "Facebook Page sync lease expired.",
        scheduledFor: retry
          ? new Date(Date.now() + backoffMs)
          : undefined,
        completedAt: retry ? null : new Date(),
      },
    });

    if (updated.count !== 1) continue;

    if (retry) {
      released += 1;
    } else {
      failed += 1;
      if (job.clientId && isFacebookSyncJobMetadata(job.metadata)) {
        await prisma.socialAccountSyncState.updateMany({
          where: {
            clientId: job.clientId,
            socialAccountId: job.metadata.socialAccountId,
            syncGeneration: job.metadata.generation,
            status: "syncing",
          },
          data: {
            status: "failed",
            lastErrorCategory: "lease_expired",
            lastErrorMessage:
              "Facebook Page sync stopped unexpectedly. You can retry.",
            lastAttemptAt: new Date(),
          },
        });
      }
    }
  }

  // Orphan syncing rows with no live dispatch job.
  const runningStale = new Date(Date.now() - SOCIAL_SYNC_STALE_CLAIM_MS);
  const orphanSyncing = await prisma.socialAccountSyncState.findMany({
    where: {
      status: "syncing",
      ...(options?.clientId ? { clientId: options.clientId } : {}),
      lastAttemptAt: { lte: runningStale },
    },
    select: {
      id: true,
      syncGeneration: true,
      dispatchJobId: true,
      socialAccountId: true,
      clientId: true,
    },
    take: limit,
  });

  for (const row of orphanSyncing) {
    if (row.dispatchJobId) {
      const live = await prisma.job.findFirst({
        where: {
          id: row.dispatchJobId,
          status: { in: ["queued", "running", "retrying"] },
        },
        select: { id: true },
      });
      if (live) continue;
    }

    await prisma.socialAccountSyncState.updateMany({
      where: {
        id: row.id,
        status: "syncing",
        syncGeneration: row.syncGeneration,
      },
      data: {
        status: "failed",
        lastErrorCategory: "claim_abandoned",
        lastErrorMessage:
          "Facebook Page sync stopped unexpectedly. You can retry.",
        lastAttemptAt: new Date(),
      },
    });
    failed += 1;
  }

  return { released, failed };
}

/**
 * Independent durable consumer tick — cron primary delivery path.
 * Claims due queued/retrying jobs and expired leases; does not require a user GET.
 */
export async function runFacebookPageSyncWorkerTick(options?: {
  clientId?: string;
  limit?: number;
  transport?: MetaInsightsTransport;
  /** When false, only release leases / list due work — do not run Meta. */
  processJobs?: boolean;
}): Promise<{
  released: number;
  failed: number;
  claimed: number;
  completed: number;
}> {
  const prisma = getPrisma();
  if (!prisma) {
    return { released: 0, failed: 0, claimed: 0, completed: 0 };
  }

  const started = Date.now();
  const leaseResult = await releaseExpiredFacebookPageSyncLeases({
    clientId: options?.clientId,
    limit: options?.limit ?? 25,
  });

  let claimed = 0;
  let completed = 0;

  if (options?.processJobs === false) {
    logSocialOAuthEvent("facebook-page-sync", {
      stage: "worker_tick",
      outcome: "leases_only",
      provider: "meta",
      writeUpdated: leaseResult.released,
      malformedCount: leaseResult.failed,
      msTotal: Date.now() - started,
    });
    return {
      released: leaseResult.released,
      failed: leaseResult.failed,
      claimed: 0,
      completed: 0,
    };
  }

  const now = new Date();
  const limit = options?.limit ?? 5;

  // Include expired running leases so a stuck after() claim cannot hide work
  // from the durable consumer until releaseExpired runs in the same tick.
  const due = await prisma.job.findMany({
    where: {
      type: "sync_analytics",
      ...(options?.clientId ? { clientId: options.clientId } : {}),
      OR: [
        {
          status: { in: ["queued", "retrying"] },
          OR: [{ scheduledFor: { lte: now } }, { scheduledFor: null }],
        },
        {
          status: "running",
          leaseExpiresAt: { lt: now },
        },
      ],
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    select: { id: true },
    take: limit,
  });

  for (const job of due) {
    const snapshot = await processFacebookPageSyncJob(job.id, {
      transport: options?.transport,
    });
    claimed += 1;
    if (snapshot) {
      completed += 1;
    }
  }

  logSocialOAuthEvent("facebook-page-sync", {
    stage: "worker_tick",
    outcome: "ok",
    provider: "meta",
    writeCreated: claimed,
    writeUpdated: completed,
    writeUnchanged: leaseResult.released,
    malformedCount: leaseResult.failed,
    msTotal: Date.now() - started,
  });

  return {
    released: leaseResult.released,
    failed: leaseResult.failed,
    claimed,
    completed,
  };
}

/** Backward-compatible alias used by older dashboard GET paths. */
export async function recoverAbandonedFacebookPageSyncJobs(options?: {
  clientId?: string;
}): Promise<{ requeued: number; failed: number }> {
  const result = await runFacebookPageSyncWorkerTick({
    clientId: options?.clientId,
    processJobs: true,
    limit: 3,
  });
  return {
    requeued: result.released + result.claimed,
    failed: result.failed,
  };
}
