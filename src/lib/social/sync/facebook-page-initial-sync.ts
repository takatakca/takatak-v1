import "server-only";

import type { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { assertProfileCanManageSocialAccounts } from "@/lib/social/connections/social-connection-auth";
import {
  runSocialDbTransaction,
  SOCIAL_DB_TRANSACTION_METRIC_BATCH_TIMEOUT_MS,
  SOCIAL_SYNC_STALE_CLAIM_MS,
} from "@/lib/social/connections/social-db-transaction";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import {
  fetchFacebookPageInsights,
  MetaInsightError,
  type FacebookInsightsFetchResult,
  type MetaInsightsTransport,
} from "@/lib/social/providers/meta-insights";
import {
  buildSocialCredentialAad,
  decryptSocialTokenPayload,
  encryptSocialTokenPayload,
  readMetaFacebookPageCredential,
  withMetaFacebookPageCredential,
} from "@/lib/social/security/social-crypto";
import {
  buildFacebookDailyMetricCreate,
  mergeFacebookDailyMetricUpdate,
  selectLifetimeFollowersAtOrBefore,
  type LifetimeFollowerCandidate,
} from "@/lib/social/sync/facebook-metric-write";

export type FacebookPageSyncStatus =
  | "idle"
  | "syncing"
  | "ready"
  | "empty"
  | "degraded"
  | "action_required"
  | "failed";

export type FacebookPageSyncSnapshot = {
  connectionId: string;
  socialAccountId: string;
  status: FacebookPageSyncStatus;
  pageName: string | null;
  profileImageUrl: string | null;
  rangeStart: string | null;
  rangeEnd: string | null;
  timezone: string;
  partialData: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCategory: string | null;
  lastErrorMessage: string | null;
  retryCount: number;
  syncGeneration: number;
  metricsAvailable: boolean;
  dataCompleteness?: string;
  lastSyncMode?: string | null;
  backfillStatus?: string | null;
  lastConfirmedDate?: string | null;
  /** Sanitized job operational status — no internal IDs. */
  operation?: {
    jobStatus: string | null;
    attempts: number | null;
    maxAttempts: number | null;
    nextRetryAt: string | null;
    leaseActive: boolean;
    leaseExpired: boolean;
    errorCategory: string | null;
  };
};

export type MetricProvenance =
  | "confirmed"
  | "missing"
  | "unavailable_permission"
  | "partial"
  | "stale";

export type FacebookPageMetricRow = {
  date: string;
  /** Present only when Meta returned or validly derived the value. */
  reach: number | null;
  impressions: number | null;
  engagement: number | null;
  followers: number | null;
  pageVisits: number | null;
  followersAcquired: number | null;
  followersLost: number | null;
  contentPublished: number | null;
  provenance: {
    reach: MetricProvenance;
    impressions: MetricProvenance;
    engagement: MetricProvenance;
    followers: MetricProvenance;
    pageVisits: MetricProvenance;
    followersAcquired: MetricProvenance;
    followersLost: MetricProvenance;
    contentPublished: MetricProvenance;
  };
  /** Storage metricSet (e.g. page_media_view_day / page_engagement_day). */
  metricSet: string | null;
  /** metadata.fields.impressions when set (e.g. page_media_view). */
  fieldImpressions: string | null;
  /**
   * Raw DB impressions. Never treat as Views unless fieldImpressions attests
   * page_media_view. Used server-side for provenance / legacy rejection.
   * Stripped from the sync GET client payload.
   */
  storedImpressions: number;
};

type SyncClaimResult =
  | {
      claimed: true;
      generation: number;
      cursor: string | null;
      alreadyRunning: false;
    }
  | {
      claimed: false;
      generation: number;
      cursor: string | null;
      alreadyRunning: true;
    };

const DEFAULT_RANGE_DAYS = 28;
const METRIC_BATCH_SIZE = 7;
const syncInFlight = new Map<string, Promise<FacebookPageSyncSnapshot>>();

function syncKey(options: {
  clientId: string;
  socialAccountId: string;
}): string {
  return `${options.clientId}:${options.socialAccountId}`;
}

function dateOnlyUtc(daysAgo: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function mapInsightCategoryToSync(
  category: MetaInsightError["category"],
): {
  status: Extract<
    FacebookPageSyncStatus,
    "action_required" | "failed" | "empty"
  >;
  errorCategory: string;
  message: string;
} {
  if (
    category === "authorization_expired" ||
    category === "permission_required" ||
    category === "not_found"
  ) {
    return {
      status: "action_required",
      errorCategory: category,
      message:
        category === "authorization_expired"
          ? "Facebook authorization expired. Reconnect to continue."
          : category === "permission_required"
            ? "Facebook Page analytics access is missing. Reconnect with Page access, and ensure your Meta app use case includes pages_read_engagement and read_insights."
            : "The selected Facebook Page is no longer available through this authorization.",
    };
  }

  if (category === "unsupported" || category === "deprecated") {
    return {
      status: "failed",
      errorCategory: category,
      message:
        "Facebook returned an unsupported or deprecated analytics metric for this Graph API version.",
    };
  }

  if (category === "privacy_threshold") {
    return {
      status: "empty",
      errorCategory: category,
      message:
        "Facebook withheld Page analytics below a privacy or Page-size threshold.",
    };
  }

  return {
    status: "failed",
    errorCategory: category,
    message:
      category === "rate_limited"
        ? "Facebook rate-limited analytics sync. Wait a moment and retry."
        : category === "malformed"
          ? "Facebook returned an unsupported analytics field or metric. Sync cannot continue until the integration is updated."
          : "Facebook Page sync failed temporarily. You can retry.",
  };
}

function toSnapshot(options: {
  connectionId: string;
  socialAccountId: string;
  pageName: string | null;
  profileImageUrl: string | null;
  status: FacebookPageSyncStatus;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  timezone: string;
  partialData: boolean;
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorCategory: string | null;
  lastErrorMessage: string | null;
  retryCount: number;
  syncGeneration: number;
  metricsAvailable: boolean;
  dataCompleteness?: string | null;
  lastSyncMode?: string | null;
  backfillStatus?: string | null;
  lastConfirmedDate?: Date | null;
  operation?: FacebookPageSyncSnapshot["operation"];
}): FacebookPageSyncSnapshot {
  return {
    connectionId: options.connectionId,
    socialAccountId: options.socialAccountId,
    status: options.status,
    pageName: options.pageName,
    profileImageUrl: options.profileImageUrl,
    rangeStart: options.rangeStart
      ? options.rangeStart.toISOString().slice(0, 10)
      : null,
    rangeEnd: options.rangeEnd
      ? options.rangeEnd.toISOString().slice(0, 10)
      : null,
    timezone: options.timezone,
    partialData: options.partialData,
    lastAttemptAt: options.lastAttemptAt?.toISOString() ?? null,
    lastSuccessAt: options.lastSuccessAt?.toISOString() ?? null,
    lastErrorCategory: options.lastErrorCategory,
    lastErrorMessage: options.lastErrorMessage,
    retryCount: options.retryCount,
    syncGeneration: options.syncGeneration,
    metricsAvailable: options.metricsAvailable,
    dataCompleteness: options.dataCompleteness ?? "unknown",
    lastSyncMode: options.lastSyncMode ?? null,
    backfillStatus: options.backfillStatus ?? null,
    lastConfirmedDate: options.lastConfirmedDate
      ? options.lastConfirmedDate.toISOString().slice(0, 10)
      : null,
    operation: options.operation,
  };
}

function fallbackSnapshot(options: {
  connectionId: string;
  socialAccountId: string;
  pageName: string | null;
  profileImageUrl: string | null;
  status: FacebookPageSyncStatus;
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
  errorCategory?: string | null;
  errorMessage?: string | null;
  syncGeneration?: number;
}): FacebookPageSyncSnapshot {
  return toSnapshot({
    connectionId: options.connectionId,
    socialAccountId: options.socialAccountId,
    pageName: options.pageName,
    profileImageUrl: options.profileImageUrl,
    status: options.status,
    rangeStart: parseDateOnly(options.rangeStart),
    rangeEnd: parseDateOnly(options.rangeEnd),
    timezone: options.timezone,
    partialData: false,
    lastAttemptAt: new Date(),
    lastSuccessAt: null,
    lastErrorCategory: options.errorCategory ?? null,
    lastErrorMessage: options.errorMessage ?? null,
    retryCount: 0,
    syncGeneration: options.syncGeneration ?? 0,
    metricsAvailable: false,
  });
}

/** Test-only: clear in-flight coalescing between cases. */
export function resetFacebookPageSyncCoalescingForTests(): void {
  syncInFlight.clear();
}

/**
 * Load sync snapshot for the persisted selected Facebook Page only.
 * Never uses findFirst/order/name heuristics for Page identity.
 */
export async function getSelectedFacebookPageSyncSnapshot(options: {
  clientId: string;
  businessBrandId: string;
}): Promise<FacebookPageSyncSnapshot | null> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  const started = Date.now();

  const assignment =
    await prisma.socialBrandAccountAssignment.findFirst({
      where: {
        clientId: options.clientId,
        businessBrandId: options.businessBrandId,
        status: "active",
        socialAccount: {
          clientId: options.clientId,
          platform: "facebook",
          accountType: "facebook_page",
          status: "connected",
          accessStatus: "selected",
          providerConnectionId: { not: null },
          externalAccountId: { not: null },
        },
      },
      select: {
        socialAccount: {
          select: {
            id: true,
            displayName: true,
            profileImageUrl: true,
            providerConnectionId: true,
            syncState: {
              select: {
                status: true,
                rangeStart: true,
                rangeEnd: true,
                timezone: true,
                partialData: true,
                lastAttemptAt: true,
                lastSuccessAt: true,
                lastErrorCategory: true,
                lastErrorMessage: true,
                retryCount: true,
                syncGeneration: true,
                dispatchJobId: true,
                dataCompleteness: true,
                lastSyncMode: true,
                backfillStatus: true,
                lastConfirmedDate: true,
              },
            },
          },
        },
      },
    });

  const account = assignment?.socialAccount;
  if (!account?.providerConnectionId) {
    logSocialOAuthEvent("facebook-page-sync", {
      stage: "snapshot_read",
      outcome: "none",
      provider: "meta",
      msTotal: Date.now() - started,
    });
    return null;
  }

  const sync = account.syncState;
  const status =
    (sync?.status as FacebookPageSyncStatus | undefined) ?? "idle";

  // Only count rows after a successful terminal sync — never invent availability.
  let metricsAvailable = false;
  if (
    sync &&
    (status === "ready" || status === "degraded" || status === "empty")
  ) {
    const metricsCount = await prisma.socialAnalyticsDaily.count({
      where: {
        clientId: options.clientId,
        socialAccountId: account.id,
        source: "provider_api",
      },
    });
    metricsAvailable = metricsCount > 0;
  }

  let operation: FacebookPageSyncSnapshot["operation"];
  if (sync?.dispatchJobId) {
    const job = await prisma.job.findFirst({
      where: {
        id: sync.dispatchJobId,
        clientId: options.clientId,
        type: "sync_analytics",
      },
      select: {
        status: true,
        attempts: true,
        maxAttempts: true,
        scheduledFor: true,
        leaseOwner: true,
        leaseExpiresAt: true,
        errorMessage: true,
      },
    });

    if (job) {
      const now = Date.now();
      const leaseActive = Boolean(
        job.leaseOwner &&
          job.leaseExpiresAt &&
          job.leaseExpiresAt.getTime() > now,
      );
      const leaseExpired = Boolean(
        job.status === "running" &&
          job.leaseExpiresAt &&
          job.leaseExpiresAt.getTime() <= now,
      );

      // Terminal jobs are noise once sync status is already ready/failed.
      const jobTerminal =
        job.status === "completed" ||
        job.status === "failed" ||
        job.status === "cancelled";

      if (!jobTerminal) {
        operation = {
          jobStatus: job.status,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          nextRetryAt:
            job.status === "retrying" && job.scheduledFor
              ? job.scheduledFor.toISOString()
              : job.status === "queued" && job.scheduledFor
                ? job.scheduledFor.toISOString()
                : null,
          leaseActive,
          leaseExpired,
          errorCategory: sync.lastErrorCategory,
        };
      }
    }
  }

  logSocialOAuthEvent("facebook-page-sync", {
    stage: "snapshot_read",
    outcome: status,
    provider: "meta",
    msTotal: Date.now() - started,
  });

  return toSnapshot({
    connectionId: account.providerConnectionId,
    socialAccountId: account.id,
    pageName: account.displayName,
    profileImageUrl: account.profileImageUrl,
    status,
    rangeStart: sync?.rangeStart ?? null,
    rangeEnd: sync?.rangeEnd ?? null,
    timezone: sync?.timezone ?? "UTC",
    partialData: sync?.partialData ?? false,
    lastAttemptAt: sync?.lastAttemptAt ?? null,
    lastSuccessAt: sync?.lastSuccessAt ?? null,
    lastErrorCategory: sync?.lastErrorCategory ?? null,
    lastErrorMessage: sync?.lastErrorMessage ?? null,
    retryCount: sync?.retryCount ?? 0,
    syncGeneration: sync?.syncGeneration ?? 0,
    metricsAvailable,
    dataCompleteness: sync?.dataCompleteness ?? "unknown",
    lastSyncMode: sync?.lastSyncMode ?? null,
    backfillStatus: sync?.backfillStatus ?? null,
    lastConfirmedDate: sync?.lastConfirmedDate ?? null,
    operation,
  });
}

async function loadSelectedPageForSync(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
  socialAccountId: string;
}) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  await assertProfileCanManageSocialAccounts(prisma, {
    clientId: options.clientId,
    profileId: options.profileId,
  });

  const connection =
    await prisma.socialProviderConnection.findFirst({
      where: {
        id: options.connectionId,
        clientId: options.clientId,
        provider: "meta",
        status: "connected",
      },
      select: {
        id: true,
        clientId: true,
        businessBrandId: true,
        provider: true,
        status: true,
        credential: {
          select: {
            id: true,
            status: true,
            encryptedPayload: true,
            iv: true,
            authTag: true,
            keyVersion: true,
          },
        },
      },
    });

  if (!connection?.credential || connection.credential.status !== "active") {
    throw new ServiceError(
      "conflict",
      "Facebook authorization credentials are missing. Reconnect to continue.",
    );
  }

  const account = await prisma.socialAccount.findFirst({
    where: {
      id: options.socialAccountId,
      clientId: options.clientId,
      providerConnectionId: connection.id,
      platform: "facebook",
      accountType: "facebook_page",
      status: "connected",
      accessStatus: "selected",
    },
    select: {
      id: true,
      externalAccountId: true,
      displayName: true,
      profileImageUrl: true,
      businessBrandId: true,
    },
  });

  if (!account?.externalAccountId || !account.businessBrandId) {
    throw new ServiceError(
      "not_found",
      "The selected Facebook Page could not be found for this connection.",
    );
  }

  if (account.businessBrandId !== connection.businessBrandId) {
    throw new ServiceError(
      "conflict",
      "The selected Facebook Page does not belong to this brand.",
    );
  }

  return { connection, account, prisma };
}

