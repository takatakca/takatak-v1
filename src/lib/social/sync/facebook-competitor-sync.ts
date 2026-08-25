import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import {
  canRankCompetitors,
  computeFollowerDelta,
  createCompetitorPublicRef,
  probeCompetitorPublicFeed,
  probeFacebookCompetitorCapability,
  resolveFacebookCompetitorPage,
  type CompetitorCapabilityProbe,
} from "@/lib/social/providers/meta-competitors";
import { hashExternalCompetitorPageId } from "@/lib/social/providers/meta-competitors";

const MAX_COMPETITORS_PER_BRAND = 10;
const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;

export type CompetitorClientRow = {
  publicRef: string;
  displayLabel: string | null;
  pageName: string | null;
  profileImageUrl: string | null;
  category: string | null;
  availability: string;
  capabilityStatus: string;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastErrorCategory: string | null;
  lastErrorMessage: string | null;
  latestSnapshot: {
    snapshotDate: string;
    followerCount: number | null;
    followerFieldSource: string | null;
    publicPostCount: number | null;
    publicReactionsSum: number | null;
    publicCommentsSum: number | null;
    publicSharesSum: number | null;
    availability: string;
    retrievedAt: string;
  } | null;
  previousSnapshot: {
    snapshotDate: string;
    followerCount: number | null;
  } | null;
  followerDelta: number | null;
};

function snapshotDateUtc(now = new Date()): Date {
  const key = now.toISOString().slice(0, 10);
  return new Date(`${key}T00:00:00.000Z`);
}

/**
 * Client-safe list — never includes externalPageId / provider IDs / internal UUIDs.
 */
export async function listFacebookCompetitors(options: {
  clientId: string;
  businessBrandId: string;
}): Promise<{
  capability: CompetitorCapabilityProbe;
  competitors: CompetitorClientRow[];
  rankingAllowed: boolean;
}> {
  const prisma = getPrisma();
  const capability = await probeFacebookCompetitorCapability();

  if (!prisma) {
    return { capability, competitors: [], rankingAllowed: false };
  }

  const tracks = await prisma.socialCompetitorTrack.findMany({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      status: "active",
    },
    orderBy: { createdAt: "asc" },
    select: {
      publicRef: true,
      displayLabel: true,
      pageName: true,
      profileImageUrl: true,
      category: true,
      availability: true,
      capabilityStatus: true,
      lastSuccessAt: true,
      lastAttemptAt: true,
      lastErrorCategory: true,
      lastErrorMessage: true,
      snapshots: {
        orderBy: { snapshotAt: "desc" },
        take: 2,
        select: {
          snapshotDate: true,
          followerCount: true,
          followerFieldSource: true,
          publicPostCount: true,
          publicReactionsSum: true,
          publicCommentsSum: true,
          publicSharesSum: true,
          availability: true,
          retrievedAt: true,
        },
      },
    },
  });

  const competitors: CompetitorClientRow[] = tracks.map((track) => {
    const latest = track.snapshots[0] ?? null;
    const previous = track.snapshots[1] ?? null;
    return {
      publicRef: track.publicRef,
      displayLabel: track.displayLabel,
      pageName: track.pageName,
      profileImageUrl: track.profileImageUrl,
      category: track.category,
      availability: track.availability,
      capabilityStatus: track.capabilityStatus,
      lastSuccessAt: track.lastSuccessAt?.toISOString() ?? null,
      lastAttemptAt: track.lastAttemptAt?.toISOString() ?? null,
      lastErrorCategory: track.lastErrorCategory,
      lastErrorMessage: track.lastErrorMessage,
      latestSnapshot: latest
        ? {
            snapshotDate: latest.snapshotDate.toISOString().slice(0, 10),
            followerCount: latest.followerCount,
            followerFieldSource: latest.followerFieldSource,
            publicPostCount: latest.publicPostCount,
            publicReactionsSum: latest.publicReactionsSum,
            publicCommentsSum: latest.publicCommentsSum,
            publicSharesSum: latest.publicSharesSum,
            availability: latest.availability,
            retrievedAt: latest.retrievedAt.toISOString(),
          }
        : null,
      previousSnapshot: previous
        ? {
            snapshotDate: previous.snapshotDate.toISOString().slice(0, 10),
            followerCount: previous.followerCount,
          }
        : null,
      followerDelta: computeFollowerDelta(
        latest?.followerCount ?? null,
        previous?.followerCount ?? null,
      ),
    };
  });

  return {
    capability,
    competitors,
    rankingAllowed: false,
  };
}

