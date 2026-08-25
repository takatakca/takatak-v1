import "server-only";

import { randomUUID } from "node:crypto";

import { getPrisma } from "@/lib/db/prisma";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { refreshFacebookCompetitorSnapshot } from "@/lib/social/sync/facebook-competitor-sync";
import { computeFacebookSyncBackoffMs } from "@/lib/social/sync/facebook-page-sync-job";

export const FACEBOOK_COMPETITOR_JOB_KIND =
  "facebook_competitor_snapshot" as const;

export const FACEBOOK_COMPETITOR_JOB_LEASE_MS = 2 * 60 * 1000;
export const FACEBOOK_COMPETITOR_MAX_ATTEMPTS = 5;
/** Jitter band so competitor refreshes do not stampede. */
export const FACEBOOK_COMPETITOR_JITTER_MS = 15 * 60 * 1000;

export type FacebookCompetitorJobMetadata = {
  kind: typeof FACEBOOK_COMPETITOR_JOB_KIND;
  competitorTrackId: string;
  generation: number;
};

function isCompetitorJobMetadata(
  value: unknown,
): value is FacebookCompetitorJobMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.kind === FACEBOOK_COMPETITOR_JOB_KIND &&
    typeof record.competitorTrackId === "string" &&
    typeof record.generation === "number"
  );
}

function competitorJitterMs(trackId: string): number {
  let hash = 0;
  for (let i = 0; i < trackId.length; i += 1) {
    hash = (hash + trackId.charCodeAt(i) * (i + 1)) % 997;
  }
  return Math.floor((hash / 997) * FACEBOOK_COMPETITOR_JITTER_MS);
}

/**
 * Enqueue a competitor snapshot refresh job (idempotent per generation).
 */
export async function enqueueFacebookCompetitorRefresh(options: {
  clientId: string;
  businessBrandId: string;
  publicRef?: string;
  trackId?: string;
}): Promise<{ enqueued: boolean; jobId: string | null }> {
  const prisma = getPrisma();
  if (!prisma) return { enqueued: false, jobId: null };

  const track = await prisma.socialCompetitorTrack.findFirst({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      status: "active",
      ...(options.publicRef ? { publicRef: options.publicRef } : {}),
      ...(options.trackId ? { id: options.trackId } : {}),
    },
  });
  if (!track) return { enqueued: false, jobId: null };

  // Skip if a job is already dispatched and not expired.
  if (track.dispatchJobId) {
    const existing = await prisma.job.findFirst({
      where: {
        id: track.dispatchJobId,
        status: { in: ["queued", "running", "retrying"] },
      },
      select: { id: true },
    });
    if (existing) {
      return { enqueued: false, jobId: existing.id };
    }
  }

  const generation = track.syncGeneration + 1;
  const job = await prisma.$transaction(async (tx) => {
    await tx.socialCompetitorTrack.update({
      where: { id: track.id },
      data: { syncGeneration: generation },
    });
    const created = await tx.job.create({
      data: {
        clientId: options.clientId,
        businessBrandId: options.businessBrandId,
        type: "sync_analytics",
        status: "queued",
        provider: "internal",
        attempts: 0,
        maxAttempts: FACEBOOK_COMPETITOR_MAX_ATTEMPTS,
        scheduledFor: new Date(Date.now() + competitorJitterMs(track.id)),
        metadata: {
          kind: FACEBOOK_COMPETITOR_JOB_KIND,
          competitorTrackId: track.id,
          generation,
        },
      },
    });
    await tx.socialCompetitorTrack.update({
      where: { id: track.id },
      data: { dispatchJobId: created.id },
    });
    return created;
  });

  logSocialOAuthEvent("facebook-competitor", {
    stage: "enqueue",
    outcome: "queued",
    provider: "meta",
  });

  return { enqueued: true, jobId: job.id };
}