async function markClaimFailure(options: {
  clientId: string;
  businessBrandId: string;
  socialAccountId: string;
  connectionId: string;
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
  errorCategory: string;
  errorMessage: string;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;

  const now = new Date();

  try {
    await prisma.socialAccountSyncState.upsert({
      where: { socialAccountId: options.socialAccountId },
      create: {
        clientId: options.clientId,
        businessBrandId: options.businessBrandId,
        socialAccountId: options.socialAccountId,
        providerConnectionId: options.connectionId,
        status: "failed",
        lastAttemptAt: now,
        lastErrorCategory: options.errorCategory,
        lastErrorMessage: options.errorMessage,
        retryCount: 1,
        syncGeneration: 0,
        rangeStart: parseDateOnly(options.rangeStart),
        rangeEnd: parseDateOnly(options.rangeEnd),
        timezone: options.timezone,
      },
      update: {
        status: "failed",
        lastAttemptAt: now,
        lastErrorCategory: options.errorCategory,
        lastErrorMessage: options.errorMessage,
        rangeStart: parseDateOnly(options.rangeStart),
        rangeEnd: parseDateOnly(options.rangeEnd),
        timezone: options.timezone,
      },
    });
  } catch {
    // Best-effort — caller already failed to claim.
  }
}

/**
 * Atomic short claim: single-statement create + conditional updateMany.
 * No interactive transaction, no Meta I/O, no credential work.
 */
export async function claimFacebookPageSync(options: {
  clientId: string;
  businessBrandId: string;
  socialAccountId: string;
  connectionId: string;
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
  resumeCursor: string | null;
}): Promise<SyncClaimResult> {
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

  try {
    const ensureStarted = Date.now();
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
    const msEnsure = Date.now() - ensureStarted;

    const casStarted = Date.now();
    const claimed = await prisma.socialAccountSyncState.updateMany({
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
    const msCas = Date.now() - casStarted;

    const row = await prisma.socialAccountSyncState.findUnique({
      where: { socialAccountId: options.socialAccountId },
      select: {
        syncGeneration: true,
        syncCursor: true,
        status: true,
        clientId: true,
      },
    });

    if (!row || row.clientId !== options.clientId) {
      throw new ServiceError(
        "forbidden",
        "You do not have access to this sync state.",
      );
    }

    logSocialOAuthEvent("facebook-page-sync-mark", {
      stage: "claim",
      outcome: claimed.count === 1 ? "claimed" : "already_running",
      provider: "meta",
      msEnsure,
      msCas,
      msTotal: Date.now() - started,
    });

    if (claimed.count === 1) {
      return {
        claimed: true,
        alreadyRunning: false,
        generation: row.syncGeneration,
        cursor: options.resumeCursor ?? row.syncCursor,
      };
    }

    return {
      claimed: false,
      alreadyRunning: true,
      generation: row.syncGeneration,
      cursor: row.syncCursor,
    };
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }

    logSocialOAuthEvent("facebook-page-sync-mark", {
      stage: "claim",
      outcome: "timeout",
      provider: "meta",
      msTotal: Date.now() - started,
    });

    await markClaimFailure({
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      socialAccountId: options.socialAccountId,
      connectionId: options.connectionId,
      rangeStart: options.rangeStart,
      rangeEnd: options.rangeEnd,
      timezone: options.timezone,
      errorCategory: "claim_timeout",
      errorMessage:
        "Facebook Page sync could not be started. You can retry.",
    });

    throw new ServiceError(
      "unavailable",
      "Facebook Page sync could not be started. You can retry.",
      { status: 503 },
    );
  }
}

async function persistInsightDays(options: {
  clientId: string;
  businessBrandId: string;
  socialAccountId: string;
  generation: number;
  days: FacebookInsightsFetchResult["days"];
  jobLease?: { jobId: string; leaseOwner: string } | null;
}): Promise<number> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  let written = 0;

  for (let offset = 0; offset < options.days.length; offset += METRIC_BATCH_SIZE) {
    const stillOwns = await prisma.socialAccountSyncState.findFirst({
      where: {
        clientId: options.clientId,
        socialAccountId: options.socialAccountId,
        syncGeneration: options.generation,
        status: "syncing",
      },
      select: { id: true },
    });

    if (!stillOwns) {
      return written;
    }

    if (options.jobLease) {
      const { extendFacebookPageSyncJobLease } = await import(
        "@/lib/social/sync/facebook-page-sync-job"
      );
      const extended = await extendFacebookPageSyncJobLease({
        jobId: options.jobLease.jobId,
        leaseOwner: options.jobLease.leaseOwner,
      });
      if (!extended) {
        return written;
      }
    }

    const batch = options.days.slice(offset, offset + METRIC_BATCH_SIZE);

    const existingRows = await prisma.socialAnalyticsDaily.findMany({
      where: {
        clientId: options.clientId,
        socialAccountId: options.socialAccountId,
        source: "provider_api",
        date: {
          in: batch.map((day) => parseDateOnly(day.date)),
        },
      },
      select: {
        date: true,
        reach: true,
        impressions: true,
        engagement: true,
        followers: true,
        metadata: true,
      },
    });
    const existingByDate = new Map(
      existingRows.map((row) => [
        row.date.toISOString().slice(0, 10),
        row,
      ]),
    );

    await runSocialDbTransaction(
      "facebook-page-sync-metrics",
      async (transaction) => {
        for (const day of batch) {
          const existing = existingByDate.get(day.date) ?? null;
          const existingStored = existing
            ? {
                reach: existing.reach,
                impressions: existing.impressions,
                engagement: existing.engagement,
                followers: existing.followers,
                metadata:
                  existing.metadata &&
                  typeof existing.metadata === "object" &&
                  !Array.isArray(existing.metadata)
                    ? (existing.metadata as Record<string, unknown>)
                    : null,
              }
            : null;

          const createValues = buildFacebookDailyMetricCreate(day);
          const updateValues = mergeFacebookDailyMetricUpdate({
            incoming: day,
            existing: existingStored,
          });

          await transaction.socialAnalyticsDaily.upsert({
            where: {
              socialAccountId_date_source: {
                socialAccountId: options.socialAccountId,
                date: parseDateOnly(day.date),
                source: "provider_api",
              },
            },
            create: {
              clientId: options.clientId,
              businessBrandId: options.businessBrandId,
              socialAccountId: options.socialAccountId,
              platform: "facebook",
              date: parseDateOnly(day.date),
              reach: createValues.reach,
              impressions: createValues.impressions,
              engagement: createValues.engagement,
              clicks: 0,
              followers: createValues.followers,
              source: "provider_api",
              metadata: createValues.metadata as Prisma.InputJsonValue,
            },
            update: {
              reach: updateValues.reach,
              impressions: updateValues.impressions,
              engagement: updateValues.engagement,
              followers: updateValues.followers,
              metadata: updateValues.metadata as Prisma.InputJsonValue,
            },
          });
          written += 1;
        }
      },
      {
        maxWaitMs: SOCIAL_DB_TRANSACTION_METRIC_BATCH_TIMEOUT_MS,
        timeoutMs: SOCIAL_DB_TRANSACTION_METRIC_BATCH_TIMEOUT_MS,
      },
    );
  }

  return written;
}

async function finalizeSyncState(options: {
  clientId: string;
  socialAccountId: string;
  connectionId: string;
  generation: number;
  status: FacebookPageSyncStatus;
  partialData: boolean;
  cursor: string | null;
  timezone: string;
  rangeStart: string;
  rangeEnd: string;
  errorCategory?: string | null;
  errorMessage?: string | null;
  syncMode?: "initial" | "incremental" | "backfill";
  seedBackfill?: boolean;
  identity?: {
    name: string;
    category: string | null;
    profileImageUrl: string | null;
  } | null;
}): Promise<"applied" | "stale" | "page_changed" | "disconnected"> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  const now = new Date();
  const started = Date.now();

  const liveConnection =
    await prisma.socialProviderConnection.findFirst({
      where: {
        id: options.connectionId,
        clientId: options.clientId,
        status: "connected",
      },
      select: { id: true },
    });

  if (!liveConnection) {
    await prisma.socialAccountSyncState.updateMany({
      where: {
        clientId: options.clientId,
        socialAccountId: options.socialAccountId,
        syncGeneration: options.generation,
      },
      data: {
        status: "action_required",
        lastErrorCategory: "disconnected",
        lastErrorMessage:
          "The Facebook connection was disconnected during sync.",
        lastAttemptAt: now,
        syncCursor: null,
      },
    });
    logSocialOAuthEvent("facebook-page-sync-finalize", {
      stage: "finalize",
      outcome: "disconnected",
      provider: "meta",
      msTotal: Date.now() - started,
    });
    return "disconnected";
  }

  const selected = await prisma.socialAccount.findFirst({
    where: {
      id: options.socialAccountId,
      clientId: options.clientId,
      providerConnectionId: options.connectionId,
      status: "connected",
      accessStatus: "selected",
    },
    select: { id: true },
  });

  if (!selected) {
    await prisma.socialAccountSyncState.updateMany({
      where: {
        clientId: options.clientId,
        socialAccountId: options.socialAccountId,
        syncGeneration: options.generation,
      },
      data: {
        status: "action_required",
        lastErrorCategory: "page_changed",
        lastErrorMessage:
          "The selected Facebook Page changed during sync.",
        lastAttemptAt: now,
        syncCursor: null,
      },
    });
    logSocialOAuthEvent("facebook-page-sync-finalize", {
      stage: "finalize",
      outcome: "page_changed",
      provider: "meta",
      msTotal: Date.now() - started,
    });
    return "page_changed";
  }

  if (options.identity) {
    await prisma.socialAccount.updateMany({
      where: {
        id: options.socialAccountId,
        clientId: options.clientId,
        accessStatus: "selected",
      },
      data: {
        displayName: options.identity.name,
        category: options.identity.category,
        profileImageUrl: options.identity.profileImageUrl,
        lastSyncAt: now,
      },
    });

    await prisma.socialProviderConnection.updateMany({
      where: {
        id: options.connectionId,
        clientId: options.clientId,
        status: "connected",
      },
      data: {
        displayName: options.identity.name,
        lastSyncAt: now,
        lastValidatedAt: now,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorAt: null,
      },
    });
  } else if (
    options.status === "ready" ||
    options.status === "empty" ||
    options.status === "degraded"
  ) {
    await prisma.socialAccount.updateMany({
      where: {
        id: options.socialAccountId,
        clientId: options.clientId,
      },
      data: { lastSyncAt: now },
    });
    await prisma.socialProviderConnection.updateMany({
      where: {
        id: options.connectionId,
        clientId: options.clientId,
      },
      data: { lastSyncAt: now, lastValidatedAt: now },
    });
  }

  const success =
    options.status === "ready" ||
    options.status === "empty" ||
    options.status === "degraded";

  const {
    computeNextIncrementalAt,
    FACEBOOK_BACKFILL_HORIZON_DAYS,
    shiftDateOnly,
  } = await import("@/lib/social/sync/facebook-page-sync-schedule");

  const nextIncrementalAt = success
    ? computeNextIncrementalAt(options.socialAccountId, now)
    : undefined;

  const horizonStart = shiftDateOnly(
    options.rangeEnd,
    -(FACEBOOK_BACKFILL_HORIZON_DAYS - 1),
  );

  const applied = await prisma.socialAccountSyncState.updateMany({
    where: {
      clientId: options.clientId,
      socialAccountId: options.socialAccountId,
      syncGeneration: options.generation,
      status: "syncing",
    },
    data: {
      status: options.status,
      partialData: options.partialData,
      syncCursor: options.cursor,
      timezone: options.timezone,
      rangeStart: parseDateOnly(options.rangeStart),
      rangeEnd: parseDateOnly(options.rangeEnd),
      lastAttemptAt: now,
      lastSuccessAt: success ? now : undefined,
      lastErrorCategory: options.errorCategory ?? null,
      lastErrorMessage: options.errorMessage ?? null,
      providerSyncedAt: success ? now : undefined,
      lastConfirmedDate: success
        ? parseDateOnly(options.rangeEnd)
        : undefined,
      lastSyncMode: options.syncMode ?? undefined,
      nextIncrementalAt,
      dataCompleteness: success
        ? options.partialData
          ? "partial"
          : options.status === "empty"
            ? "unavailable"
            : options.seedBackfill
              ? "backfilling"
              : "complete"
        : undefined,
      graphApiVersion: success ? "v21.0" : undefined,
      ...(options.seedBackfill && success
        ? {
            backfillStatus: "running",
            backfillHorizonStart: parseDateOnly(horizonStart),
            backfillCursorDate: parseDateOnly(
              shiftDateOnly(options.rangeStart, -1),
            ),
          }
        : {}),
    },
  });

  const outcome = applied.count === 1 ? "applied" : "stale";

  if (
    outcome === "applied" &&
    options.seedBackfill &&
    success
  ) {
    // Enqueue the first older backfill window (recent-adjacent) without Meta I/O here.
    try {
      const { claimAndEnqueueFacebookPageSync } = await import(
        "@/lib/social/sync/facebook-page-sync-job"
      );
      const { planBackfillWindows } = await import(
        "@/lib/social/sync/facebook-page-sync-schedule"
      );
      const windows = planBackfillWindows({
        horizonStart,
        recentStart: options.rangeStart,
      });
      const first = windows[0];
      if (first) {
        const connection = await prisma.socialProviderConnection.findFirst({
          where: {
            id: options.connectionId,
            clientId: options.clientId,
          },
          select: {
            createdByProfileId: true,
            businessBrandId: true,
          },
        });
        if (connection?.createdByProfileId) {
          await claimAndEnqueueFacebookPageSync({
            clientId: options.clientId,
            profileId: connection.createdByProfileId,
            connectionId: options.connectionId,
            socialAccountId: options.socialAccountId,
            businessBrandId: connection.businessBrandId,
            rangeStart: first.since,
            rangeEnd: first.until,
            timezone: options.timezone,
            resumeCursor: null,
            mode: "backfill",
            scheduleImmediate: false,
          });
        }
      }
    } catch {
      // Cron / next incremental tick can continue backfill later.
    }
  }

  if (
    outcome === "applied" &&
    options.errorCategory === "authorization_expired"
  ) {
    await prisma.socialProviderConnection.updateMany({
      where: {
        id: options.connectionId,
        clientId: options.clientId,
        status: "connected",
      },
      data: {
        lastErrorCode: "authorization_expired",
        lastErrorMessage:
          options.errorMessage ??
          "Facebook authorization expired. Reconnect to continue.",
        lastErrorAt: now,
      },
    });
    const { invalidateBrandSelectorCache } = await import(
      "@/lib/security/brand-context"
    );
    invalidateBrandSelectorCache(options.clientId);
  }

  logSocialOAuthEvent("facebook-page-sync-finalize", {
    stage: "finalize",
    outcome,
    provider: "meta",
    msTotal: Date.now() - started,
  });

  return outcome;
}