export async function addFacebookCompetitor(options: {
  clientId: string;
  businessBrandId: string;
  input: string;
  selectedExternalPageId: string | null;
  displayLabel?: string | null;
}): Promise<CompetitorClientRow> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  const capability = await probeFacebookCompetitorCapability();
  if (capability.status !== "ready") {
    throw new ServiceError("forbidden", capability.reason, { status: 403 });
  }

  const activeCount = await prisma.socialCompetitorTrack.count({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      status: "active",
    },
  });
  if (activeCount >= MAX_COMPETITORS_PER_BRAND) {
    throw new ServiceError(
      "invalid_input",
      `You can track up to ${MAX_COMPETITORS_PER_BRAND} competitors per brand.`,
      { status: 400 },
    );
  }

  const resolved = await resolveFacebookCompetitorPage({
    input: options.input,
  });

  if (
    options.selectedExternalPageId &&
    resolved.externalPageId === options.selectedExternalPageId
  ) {
    throw new ServiceError(
      "invalid_input",
      "You cannot add the currently selected Facebook Page as its own competitor.",
      { status: 400 },
    );
  }

  const existing = await prisma.socialCompetitorTrack.findFirst({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      externalPageIdHash: resolved.externalPageIdHash,
    },
    select: { id: true, status: true, publicRef: true },
  });
  if (existing?.status === "active") {
    throw new ServiceError(
      "conflict",
      "That competitor is already tracked for this brand.",
      { status: 409 },
    );
  }

  const publicRef = existing?.publicRef ?? createCompetitorPublicRef();
  const now = new Date();
  const day = snapshotDateUtc(now);

  const track =
    existing?.status === "removed"
      ? await prisma.socialCompetitorTrack.update({
          where: { id: existing.id },
          data: {
            status: "active",
            displayLabel: options.displayLabel?.trim() || null,
            pageName: resolved.pageName,
            profileImageUrl: resolved.profileImageUrl,
            category: resolved.category,
            usernameCanonical: resolved.usernameCanonical,
            availability: "available",
            capabilityStatus: capability.status,
            lastAttemptAt: now,
            lastSuccessAt: now,
            lastErrorCategory: null,
            lastErrorMessage: null,
            nextRefreshAt: new Date(now.getTime() + REFRESH_INTERVAL_MS),
            graphApiVersion: resolved.graphApiVersion,
            externalPageId: resolved.externalPageId,
          },
        })
      : await prisma.socialCompetitorTrack.create({
          data: {
            clientId: options.clientId,
            businessBrandId: options.businessBrandId,
            publicRef,
            externalPageIdHash: resolved.externalPageIdHash,
            externalPageId: resolved.externalPageId,
            usernameCanonical: resolved.usernameCanonical,
            displayLabel: options.displayLabel?.trim() || null,
            pageName: resolved.pageName,
            profileImageUrl: resolved.profileImageUrl,
            category: resolved.category,
            status: "active",
            availability: "available",
            capabilityStatus: capability.status,
            lastAttemptAt: now,
            lastSuccessAt: now,
            nextRefreshAt: new Date(now.getTime() + REFRESH_INTERVAL_MS),
            graphApiVersion: resolved.graphApiVersion,
            metadata: {
              provider: "meta",
              kind: "public_competitor",
            },
          },
        });

  await prisma.socialCompetitorSnapshot.upsert({
    where: {
      competitorTrackId_snapshotDate: {
        competitorTrackId: track.id,
        snapshotDate: day,
      },
    },
    create: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      competitorTrackId: track.id,
      snapshotAt: now,
      snapshotDate: day,
      followerCount: resolved.followerCount,
      followerFieldSource: resolved.followerFieldSource,
      pageName: resolved.pageName,
      category: resolved.category,
      profileImageUrl: resolved.profileImageUrl,
      publicPostCount: null,
      publicReactionsSum: null,
      publicCommentsSum: null,
      publicSharesSum: null,
      availability: "confirmed",
      metricStatus: resolved.metricStatus,
      graphApiVersion: resolved.graphApiVersion,
      retrievedAt: now,
      metadata: { period: "public_point_in_time" },
    },
    update: {
      snapshotAt: now,
      followerCount: resolved.followerCount,
      followerFieldSource: resolved.followerFieldSource,
      pageName: resolved.pageName,
      category: resolved.category,
      profileImageUrl: resolved.profileImageUrl,
      availability: "confirmed",
      metricStatus: resolved.metricStatus,
      graphApiVersion: resolved.graphApiVersion,
      retrievedAt: now,
    },
  });

  logSocialOAuthEvent("facebook-competitor", {
    stage: "add",
    outcome: "ok",
    provider: "meta",
  });

  const listed = await listFacebookCompetitors({
    clientId: options.clientId,
    businessBrandId: options.businessBrandId,
  });
  const row = listed.competitors.find(
    (item) => item.publicRef === track.publicRef,
  );
  if (!row) {
    throw new ServiceError(
      "unavailable",
      "Competitor was saved but could not be reloaded.",
      { status: 500 },
    );
  }
  return row;
}

