import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import {
  fetchFacebookPageContent,
  type FacebookContentFetchReport,
  type FacebookContentItemDraft,
} from "@/lib/social/providers/meta-content";
import type { MetaInsightsTransport } from "@/lib/social/providers/meta-insights";

const BATCH_SIZE = 25;

export type FacebookContentSyncResult = {
  upserted: number;
  markedDeleted: number;
  markedExpired: number;
  partial: boolean;
  report: FacebookContentFetchReport[];
  graphApiVersion: string;
};

/**
 * Persist fetched content items and mark missing in-range items deleted/expired.
 * Provider object IDs stay in DB only — list APIs never return them.
 */
export async function persistFacebookContentItems(options: {
  clientId: string;
  businessBrandId: string;
  socialAccountId: string;
  since: string;
  until: string;
  items: FacebookContentItemDraft[];
  generation: number;
}): Promise<{ upserted: number; markedDeleted: number; markedExpired: number }> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  let upserted = 0;
  const seenHashes = new Set<string>();

  for (let offset = 0; offset < options.items.length; offset += BATCH_SIZE) {
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
      break;
    }

    const batch = options.items.slice(offset, offset + BATCH_SIZE);
    for (const item of batch) {
      seenHashes.add(`${item.contentType}:${item.externalIdHash}`);
      await prisma.socialContentItem.upsert({
        where: {
          socialAccountId_contentType_externalIdHash: {
            socialAccountId: options.socialAccountId,
            contentType: item.contentType,
            externalIdHash: item.externalIdHash,
          },
        },
        create: {
          clientId: options.clientId,
          businessBrandId: options.businessBrandId,
          socialAccountId: options.socialAccountId,
          contentType: item.contentType,
          externalIdHash: item.externalIdHash,
          externalObjectId: item.externalObjectId,
          publishedAt: new Date(item.publishedAt),
          captionExcerpt: item.captionExcerpt,
          permalinkUrl: item.permalinkUrl,
          thumbnailUrl: item.thumbnailUrl,
          availability: item.availability,
          reach: item.reach,
          views: item.views,
          reactions: item.reactions,
          comments: item.comments,
          shares: item.shares,
          engagement: item.engagement,
          metricStatus: item.metricStatus,
          graphApiVersion: item.graphApiVersion,
          retrievedAt: new Date(item.retrievedAt),
          lastSeenAt: new Date(item.retrievedAt),
          expiredAt:
            item.availability === "expired" ? new Date(item.retrievedAt) : null,
          metadata: {
            provider: "meta",
            period: "lifetime_object",
          },
        },
        update: {
          captionExcerpt: item.captionExcerpt,
          permalinkUrl: item.permalinkUrl,
          thumbnailUrl: item.thumbnailUrl,
          availability: item.availability,
          reach: item.reach,
          views: item.views,
          reactions: item.reactions,
          comments: item.comments,
          shares: item.shares,
          engagement: item.engagement,
          metricStatus: item.metricStatus,
          graphApiVersion: item.graphApiVersion,
          retrievedAt: new Date(item.retrievedAt),
          lastSeenAt: new Date(item.retrievedAt),
          expiredAt:
            item.availability === "expired" ? new Date(item.retrievedAt) : null,
          deletedAt: null,
          externalObjectId: item.externalObjectId,
        },
      });
      upserted += 1;
    }
  }

  const sinceDate = new Date(`${options.since}T00:00:00.000Z`);
  const untilDate = new Date(`${options.until}T23:59:59.999Z`);
  const existing = await prisma.socialContentItem.findMany({
    where: {
      clientId: options.clientId,
      socialAccountId: options.socialAccountId,
      publishedAt: { gte: sinceDate, lte: untilDate },
      availability: { in: ["available", "unknown"] },
    },
    select: {
      id: true,
      contentType: true,
      externalIdHash: true,
    },
  });

  let markedDeleted = 0;
  let markedExpired = 0;
  const now = new Date();
  for (const row of existing) {
    const key = `${row.contentType}:${row.externalIdHash}`;
    if (seenHashes.has(key)) continue;
    if (row.contentType === "story") {
      await prisma.socialContentItem.update({
        where: { id: row.id },
        data: {
          availability: "expired",
          expiredAt: now,
        },
      });
      markedExpired += 1;
    } else {
      await prisma.socialContentItem.update({
        where: { id: row.id },
        data: {
          availability: "deleted",
          deletedAt: now,
        },
      });
      markedDeleted += 1;
    }
  }

  return { upserted, markedDeleted, markedExpired };
}

