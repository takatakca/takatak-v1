/**
 * Dev/ops: enqueue historical Facebook Page sync for the canonical selected Page,
 * then drain the durable worker (queued → leased → Meta → writes → finalized).
 *
 * Prints a sanitized ingestion report only — never Page IDs, tokens, or raw Meta bodies.
 *
 * Usage: npm run worker:social-sync:backfill
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

function shiftDateOnly(value: string, deltaDays: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

type ReportMetric = {
  dashboardMetric: string;
  metaSource: string;
  status: string;
  rowCount: number;
  coveredFrom: string | null;
  coveredThrough: string | null;
  errorCategory: string | null;
};

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const account = await prisma.socialAccount.findFirst({
      where: {
        platform: "facebook",
        accessStatus: "selected",
        externalAccountId: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        clientId: true,
        businessBrandId: true,
        providerConnectionId: true,
        displayName: true,
        metadata: true,
        providerConnection: {
          select: {
            id: true,
            createdByProfileId: true,
            status: true,
          },
        },
      },
    });

    if (!account?.providerConnectionId || !account.businessBrandId) {
      console.log(
        JSON.stringify({
          stage: "facebook_historical_backfill",
          outcome: "blocked",
          reason: "no_selected_facebook_page",
        }),
      );
      process.exitCode = 1;
      return;
    }

    if (account.providerConnection?.status !== "connected") {
      console.log(
        JSON.stringify({
          stage: "facebook_historical_backfill",
          outcome: "blocked",
          reason: "connection_not_connected",
          connectionStatus: account.providerConnection?.status ?? null,
        }),
      );
      process.exitCode = 1;
      return;
    }

    const profileId = account.providerConnection.createdByProfileId;
    if (!profileId) {
      console.log(
        JSON.stringify({
          stage: "facebook_historical_backfill",
          outcome: "blocked",
          reason: "missing_profile",
        }),
      );
      process.exitCode = 1;
      return;
    }

    const rangeDays = Number(process.env.FACEBOOK_BACKFILL_RANGE_DAYS ?? 30);
    const until = process.env.FACEBOOK_BACKFILL_UNTIL?.trim() || todayUtc();
    const since =
      process.env.FACEBOOK_BACKFILL_SINCE?.trim() ||
      shiftDateOnly(until, -(Math.max(1, rangeDays) - 1));

    const existingSync = await prisma.socialAccountSyncState.findFirst({
      where: { socialAccountId: account.id },
      select: { timezone: true },
    });
    const timezone = existingSync?.timezone?.trim() || "America/Toronto";

    const { claimAndEnqueueFacebookPageSync } = await import(
      "../src/lib/social/sync/facebook-page-sync-job"
    );
    const { runFacebookPageSyncWorkerTick } = await import(
      "../src/lib/social/sync/facebook-page-sync-job"
    );

    // Clear stuck syncing so we can claim.
    await prisma.socialAccountSyncState.updateMany({
      where: {
        socialAccountId: account.id,
        clientId: account.clientId,
        status: "syncing",
      },
      data: {
        status: "idle",
        lastErrorCategory: "ops_reset_for_backfill",
        lastErrorMessage: "Reset stuck syncing state before historical backfill.",
      },
    });

    const enqueued = await claimAndEnqueueFacebookPageSync({
      clientId: account.clientId,
      businessBrandId: account.businessBrandId,
      connectionId: account.providerConnectionId,
      socialAccountId: account.id,
      profileId,
      rangeStart: since,
      rangeEnd: until,
      timezone,
      resumeCursor: null,
      mode: "backfill",
      scheduleImmediate: false,
    });

    console.log(
      JSON.stringify({
        stage: "enqueue",
        outcome: enqueued.claimed ? "queued" : "not_claimed",
        mode: "backfill",
        rangeStart: since,
        rangeEnd: until,
        generation: enqueued.generation,
        hasJob: Boolean(enqueued.jobId),
      }),
    );

    let ticks = 0;
    let claimed = 0;
    let completed = 0;
    const maxTicks = Number(process.env.FACEBOOK_BACKFILL_MAX_TICKS ?? 40);

    while (ticks < maxTicks) {
      ticks += 1;
      const tick = await runFacebookPageSyncWorkerTick({
        clientId: account.clientId,
        limit: 5,
        processJobs: true,
      });
      claimed += tick.claimed;
      completed += tick.completed;

      console.log(
        JSON.stringify({
          stage: "worker_tick",
          tick: ticks,
          released: tick.released,
          claimed: tick.claimed,
          completed: tick.completed,
          failed: tick.failed,
        }),
      );

      const due = await prisma.job.count({
        where: {
          clientId: account.clientId,
          type: "sync_analytics",
          status: { in: ["queued", "retrying", "running"] },
        },
      });
      const syncing = await prisma.socialAccountSyncState.count({
        where: {
          socialAccountId: account.id,
          status: "syncing",
        },
      });

      if (due === 0 && syncing === 0) {
        break;
      }

      // Brief pause between ticks for lease/finalize visibility.
      await new Promise((resolve) => setTimeout(resolve, 750));
    }

    const refreshed = await prisma.socialAccount.findFirst({
      where: { id: account.id },
      select: { metadata: true },
    });
    const sync = await prisma.socialAccountSyncState.findFirst({
      where: { socialAccountId: account.id },
      select: {
        status: true,
        dataCompleteness: true,
        lastConfirmedDate: true,
        rangeStart: true,
        rangeEnd: true,
        lastSyncMode: true,
        graphApiVersion: true,
        partialData: true,
        lastErrorCategory: true,
      },
    });

    const meta =
      refreshed?.metadata &&
      typeof refreshed.metadata === "object" &&
      !Array.isArray(refreshed.metadata)
        ? (refreshed.metadata as Record<string, unknown>)
        : {};
    const ingestion =
      meta.lastFacebookIngestionReport &&
      typeof meta.lastFacebookIngestionReport === "object" &&
      !Array.isArray(meta.lastFacebookIngestionReport)
        ? (meta.lastFacebookIngestionReport as Record<string, unknown>)
        : null;

    const metrics = Array.isArray(ingestion?.metrics)
      ? (ingestion.metrics as ReportMetric[])
      : [];

    const dailyRows = await prisma.socialAnalyticsDaily.findMany({
      where: {
        socialAccountId: account.id,
        source: "provider_api",
        platform: "facebook",
        date: {
          gte: new Date(`${since}T00:00:00.000Z`),
          lte: new Date(`${until}T00:00:00.000Z`),
        },
      },
      select: {
        date: true,
        impressions: true,
        reach: true,
        engagement: true,
        followers: true,
        metadata: true,
      },
      orderBy: { date: "asc" },
    });

    let attestedViewsDays = 0;
    let attestedVisitsDays = 0;
    let attestedContentDays = 0;
    let attestedFollowAddsDays = 0;
    let attestedFollowLostDays = 0;
    let lifetimeStampedDays = 0;

    for (const row of dailyRows) {
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
      if (fields?.impressions === "page_media_view") attestedViewsDays += 1;
      if (fields?.pageVisits === "page_views_total") attestedVisitsDays += 1;
      if (fields?.contentPublished === "published_posts") {
        attestedContentDays += 1;
      }
      if (
        typeof fields?.followersAcquired === "string" &&
        fields.followersAcquired.includes("follows")
      ) {
        attestedFollowAddsDays += 1;
      }
      if (
        typeof fields?.followersLost === "string" &&
        fields.followersLost.includes("unfollow")
      ) {
        attestedFollowLostDays += 1;
      }
      if (
        typeof fields?.followers === "string" &&
        fields.followers.includes("followers_count")
      ) {
        lifetimeStampedDays += 1;
      }
    }

    const table = [
      {
        requested: "Lifetime followers",
        metaSource: "followers_count|fan_count",
        fromReport: metrics.find((m) => m.dashboardMetric === "lifetime_followers"),
        storedAttestedDays: lifetimeStampedDays,
      },
      {
        requested: "Net follower change",
        metaSource:
          "page_daily_follows*_minus_page_daily_unfollows*|lifetime_delta",
        fromReport: metrics.find((m) => m.dashboardMetric === "net_follower_change"),
        storedAttestedDays: attestedFollowAddsDays + attestedFollowLostDays,
      },
      {
        requested: "Views",
        metaSource: "page_media_view",
        fromReport: metrics.find((m) => m.dashboardMetric === "views"),
        storedAttestedDays: attestedViewsDays,
      },
      {
        requested: "Page visits",
        metaSource: "page_views_total",
        fromReport: metrics.find((m) => m.dashboardMetric === "page_visits"),
        storedAttestedDays: attestedVisitsDays,
      },
      {
        requested: "Total content",
        metaSource: "published_posts",
        fromReport: metrics.find((m) => m.dashboardMetric === "total_content"),
        storedAttestedDays: attestedContentDays,
      },
      {
        requested: "Engagement",
        metaSource: "published_posts.reactions.summary",
        fromReport: metrics.find((m) => m.dashboardMetric === "engagement"),
        storedAttestedDays: dailyRows.filter((row) => {
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
          return (
            typeof fields?.engagement === "string" &&
            fields.engagement.includes("reactions")
          );
        }).length,
      },
    ];

    console.log(
      JSON.stringify(
        {
          stage: "facebook_historical_backfill",
          outcome: "ok",
          worker: {
            ticks,
            claimed,
            completed,
          },
          sync: {
            status: sync?.status ?? null,
            dataCompleteness: sync?.dataCompleteness ?? null,
            lastSyncMode: sync?.lastSyncMode ?? null,
            graphApiVersion: sync?.graphApiVersion ?? ingestion?.graphApiVersion ?? null,
            partialData: sync?.partialData ?? null,
            lastErrorCategory: sync?.lastErrorCategory ?? null,
            lastConfirmedDate: sync?.lastConfirmedDate
              ? sync.lastConfirmedDate.toISOString().slice(0, 10)
              : null,
            rangeStart: sync?.rangeStart
              ? sync.rangeStart.toISOString().slice(0, 10)
              : since,
            rangeEnd: sync?.rangeEnd
              ? sync.rangeEnd.toISOString().slice(0, 10)
              : until,
          },
          storage: {
            dailyRowCount: dailyRows.length,
            daysWritten: ingestion?.daysWritten ?? null,
          },
          ingestionReport: table.map((row) => ({
            requestedDashboardMetric: row.requested,
            exactMetaSource: row.fromReport?.metaSource ?? row.metaSource,
            apiStatus: row.fromReport?.status ?? "unavailable",
            returnedRowCount: row.fromReport?.rowCount ?? 0,
            coveredFrom: row.fromReport?.coveredFrom ?? null,
            coveredThrough: row.fromReport?.coveredThrough ?? null,
            errorCategory: row.fromReport?.errorCategory ?? null,
            storedAttestedDays: row.storedAttestedDays,
          })),
          allMetricStatuses: metrics.map((row) => ({
            dashboardMetric: row.dashboardMetric,
            metaSource: row.metaSource,
            status: row.status,
            rowCount: row.rowCount,
            coveredFrom: row.coveredFrom,
            coveredThrough: row.coveredThrough,
            errorCategory: row.errorCategory,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "backfill failed");
  process.exit(1);
});