export async function renameFacebookCompetitor(options: {
  clientId: string;
  businessBrandId: string;
  publicRef: string;
  displayLabel: string | null;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }
  const updated = await prisma.socialCompetitorTrack.updateMany({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      publicRef: options.publicRef,
      status: "active",
    },
    data: {
      displayLabel: options.displayLabel?.trim() || null,
    },
  });
  if (updated.count === 0) {
    throw new ServiceError("not_found", "Competitor not found.", { status: 404 });
  }
}

export async function removeFacebookCompetitor(options: {
  clientId: string;
  businessBrandId: string;
  publicRef: string;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }
  const updated = await prisma.socialCompetitorTrack.updateMany({
    where: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      publicRef: options.publicRef,
      status: "active",
    },
    data: {
      status: "removed",
      nextRefreshAt: null,
      dispatchJobId: null,
    },
  });
  if (updated.count === 0) {
    throw new ServiceError("not_found", "Competitor not found.", { status: 404 });
  }
}

/**
 * Refresh one competitor snapshot via Meta. Preserves prior snapshots on failure.
 */
export async function refreshFacebookCompetitorSnapshot(options: {
  clientId: string;
  businessBrandId: string;
  trackId: string;
  generation: number;
  transport?: Parameters<typeof resolveFacebookCompetitorPage>[0]["transport"];
}): Promise<"ok" | "stale" | "skipped"> {
  const prisma = getPrisma();
  if (!prisma) return "skipped";

  const track = await prisma.socialCompetitorTrack.findFirst({
    where: {
      id: options.trackId,
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      status: "active",
      syncGeneration: options.generation,
    },
  });
  if (!track) return "skipped";

  const now = new Date();
  await prisma.socialCompetitorTrack.updateMany({
    where: { id: track.id, syncGeneration: options.generation },
    data: { lastAttemptAt: now },
  });

  try {
    const capability = await probeFacebookCompetitorCapability({
      transport: options.transport,
    });
    if (capability.status !== "ready") {
      await prisma.socialCompetitorTrack.updateMany({
        where: { id: track.id, syncGeneration: options.generation },
        data: {
          availability: track.lastSuccessAt ? "stale" : "unavailable",
          capabilityStatus: capability.status,
          lastErrorCategory: capability.status,
          lastErrorMessage: capability.reason.slice(0, 240),
        },
      });
      return "stale";
    }

    const resolved = await resolveFacebookCompetitorPage({
      input: track.usernameCanonical ?? track.externalPageId,
      transport: options.transport,
    });

    // Identity must remain the same Page.
    if (resolved.externalPageIdHash !== track.externalPageIdHash) {
      await prisma.socialCompetitorTrack.updateMany({
        where: { id: track.id, syncGeneration: options.generation },
        data: {
          availability: track.lastSuccessAt ? "stale" : "failed",
          lastErrorCategory: "identity_mismatch",
          lastErrorMessage:
            "Meta returned a different Page identity for this competitor.",
        },
      });
      return "stale";
    }

    const { getMetaAppAccessToken } = await import(
      "@/lib/social/providers/meta-competitors"
    );
    let feedResult = await probeCompetitorPublicFeed({
      externalPageId: track.externalPageId,
      appAccessToken: "",
      transport: options.transport,
      enabled: false,
    });
    if (capability.publicContent === "supported") {
      const token = await getMetaAppAccessToken();
      feedResult = await probeCompetitorPublicFeed({
        externalPageId: track.externalPageId,
        appAccessToken: token,
        transport: options.transport,
        enabled: true,
      });
    }

    const day = snapshotDateUtc(now);
    await prisma.socialCompetitorSnapshot.upsert({
      where: {
        competitorTrackId_snapshotDate: {
          competitorTrackId: track.id,
          snapshotDate: day,
        },
      },
      create: {
        clientId: options.clientId,
        businessBrandId: options.businessBrandId,
        competitorTrackId: track.id,
        snapshotAt: now,
        snapshotDate: day,
        followerCount: resolved.followerCount,
        followerFieldSource: resolved.followerFieldSource,
        pageName: resolved.pageName,
        category: resolved.category,
        profileImageUrl: resolved.profileImageUrl,
        publicPostCount: feedResult.postCount,
        publicReactionsSum: feedResult.reactionsSum,
        publicCommentsSum: feedResult.commentsSum,
        publicSharesSum: feedResult.sharesSum,
        availability:
          feedResult.status === "permission_denied" ? "partial" : "confirmed",
        metricStatus: {
          ...resolved.metricStatus,
          publicFeed: feedResult.status,
        },
        graphApiVersion: resolved.graphApiVersion,
        retrievedAt: now,
        metadata: { period: "public_point_in_time" },
      },
      update: {
        snapshotAt: now,
        followerCount: resolved.followerCount,
        followerFieldSource: resolved.followerFieldSource,
        pageName: resolved.pageName,
        category: resolved.category,
        profileImageUrl: resolved.profileImageUrl,
        publicPostCount: feedResult.postCount,
        publicReactionsSum: feedResult.reactionsSum,
        publicCommentsSum: feedResult.commentsSum,
        publicSharesSum: feedResult.sharesSum,
        availability:
          feedResult.status === "permission_denied" ? "partial" : "confirmed",
        metricStatus: {
          ...resolved.metricStatus,
          publicFeed: feedResult.status,
        },
        graphApiVersion: resolved.graphApiVersion,
        retrievedAt: now,
      },
    });

    await prisma.socialCompetitorTrack.updateMany({
      where: { id: track.id, syncGeneration: options.generation },
      data: {
        pageName: resolved.pageName,
        profileImageUrl: resolved.profileImageUrl,
        category: resolved.category,
        usernameCanonical: resolved.usernameCanonical ?? track.usernameCanonical,
        availability: "available",
        capabilityStatus: capability.status,
        lastSuccessAt: now,
        lastErrorCategory: null,
        lastErrorMessage: null,
        nextRefreshAt: new Date(now.getTime() + REFRESH_INTERVAL_MS),
        graphApiVersion: resolved.graphApiVersion,
        dispatchJobId: null,
      },
    });

    logSocialOAuthEvent("facebook-competitor", {
      stage: "snapshot_refresh",
      outcome: "ok",
      provider: "meta",
    });
    return "ok";
  } catch (error) {
    const category =
      error instanceof ServiceError
        ? error.code
        : "temporary";
    await prisma.socialCompetitorTrack.updateMany({
      where: { id: track.id, syncGeneration: options.generation },
      data: {
        availability: track.lastSuccessAt ? "stale" : "failed",
        lastErrorCategory: String(category).slice(0, 64),
        lastErrorMessage:
          error instanceof Error
            ? error.message.slice(0, 240)
            : "Competitor refresh failed.",
        nextRefreshAt: new Date(now.getTime() + REFRESH_INTERVAL_MS),
        dispatchJobId: null,
      },
    });
    logSocialOAuthEvent("facebook-competitor", {
      stage: "snapshot_refresh",
      outcome: "stale",
      provider: "meta",
    });
    return "stale";
  }
}