async function runInitialFacebookPageSyncUncoalesced(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
  socialAccountId: string;
  resume?: boolean;
  transport?: MetaInsightsTransport;
  /** When set, skip claim — caller already owns this generation. */
  claimedGeneration?: number;
  claimedCursor?: string | null;
  /** Durable worker lease — must remain owner through finalize. */
  jobLease?: { jobId: string; leaseOwner: string } | null;
  rangeSince?: string | null;
  rangeUntil?: string | null;
  syncMode?: "initial" | "incremental" | "backfill";
}): Promise<FacebookPageSyncSnapshot> {
  const totalStarted = Date.now();
  const { connection, account, prisma } = await loadSelectedPageForSync(
    options,
  );

  const brand = await prisma.businessBrand.findFirst({
    where: {
      id: connection.businessBrandId,
      clientId: options.clientId,
    },
    select: { timezone: true },
  });

  const timezone = brand?.timezone?.trim() || "UTC";

  const existingSync = await prisma.socialAccountSyncState.findUnique({
    where: { socialAccountId: account.id },
    select: {
      syncCursor: true,
      lastConfirmedDate: true,
      overlapDays: true,
      backfillStatus: true,
      backfillHorizonStart: true,
      timezone: true,
    },
  });

  const { computeIncrementalFetchWindow } = await import(
    "@/lib/social/sync/facebook-page-sync-schedule"
  );

  let syncMode = options.syncMode ?? "initial";
  let rangeStart: string;
  let rangeEnd: string;

  if (
    options.rangeSince &&
    options.rangeUntil &&
    /^\d{4}-\d{2}-\d{2}$/.test(options.rangeSince) &&
    /^\d{4}-\d{2}-\d{2}$/.test(options.rangeUntil)
  ) {
    rangeStart = options.rangeSince;
    rangeEnd = options.rangeUntil;
  } else {
    const window = computeIncrementalFetchWindow({
      lastConfirmedDate:
        existingSync?.lastConfirmedDate instanceof Date
          ? existingSync.lastConfirmedDate.toISOString().slice(0, 10)
          : null,
      overlapDays: existingSync?.overlapDays ?? 2,
      timezone,
    });
    rangeStart = window.since;
    rangeEnd = window.until;
    syncMode = window.mode;
  }

  let generation: number;
  let cursor: string | null;

  if (typeof options.claimedGeneration === "number") {
    generation = options.claimedGeneration;
    cursor = options.claimedCursor ?? null;
  } else {
    const resumeCursor =
      options.resume && existingSync?.syncCursor
        ? existingSync.syncCursor
        : null;

    const claim = await claimFacebookPageSync({
      clientId: options.clientId,
      businessBrandId: connection.businessBrandId,
      socialAccountId: account.id,
      connectionId: connection.id,
      rangeStart,
      rangeEnd,
      timezone,
      resumeCursor,
    });

    if (!claim.claimed) {
      return (
        (await getSelectedFacebookPageSyncSnapshot({
          clientId: options.clientId,
          businessBrandId: connection.businessBrandId,
        })) ??
        fallbackSnapshot({
          connectionId: connection.id,
          socialAccountId: account.id,
          pageName: account.displayName,
          profileImageUrl: account.profileImageUrl,
          status: "syncing",
          rangeStart,
          rangeEnd,
          timezone,
          syncGeneration: claim.generation,
        })
      );
    }

    generation = claim.generation;
    cursor = claim.cursor;
  }

  let payload;
  try {
    payload = decryptSocialTokenPayload(
      {
        ciphertext: connection.credential!.encryptedPayload,
        iv: connection.credential!.iv,
        authTag: connection.credential!.authTag,
        keyVersion: connection.credential!.keyVersion,
      },
      buildSocialCredentialAad({
        clientId: connection.clientId,
        connectionId: connection.id,
        provider: connection.provider,
      }),
    );
  } catch {
    await finalizeSyncState({
      clientId: options.clientId,
      socialAccountId: account.id,
      connectionId: connection.id,
      generation,
      status: "action_required",
      partialData: false,
      cursor: null,
      timezone,
      rangeStart,
      rangeEnd,
      errorCategory: "authorization_expired",
      errorMessage:
        "Facebook authorization credentials could not be read. Reconnect to continue.",
    });

    return (
      (await getSelectedFacebookPageSyncSnapshot({
        clientId: options.clientId,
        businessBrandId: connection.businessBrandId,
      })) ??
      fallbackSnapshot({
        connectionId: connection.id,
        socialAccountId: account.id,
        pageName: account.displayName,
        profileImageUrl: account.profileImageUrl,
        status: "action_required",
        rangeStart,
        rangeEnd,
        timezone,
        errorCategory: "authorization_expired",
        errorMessage:
          "Facebook authorization credentials could not be read. Reconnect to continue.",
        syncGeneration: generation,
      })
    );
  }

  let pageCredential = readMetaFacebookPageCredential(payload);
  if (
    !pageCredential ||
    pageCredential.pageId !== account.externalAccountId
  ) {
    // Reconnect can replace the user token and drop nested Page credentials.
    // Reattach from live Meta validation when a selected Page still exists.
    const externalPageId = account.externalAccountId?.trim() ?? "";
    try {
      if (!externalPageId) {
        throw new Error("missing_external_page_id");
      }
      const { revalidateManagedFacebookPage } = await import(
        "@/lib/social/providers/meta-pages"
      );
      const verified = await revalidateManagedFacebookPage({
        userAccessToken: payload.accessToken,
        externalPageId,
      });
      if (!verified.pageAccessToken) {
        throw new Error("missing_page_token");
      }

      const nextPayload = withMetaFacebookPageCredential(payload, {
        pageId: verified.externalPageId,
        accessToken: verified.pageAccessToken,
      });
      const encrypted = encryptSocialTokenPayload(
        nextPayload,
        buildSocialCredentialAad({
          clientId: connection.clientId,
          connectionId: connection.id,
          provider: connection.provider,
        }),
      );
      await prisma.socialCredential.update({
        where: { connectionId: connection.id },
        data: {
          encryptedPayload: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          keyVersion: encrypted.keyVersion,
          lastValidatedAt: new Date(),
          statusChangedAt: new Date(),
        },
      });
      const attached = readMetaFacebookPageCredential(nextPayload);
      if (!attached) {
        throw new Error("page_credential_not_attached");
      }
      pageCredential = attached;
      payload = nextPayload;
      logSocialOAuthEvent("facebook-page-sync", {
        stage: "reattach_page_credential",
        outcome: "ok",
        provider: "meta",
      });
    } catch {
      await finalizeSyncState({
        clientId: options.clientId,
        socialAccountId: account.id,
        connectionId: connection.id,
        generation,
        status: "action_required",
        partialData: false,
        cursor: null,
        timezone,
        rangeStart,
        rangeEnd,
        errorCategory: "permission_required",
        errorMessage:
          "Facebook Page credentials are missing for analytics sync.",
      });

      return (
        (await getSelectedFacebookPageSyncSnapshot({
          clientId: options.clientId,
          businessBrandId: connection.businessBrandId,
        })) ??
        fallbackSnapshot({
          connectionId: connection.id,
          socialAccountId: account.id,
          pageName: account.displayName,
          profileImageUrl: account.profileImageUrl,
          status: "action_required",
          rangeStart,
          rangeEnd,
          timezone,
          errorCategory: "permission_required",
          errorMessage:
            "Facebook Page credentials are missing for analytics sync.",
          syncGeneration: generation,
        })
      );
    }
  }

  let insights: FacebookInsightsFetchResult;

  try {
    // Meta I/O intentionally outside DB transactions.
    if (options.jobLease) {
      const { extendFacebookPageSyncJobLease } = await import(
        "@/lib/social/sync/facebook-page-sync-job"
      );
      const extended = await extendFacebookPageSyncJobLease({
        jobId: options.jobLease.jobId,
        leaseOwner: options.jobLease.leaseOwner,
      });
      if (!extended) {
        return (
          (await getSelectedFacebookPageSyncSnapshot({
            clientId: options.clientId,
            businessBrandId: connection.businessBrandId,
          })) ??
          fallbackSnapshot({
            connectionId: connection.id,
            socialAccountId: account.id,
            pageName: account.displayName,
            profileImageUrl: account.profileImageUrl,
            status: "syncing",
            rangeStart,
            rangeEnd,
            timezone,
            syncGeneration: generation,
          })
        );
      }
    }

    insights = await fetchFacebookPageInsights({
      pageAccessToken: pageCredential.accessToken,
      externalPageId: account.externalAccountId!,
      since: rangeStart,
      until: rangeEnd,
      cursor,
      transport: options.transport,
    });
  } catch (error) {
    const mapped =
      error instanceof MetaInsightError
        ? mapInsightCategoryToSync(error.category)
        : {
            status: "failed" as const,
            errorCategory: "temporary",
            message:
              "Facebook Page sync failed temporarily. You can retry.",
          };

    await finalizeSyncState({
      clientId: options.clientId,
      socialAccountId: account.id,
      connectionId: connection.id,
      generation,
      status: mapped.status,
      partialData: false,
      cursor,
      timezone,
      rangeStart,
      rangeEnd,
      errorCategory: mapped.errorCategory,
      errorMessage: mapped.message,
    });

    logSocialOAuthEvent("facebook-page-sync", {
      stage: "initial_sync",
      outcome: mapped.errorCategory,
      provider: "meta",
      errorCategory: mapped.errorCategory,
      writeCreated: 0,
      msTotal: Date.now() - totalStarted,
    });

    return (
      (await getSelectedFacebookPageSyncSnapshot({
        clientId: options.clientId,
        businessBrandId: connection.businessBrandId,
      })) ??
      fallbackSnapshot({
        connectionId: connection.id,
        socialAccountId: account.id,
        pageName: account.displayName,
        profileImageUrl: account.profileImageUrl,
        status: mapped.status,
        rangeStart,
        rangeEnd,
        timezone,
        errorCategory: mapped.errorCategory,
        errorMessage: mapped.message,
        syncGeneration: generation,
      })
    );
  }

  const written = await persistInsightDays({
    clientId: options.clientId,
    businessBrandId: connection.businessBrandId,
    socialAccountId: account.id,
    generation,
    days: insights.days,
    jobLease: options.jobLease,
  });

  // Step 8 — posts / reels / stories (best-effort; insights remain primary).
  try {
    const { syncFacebookPageContent } = await import(
      "@/lib/social/sync/facebook-content-sync"
    );
    await syncFacebookPageContent({
      clientId: options.clientId,
      businessBrandId: connection.businessBrandId,
      socialAccountId: account.id,
      pageAccessToken: pageCredential.accessToken,
      externalPageId: account.externalAccountId!,
      since: rangeStart,
      until: rangeEnd,
      generation,
      transport: options.transport,
    });
  } catch {
    logSocialOAuthEvent("facebook-page-content-sync", {
      stage: "content_sync",
      outcome: "failed",
      provider: "meta",
    });
  }

  // Demographics + sanitized ingestion report (no Page IDs / tokens).
  {
    const prisma = getPrisma();
    if (prisma) {
      let demographicsReport: Record<string, unknown> | null = null;
      try {
        const { probeFacebookPageDemographics } = await import(
          "@/lib/social/providers/meta-content"
        );
        const demographics = await probeFacebookPageDemographics({
          pageAccessToken: pageCredential.accessToken,
          externalPageId: account.externalAccountId!,
          transport: options.transport,
        });
        demographicsReport = {
          status: demographics.status,
          hasGenderAge: Boolean(demographics.genderAge?.length),
          hasCity: Boolean(demographics.city?.length),
          genderAge: demographics.genderAge,
          city: demographics.city,
          retrievedAt: new Date().toISOString(),
        };
      } catch {
        logSocialOAuthEvent("facebook-page-demographics", {
          stage: "demographics_probe",
          outcome: "failed",
          provider: "meta",
        });
      }

      const existingMeta = await prisma.socialAccount.findFirst({
        where: { id: account.id, clientId: options.clientId },
        select: { metadata: true },
      });
      const prior =
        existingMeta?.metadata &&
        typeof existingMeta.metadata === "object" &&
        !Array.isArray(existingMeta.metadata)
          ? (existingMeta.metadata as Record<string, unknown>)
          : {};
      await prisma.socialAccount.updateMany({
        where: {
          id: account.id,
          clientId: options.clientId,
        },
        data: {
          metadata: {
            ...prior,
            ...(demographicsReport
              ? { lastFacebookDemographicsReport: demographicsReport }
              : {}),
            lastFacebookIngestionReport: {
              graphApiVersion: insights.graphApiVersion,
              providerSyncedAt: insights.providerSyncedAt,
              rangeStart,
              rangeEnd,
              partial: insights.partial,
              metrics: insights.metricReport,
              daysWritten: written,
            },
          } as object,
        },
      });
    }
  }

  if (options.jobLease) {
    const { extendFacebookPageSyncJobLease } = await import(
      "@/lib/social/sync/facebook-page-sync-job"
    );
    const extended = await extendFacebookPageSyncJobLease({
      jobId: options.jobLease.jobId,
      leaseOwner: options.jobLease.leaseOwner,
    });
    if (!extended) {
      logSocialOAuthEvent("facebook-page-sync", {
        stage: "initial_sync",
        outcome: "lease_lost_before_finalize",
        provider: "meta",
        msTotal: Date.now() - totalStarted,
      });
      return (
        (await getSelectedFacebookPageSyncSnapshot({
          clientId: options.clientId,
          businessBrandId: connection.businessBrandId,
        })) ??
        fallbackSnapshot({
          connectionId: connection.id,
          socialAccountId: account.id,
          pageName: account.displayName,
          profileImageUrl: account.profileImageUrl,
          status: "syncing",
          rangeStart,
          rangeEnd,
          timezone,
          syncGeneration: generation,
        })
      );
    }
  }

  const status: FacebookPageSyncStatus = insights.partial
    ? "degraded"
    : written === 0
      ? "empty"
      : "ready";

  const finalizeOutcome = await finalizeSyncState({
    clientId: options.clientId,
    socialAccountId: account.id,
    connectionId: connection.id,
    generation,
    status,
    partialData: insights.partial,
    cursor: insights.nextCursor,
    timezone: insights.identity.timezone?.trim() || timezone,
    rangeStart,
    rangeEnd,
    syncMode,
    seedBackfill:
      syncMode === "initial" &&
      (!existingSync?.backfillStatus ||
        existingSync.backfillStatus === "idle"),
    identity: {
      name: insights.identity.name,
      category: insights.identity.category,
      profileImageUrl: insights.identity.profileImageUrl,
    },
  });

  if (
    finalizeOutcome === "page_changed" ||
    finalizeOutcome === "disconnected"
  ) {
    return (
      (await getSelectedFacebookPageSyncSnapshot({
        clientId: options.clientId,
        businessBrandId: connection.businessBrandId,
      })) ??
      fallbackSnapshot({
        connectionId: connection.id,
        socialAccountId: account.id,
        pageName: account.displayName,
        profileImageUrl: account.profileImageUrl,
        status: "action_required",
        rangeStart,
        rangeEnd,
        timezone,
        errorCategory: finalizeOutcome,
        errorMessage:
          finalizeOutcome === "disconnected"
            ? "The Facebook connection was disconnected during sync."
            : "The selected Facebook Page changed during sync.",
        syncGeneration: generation,
      })
    );
  }

  logSocialOAuthEvent("facebook-page-sync", {
    stage: "initial_sync",
    outcome:
      finalizeOutcome === "stale" ? "stale_discarded" : status,
    provider: "meta",
    mode: insights.partial ? "partial" : "complete",
    writeCreated: written,
    errorCategory:
      finalizeOutcome === "stale"
        ? "stale_generation"
        : status === "degraded"
          ? "partial"
          : undefined,
    msTotal: Date.now() - totalStarted,
  });

  return (
    (await getSelectedFacebookPageSyncSnapshot({
      clientId: options.clientId,
      businessBrandId: connection.businessBrandId,
    })) ??
    fallbackSnapshot({
      connectionId: connection.id,
      socialAccountId: account.id,
      pageName: insights.identity.name,
      profileImageUrl: insights.identity.profileImageUrl,
      status: finalizeOutcome === "stale" ? "syncing" : status,
      rangeStart,
      rangeEnd,
      timezone: insights.identity.timezone?.trim() || timezone,
      syncGeneration: generation,
    })
  );
}