export async function syncFacebookPageContent(options: {
  clientId: string;
  businessBrandId: string;
  socialAccountId: string;
  pageAccessToken: string;
  externalPageId: string;
  since: string;
  until: string;
  generation: number;
  transport?: MetaInsightsTransport;
}): Promise<FacebookContentSyncResult> {
  const started = Date.now();
  const fetched = await fetchFacebookPageContent({
    pageAccessToken: options.pageAccessToken,
    externalPageId: options.externalPageId,
    since: options.since,
    until: options.until,
    transport: options.transport,
  });

  const persisted = await persistFacebookContentItems({
    clientId: options.clientId,
    businessBrandId: options.businessBrandId,
    socialAccountId: options.socialAccountId,
    since: options.since,
    until: options.until,
    items: fetched.items,
    generation: options.generation,
  });

  logSocialOAuthEvent("facebook-page-content-sync", {
    stage: "content_sync",
    outcome: fetched.partial ? "partial" : "ok",
    provider: "meta",
    writeCreated: persisted.upserted,
    writeUpdated: persisted.markedDeleted + persisted.markedExpired,
    msTotal: Date.now() - started,
  });

  // Store sanitized report on account metadata.
  const prisma = getPrisma();
  if (prisma) {
    const account = await prisma.socialAccount.findFirst({
      where: { id: options.socialAccountId, clientId: options.clientId },
      select: { metadata: true },
    });
    const prior =
      account?.metadata &&
      typeof account.metadata === "object" &&
      !Array.isArray(account.metadata)
        ? (account.metadata as Record<string, unknown>)
        : {};
    await prisma.socialAccount.updateMany({
      where: { id: options.socialAccountId, clientId: options.clientId },
      data: {
        metadata: {
          ...prior,
          lastFacebookContentIngestionReport: {
            graphApiVersion: fetched.graphApiVersion,
            providerSyncedAt: fetched.providerSyncedAt,
            rangeStart: options.since,
            rangeEnd: options.until,
            partial: fetched.partial,
            upserted: persisted.upserted,
            markedDeleted: persisted.markedDeleted,
            markedExpired: persisted.markedExpired,
            metrics: fetched.report,
          },
        } as object,
      },
    });
  }

  return {
    upserted: persisted.upserted,
    markedDeleted: persisted.markedDeleted,
    markedExpired: persisted.markedExpired,
    partial: fetched.partial,
    report: fetched.report,
    graphApiVersion: fetched.graphApiVersion,
  };
}

export type FacebookContentListItem = {
  id: string;
  contentType: string;
  publishedAt: string;
  captionExcerpt: string | null;
  permalinkUrl: string | null;
  thumbnailUrl: string | null;
  availability: string;
  reach: number | null;
  views: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  engagement: number | null;
  metricStatus: Record<string, string> | null;
};

/**
 * Client-safe content list — never includes externalObjectId / provider IDs.
 */
export async function listFacebookContentItems(options: {
  clientId: string;
  businessBrandId: string;
  socialAccountId: string;
  contentType: "post" | "reel" | "story";
  rangeStart: string;
  rangeEnd: string;
  sort?: "publishedAt_desc" | "publishedAt_asc" | "engagement_desc";
}): Promise<FacebookContentListItem[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  const rows = await prisma.socialContentItem.findMany({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      socialAccountId: options.socialAccountId,
      contentType: options.contentType,
      publishedAt: {
        gte: new Date(`${options.rangeStart}T00:00:00.000Z`),
        lte: new Date(`${options.rangeEnd}T23:59:59.999Z`),
      },
    },
    orderBy:
      options.sort === "publishedAt_asc"
        ? { publishedAt: "asc" }
        : options.sort === "engagement_desc"
          ? { engagement: "desc" }
          : { publishedAt: "desc" },
    select: {
      id: true,
      contentType: true,
      publishedAt: true,
      captionExcerpt: true,
      permalinkUrl: true,
      thumbnailUrl: true,
      availability: true,
      reach: true,
      views: true,
      reactions: true,
      comments: true,
      shares: true,
      engagement: true,
      metricStatus: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    contentType: row.contentType,
    publishedAt: row.publishedAt.toISOString(),
    captionExcerpt: row.captionExcerpt,
    permalinkUrl: row.permalinkUrl,
    thumbnailUrl: row.thumbnailUrl,
    availability: row.availability,
    reach: row.reach,
    views: row.views,
    reactions: row.reactions,
    comments: row.comments,
    shares: row.shares,
    engagement: row.engagement,
    metricStatus:
      row.metricStatus &&
      typeof row.metricStatus === "object" &&
      !Array.isArray(row.metricStatus)
        ? (row.metricStatus as Record<string, string>)
        : null,
  }));
}