export function buildCompetitorBenchmark(options: {
  selectedLabel: string;
  selectedFollowers: number | null;
  selectedFollowersAsOf: string | null;
  competitors: CompetitorClientRow[];
}) {
  const rankingAllowed = canRankCompetitors({
    selectedFollowers: options.selectedFollowers,
    competitorFollowers: options.competitors.map(
      (row) => row.latestSnapshot?.followerCount ?? null,
    ),
  });

  return {
    selectedPage: {
      label: options.selectedLabel,
      followerCount: options.selectedFollowers,
      asOf: options.selectedFollowersAsOf,
      metricKind: "public_or_owned_lifetime_followers",
    },
    competitors: options.competitors.map((row) => ({
      publicRef: row.publicRef,
      label: row.displayLabel || row.pageName || "Competitor",
      followerCount: row.latestSnapshot?.followerCount ?? null,
      followerDelta: row.followerDelta,
      snapshotDate: row.latestSnapshot?.snapshotDate ?? null,
      availability: row.availability,
      publicPostCount: row.latestSnapshot?.publicPostCount ?? null,
      note:
        row.latestSnapshot?.followerCount == null
          ? "Follower count unavailable from Meta for this competitor."
          : null,
    })),
    rankingAllowed,
    rankingNotice: rankingAllowed
      ? null
      : "Rankings are hidden until every compared Page has a confirmed equivalent follower count from Meta.",
    unsupportedComparisons: [
      "reach",
      "impressions",
      "demographics",
      "clicks",
      "private_insights",
    ],
  };
}

export { hashExternalCompetitorPageId };