/**
 * Start or coalesce initial sync for the exact selected Facebook Page.
 */
export async function runInitialFacebookPageSync(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
  socialAccountId: string;
  resume?: boolean;
  transport?: MetaInsightsTransport;
  claimedGeneration?: number;
  claimedCursor?: string | null;
  jobLease?: { jobId: string; leaseOwner: string } | null;
  rangeSince?: string | null;
  rangeUntil?: string | null;
  syncMode?: "initial" | "incremental" | "backfill";
}): Promise<FacebookPageSyncSnapshot> {
  const key = syncKey({
    clientId: options.clientId,
    socialAccountId: options.socialAccountId,
  });

  const existing = syncInFlight.get(key);
  if (existing) {
    return existing;
  }

  const promise = runInitialFacebookPageSyncUncoalesced(options).finally(
    () => {
      if (syncInFlight.get(key) === promise) {
        syncInFlight.delete(key);
      }
    },
  );

  syncInFlight.set(key, promise);
  return promise;
}

/**
 * Claim syncing state + durable Job atomically, then optionally optimize
 * dispatch with Next.js `after()`. Delivery guarantee is the cron worker tick.
 */
export async function enqueueInitialFacebookPageSync(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
  socialAccountId: string;
  businessBrandId: string;
  resume?: boolean;
  /** Test-only synthetic Meta transport (processed inline by worker). */
  transport?: MetaInsightsTransport;
  /** Test-only: skip Next after() and run worker inline. */
  processInline?: boolean;
}): Promise<FacebookPageSyncSnapshot | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  const brand = await prisma.businessBrand.findFirst({
    where: {
      id: options.businessBrandId,
      clientId: options.clientId,
    },
    select: { timezone: true },
  });

  const timezone = brand?.timezone?.trim() || "UTC";
  const rangeEnd = dateOnlyUtc(1);
  const rangeStart = dateOnlyUtc(DEFAULT_RANGE_DAYS);

  let resumeCursor: string | null = null;
  if (options.resume) {
    const existing = await prisma.socialAccountSyncState.findUnique({
      where: { socialAccountId: options.socialAccountId },
      select: { syncCursor: true },
    });
    resumeCursor = existing?.syncCursor ?? null;
  }

  const {
    claimAndEnqueueFacebookPageSync,
    processFacebookPageSyncJob,
    scheduleFacebookPageSyncJob,
    runFacebookPageSyncWorkerTick,
  } = await import("@/lib/social/sync/facebook-page-sync-job");

  let claim: Awaited<ReturnType<typeof claimAndEnqueueFacebookPageSync>>;
  try {
    claim = await claimAndEnqueueFacebookPageSync({
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      connectionId: options.connectionId,
      socialAccountId: options.socialAccountId,
      profileId: options.profileId,
      rangeStart,
      rangeEnd,
      timezone,
      resumeCursor,
      resume: options.resume,
      mode: "initial",
    });
  } catch {
    return getSelectedFacebookPageSyncSnapshot({
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
    });
  }

  if (claim.claimed && claim.jobId) {
    if (options.processInline) {
      await processFacebookPageSyncJob(claim.jobId, {
        transport: options.transport,
      });
    } else {
      // Optimization only — cron worker is the delivery guarantee.
      scheduleFacebookPageSyncJob(claim.jobId);
    }
  } else {
    // Already syncing — release expired leases only (processJobs:false).
    // Never process Meta here; cron / worker:social-sync owns processing.
    await runFacebookPageSyncWorkerTick({
      clientId: options.clientId,
      processJobs: false,
    });
  }

  return getSelectedFacebookPageSyncSnapshot({
    clientId: options.clientId,
    businessBrandId: options.businessBrandId,
  });
}