export async function scheduleDueFacebookCompetitorRefreshes(options?: {
  limit?: number;
}): Promise<{ enqueued: number; skipped: number }> {
  const prisma = getPrisma();
  if (!prisma) return { enqueued: 0, skipped: 0 };

  const now = new Date();
  const due = await prisma.socialCompetitorTrack.findMany({
    where: {
      status: "active",
      OR: [{ nextRefreshAt: null }, { nextRefreshAt: { lte: now } }],
    },
    orderBy: { nextRefreshAt: "asc" },
    take: options?.limit ?? 10,
    select: {
      id: true,
      clientId: true,
      businessBrandId: true,
      dispatchJobId: true,
    },
  });

  let enqueued = 0;
  let skipped = 0;
  for (const track of due) {
    const result = await enqueueFacebookCompetitorRefresh({
      clientId: track.clientId,
      businessBrandId: track.businessBrandId,
      trackId: track.id,
    });
    if (result.enqueued) enqueued += 1;
    else skipped += 1;
  }
  return { enqueued, skipped };
}

async function claimCompetitorJobLease(jobId: string): Promise<{
  id: string;
  clientId: string;
  businessBrandId: string;
  attempts: number;
  maxAttempts: number;
  leaseOwner: string;
  metadata: FacebookCompetitorJobMetadata;
} | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  const leaseOwner = randomUUID();
  const now = new Date();
  const leaseExpiresAt = new Date(
    now.getTime() + FACEBOOK_COMPETITOR_JOB_LEASE_MS,
  );

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
  if (
    !row?.clientId ||
    !row.businessBrandId ||
    !row.leaseOwner ||
    !isCompetitorJobMetadata(row.metadata)
  ) {
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

export async function processFacebookCompetitorJob(
  jobId: string,
): Promise<"ok" | "stale" | "skipped" | "failed"> {
  const claimed = await claimCompetitorJobLease(jobId);
  if (!claimed) return "skipped";

  const prisma = getPrisma();
  if (!prisma) return "skipped";

  try {
    const outcome = await refreshFacebookCompetitorSnapshot({
      clientId: claimed.clientId,
      businessBrandId: claimed.businessBrandId,
      trackId: claimed.metadata.competitorTrackId,
      generation: claimed.metadata.generation,
    });

    await prisma.job.updateMany({
      where: {
        id: claimed.id,
        leaseOwner: claimed.leaseOwner,
        status: "running",
      },
      data: {
        status: "completed",
        completedAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        errorMessage: null,
      },
    });
    return outcome;
  } catch {
    const retry = claimed.attempts < claimed.maxAttempts;
    const backoffMs = computeFacebookSyncBackoffMs(claimed.attempts);
    await prisma.job.updateMany({
      where: {
        id: claimed.id,
        leaseOwner: claimed.leaseOwner,
        status: "running",
      },
      data: {
        status: retry ? "retrying" : "failed",
        leaseOwner: null,
        leaseExpiresAt: null,
        errorMessage: retry
          ? "Competitor snapshot refresh failed; retrying."
          : "Competitor snapshot refresh failed.",
        scheduledFor: retry ? new Date(Date.now() + backoffMs) : null,
      },
    });
    return "failed";
  }
}

export async function runFacebookCompetitorWorkerTick(options?: {
  limit?: number;
  processJobs?: boolean;
}): Promise<{
  claimed: number;
  completed: number;
  failed: number;
  scheduled: number;
}> {
  const prisma = getPrisma();
  const scheduled = await scheduleDueFacebookCompetitorRefreshes({
    limit: options?.limit ?? 10,
  });

  if (!prisma || options?.processJobs === false) {
    return {
      claimed: 0,
      completed: 0,
      failed: 0,
      scheduled: scheduled.enqueued,
    };
  }

  const now = new Date();
  const candidates = await prisma.job.findMany({
    where: {
      type: "sync_analytics",
      status: { in: ["queued", "retrying"] },
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: options?.limit ?? 5,
    select: { id: true, metadata: true },
  });

  let claimed = 0;
  let completed = 0;
  let failed = 0;

  for (const job of candidates) {
    if (!isCompetitorJobMetadata(job.metadata)) continue;
    claimed += 1;
    const outcome = await processFacebookCompetitorJob(job.id);
    if (outcome === "failed") failed += 1;
    else if (outcome === "ok" || outcome === "stale") completed += 1;
  }

  return {
    claimed,
    completed,
    failed,
    scheduled: scheduled.enqueued,
  };
}