/**
 * After credentials are renewed (OAuth reconnect / preserved Page), clear a
 * stale authorization_expired sync block and enqueue a fresh attempt.
 * Never logs tokens or Page IDs.
 */
export async function requeueFacebookPageSyncAfterCredentialRefresh(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
  businessBrandId: string;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    return;
  }

  const selected = await prisma.socialAccount.findFirst({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      providerConnectionId: options.connectionId,
      platform: "facebook",
      accountType: "facebook_page",
      status: "connected",
      accessStatus: "selected",
    },
    select: { id: true },
  });

  if (!selected) {
    return;
  }

  await prisma.socialProviderConnection.updateMany({
    where: {
      id: options.connectionId,
      clientId: options.clientId,
      lastErrorCode: {
        in: [
          "authorization_expired",
          "reauthorization_pending",
          "reauthorization_failed",
          "oauth_callback_failed",
        ],
      },
    },
    data: {
      lastErrorCode: null,
      lastErrorMessage: null,
      lastErrorAt: null,
    },
  });

  await prisma.socialAccountSyncState.updateMany({
    where: {
      clientId: options.clientId,
      socialAccountId: selected.id,
      status: "action_required",
      lastErrorCategory: "authorization_expired",
    },
    data: {
      status: "idle",
      lastErrorCategory: null,
      lastErrorMessage: null,
    },
  });

  try {
    await enqueueInitialFacebookPageSync({
      clientId: options.clientId,
      profileId: options.profileId,
      connectionId: options.connectionId,
      socialAccountId: selected.id,
      businessBrandId: options.businessBrandId,
    });
  } catch {
    // Credential refresh already succeeded — cron/worker can recover sync.
  }
}

export type FacebookLifetimeFollowersSnapshot = {
  value: number;
  /** Snapshot day used for display (≤ selected range end). */
  date: string;
  metaField: string;
  provenance: "confirmed" | "legacy_confirmed";
  dateAttribution: "stored" | "sync_range_end";
  /** Original stored day when attribution was adjusted from an over-extended metric day. */
  storedDate?: string;
};

/**
 * Latest confirmed lifetime follower total at or before rangeEnd.
 * Snapshot may predate selectedStart — that is intentional.
 * Never infers lifetime from acquired/lost.
 */
export async function resolveLifetimeFollowersSnapshot(options: {
  clientId: string;
  businessBrandId: string;
  socialAccountId: string;
  atOrBefore: string;
}): Promise<FacebookLifetimeFollowersSnapshot | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  const sync = await prisma.socialAccountSyncState.findFirst({
    where: {
      clientId: options.clientId,
      socialAccountId: options.socialAccountId,
    },
    select: {
      rangeEnd: true,
      lastConfirmedDate: true,
    },
  });

  const syncRangeEnd = sync?.lastConfirmedDate
    ? sync.lastConfirmedDate.toISOString().slice(0, 10)
    : sync?.rangeEnd
      ? sync.rangeEnd.toISOString().slice(0, 10)
      : null;

  const rows = await prisma.socialAnalyticsDaily.findMany({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      socialAccountId: options.socialAccountId,
      source: "provider_api",
      platform: "facebook",
      OR: [
        { date: { lte: parseDateOnly(options.atOrBefore) } },
        { followers: { gt: 0 } },
      ],
    },
    orderBy: { date: "desc" },
    take: 180,
    select: {
      date: true,
      followers: true,
      metadata: true,
    },
  });

  const candidates: LifetimeFollowerCandidate[] = rows.map((row) => {
    const metadata =
      row.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null;
    const fields =
      metadata &&
      typeof metadata.fields === "object" &&
      metadata.fields !== null &&
      !Array.isArray(metadata.fields)
        ? (metadata.fields as Record<string, unknown>)
        : null;
    return {
      date: row.date.toISOString().slice(0, 10),
      followers: row.followers,
      fieldSource:
        typeof fields?.followers === "string" ? fields.followers : null,
    };
  });

  return selectLifetimeFollowersAtOrBefore(
    candidates,
    options.atOrBefore,
    { syncRangeEnd },
  );
}

export async function listSelectedFacebookPageMetrics(options: {
  clientId: string;
  businessBrandId: string;
  socialAccountId: string;
  syncStatus?: FacebookPageSyncStatus;
  partialData?: boolean;
  rangeStart?: string | null;
  rangeEnd?: string | null;
}): Promise<FacebookPageMetricRow[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }

  if (
    options.syncStatus &&
    options.syncStatus !== "ready" &&
    options.syncStatus !== "degraded" &&
    options.syncStatus !== "empty"
  ) {
    return [];
  }

  const rows = await prisma.socialAnalyticsDaily.findMany({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      socialAccountId: options.socialAccountId,
      source: "provider_api",
      platform: "facebook",
      ...(options.rangeStart && options.rangeEnd
        ? {
            date: {
              gte: parseDateOnly(options.rangeStart),
              lte: parseDateOnly(options.rangeEnd),
            },
          }
        : {}),
    },
    orderBy: { date: "asc" },
    select: {
      date: true,
      reach: true,
      impressions: true,
      engagement: true,
      followers: true,
      metadata: true,
    },
  });

  const baseProvenance: MetricProvenance = options.partialData
    ? "partial"
    : options.syncStatus === "degraded"
      ? "stale"
      : "confirmed";

  return rows.map((row) => {
    const metadata =
      row.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null;
    const fields =
      metadata &&
      typeof metadata.fields === "object" &&
      metadata.fields !== null &&
      !Array.isArray(metadata.fields)
        ? (metadata.fields as Record<string, unknown>)
        : null;

    const fieldImpressions =
      typeof fields?.impressions === "string" &&
      fields.impressions.trim().length > 0
        ? fields.impressions.trim()
        : null;
    // Views require attested page_media_view — not any non-empty field string.
    const impressionsConfirmed = fieldImpressions === "page_media_view";
    const reachConfirmed =
      typeof fields?.reach === "string" && fields.reach.trim().length > 0;
    const engagementConfirmed =
      typeof fields?.engagement === "string" &&
      fields.engagement.trim().length > 0;
    const followersFieldSet =
      typeof fields?.followers === "string" &&
      fields.followers.trim().length > 0;
    // Prefer explicit stamp; allow legacy positive totals in-range as last resort.
    const followersConfirmed =
      followersFieldSet || row.followers > 0;
    const metricSet =
      typeof metadata?.metricSet === "string" &&
      metadata.metricSet.trim().length > 0
        ? metadata.metricSet.trim()
        : null;

    const values =
      metadata &&
      typeof metadata.values === "object" &&
      metadata.values !== null &&
      !Array.isArray(metadata.values)
        ? (metadata.values as Record<string, unknown>)
        : null;
    const readExtra = (key: string): number | null => {
      const value = values?.[key];
      return typeof value === "number" && Number.isFinite(value)
        ? Math.trunc(value)
        : null;
    };
    const pageVisitsConfirmed =
      typeof fields?.pageVisits === "string" &&
      fields.pageVisits.trim().length > 0;
    const followersAcquiredConfirmed =
      typeof fields?.followersAcquired === "string" &&
      fields.followersAcquired.trim().length > 0;
    const followersLostConfirmed =
      typeof fields?.followersLost === "string" &&
      fields.followersLost.trim().length > 0;
    const contentPublishedConfirmed =
      typeof fields?.contentPublished === "string" &&
      fields.contentPublished.trim().length > 0;

    return {
      date: row.date.toISOString().slice(0, 10),
      reach: reachConfirmed ? row.reach : null,
      impressions: impressionsConfirmed ? row.impressions : null,
      engagement: engagementConfirmed ? row.engagement : null,
      followers: followersConfirmed ? row.followers : null,
      pageVisits: pageVisitsConfirmed ? readExtra("pageVisits") : null,
      followersAcquired: followersAcquiredConfirmed
        ? readExtra("followersAcquired")
        : null,
      followersLost: followersLostConfirmed
        ? readExtra("followersLost")
        : null,
      contentPublished: contentPublishedConfirmed
        ? readExtra("contentPublished")
        : null,
      provenance: {
        reach: reachConfirmed ? baseProvenance : "missing",
        impressions: impressionsConfirmed ? baseProvenance : "missing",
        engagement: engagementConfirmed ? baseProvenance : "missing",
        followers: followersConfirmed
          ? followersFieldSet
            ? baseProvenance
            : "partial"
          : "missing",
        pageVisits: pageVisitsConfirmed ? baseProvenance : "missing",
        followersAcquired: followersAcquiredConfirmed
          ? baseProvenance
          : "missing",
        followersLost: followersLostConfirmed ? baseProvenance : "missing",
        contentPublished: contentPublishedConfirmed
          ? baseProvenance
          : "missing",
      },
      metricSet,
      fieldImpressions,
      storedImpressions: row.impressions,
    };
  });
}
