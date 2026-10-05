import { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import {
  ahmvScheduleFreshUntil,
  validateAhmvScheduleSnapshot,
} from "@/lib/integrations/ahmv/schedule-contract";
import {
  resolveAhmvTeamFeedAccess,
  type AhmvMappedService,
} from "@/lib/integrations/ahmv-team-feed";

export type AhmvOperationalCheck = {
  capability: "team_directory" | "schedule" | "ads_publisher" | "team_feed";
  ready: boolean;
  count: number;
  reason?: string;
  updatedAt?: string;
};

export type AhmvOperationalReadiness = {
  ready: boolean;
  checkedAt: string;
  checks: AhmvOperationalCheck[];
};

function metadataTeamIds(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const ahmv = (metadata as Record<string, unknown>).ahmv;
  if (!ahmv || typeof ahmv !== "object" || Array.isArray(ahmv)) return [];
  const record = ahmv as Record<string, unknown>;
  const ids = Array.isArray(record.publicTeamIds)
    ? record.publicTeamIds
    : typeof record.publicTeamId === "string"
      ? [record.publicTeamId]
      : [];
  return ids.filter(
    (value): value is string =>
      typeof value === "string" && /^\d{8,24}$/.test(value),
  );
}

export async function collectAhmvOperationalReadiness(
  now = new Date(),
): Promise<AhmvOperationalReadiness> {
  const prisma = getPrisma();
  if (!prisma) {
    const checks: AhmvOperationalCheck[] = [
      "team_directory",
      "schedule",
      "ads_publisher",
      "team_feed",
    ].map((capability) => ({
      capability: capability as AhmvOperationalCheck["capability"],
      ready: false,
      count: 0,
      reason: "database_unavailable",
    }));
    return { ready: false, checkedAt: now.toISOString(), checks };
  }

  const [teams, snapshot, publisher, services] =
    await Promise.all([
      prisma.hockeyPublicTeam.findMany({
        where: { sourceApplication: "ahmverdun", active: true },
        select: { teamId: true, updatedAt: true },
      }),
      prisma.ahmvScheduleSnapshot.findUnique({
        where: { tenant: "ahmverdun" },
        select: {
          status: true,
          sourceUpdatedAt: true,
          sourceUrl: true,
          eventCount: true,
          events: true,
        },
      }),
      prisma.adPublisher.findUnique({
        where: { code: "ahmv" },
        select: { status: true, domain: true, updatedAt: true },
      }),
      prisma.serviceInstance.findMany({
        where: {
          serviceType: "social_media",
          businessBrandId: { not: null },
        },
        select: {
          clientId: true,
          businessBrandId: true,
          status: true,
          metadata: true,
          updatedAt: true,
          businessBrand: {
            select: { status: true },
          },
          client: {
            select: {
              subscription: {
                select: {
                  status: true,
                  planCode: true,
                  cancelAtPeriodEnd: true,
                  currentPeriodEnd: true,
                  xAccountAllowance: true,
                  advancedAnalytics: true,
                },
              },
            },
          },
        },
      }),
    ]);

  const exactTeams = teams.filter((team) => /^\d{8,24}$/.test(team.teamId));
  const teamIds = new Set(exactTeams.map((team) => team.teamId));
  const directoryReady =
    exactTeams.length > 0 &&
    exactTeams.length === teams.length &&
    teamIds.size === exactTeams.length;

  const normalizedSnapshot = snapshot
    ? validateAhmvScheduleSnapshot(
        {
          status: snapshot.status,
          updatedAt: snapshot.sourceUpdatedAt.toISOString(),
          sourceUrl: snapshot.sourceUrl,
          events: snapshot.events,
        },
        now,
      )
    : null;
  const scheduleFreshUntil = normalizedSnapshot
    ? ahmvScheduleFreshUntil(normalizedSnapshot)
    : null;
  const scheduleReady =
    Boolean(snapshot && normalizedSnapshot && scheduleFreshUntil) &&
    now.getTime() <= scheduleFreshUntil!.getTime() &&
    ((snapshot?.status === "active" && (snapshot?.eventCount ?? 0) > 0) ||
      (snapshot?.status === "no_match" && snapshot?.eventCount === 0));

  const adsReady =
    publisher?.status === "active" && publisher.domain === "ahmverdun.ca";

  const mappedServices = services.filter((service) =>
    metadataTeamIds(service.metadata).some((teamId) => teamIds.has(teamId)),
  );
  const entitledServices = mappedServices.filter(
    (service) =>
      resolveAhmvTeamFeedAccess(service as AhmvMappedService) === "ready",
  );
  const entitledBrandIds = entitledServices
    .map((service) => service.businessBrandId)
    .filter((value): value is string => Boolean(value));

  const [connectedAccountCount, taggedContentCount] =
    entitledBrandIds.length > 0
      ? await Promise.all([
          prisma.socialAccount.count({
            where: {
              businessBrandId: { in: entitledBrandIds },
              status: "connected",
              accessStatus: "available",
              platform: {
                in: ["facebook", "instagram", "tiktok", "x", "youtube"],
              },
            },
          }),
          prisma.socialContentItem.count({
            where: {
              businessBrandId: { in: entitledBrandIds },
              availability: "available",
              metadata: {
                path: ["ahmv", "publicTeamIds"],
                not: Prisma.JsonNull,
              },
              socialAccount: {
                status: "connected",
                accessStatus: "available",
              },
            },
          }),
        ])
      : [0, 0];

  const teamFeedReady =
    entitledServices.length > 0 &&
    connectedAccountCount > 0 &&
    taggedContentCount > 0;

  const checks: AhmvOperationalCheck[] = [
    {
      capability: "team_directory",
      ready: directoryReady,
      count: exactTeams.length,
      reason: directoryReady
        ? undefined
        : "exact_team_directory_missing_or_invalid",
      updatedAt: teams
        .map((team) => team.updatedAt)
        .sort((a, b) => b.getTime() - a.getTime())[0]
        ?.toISOString(),
    },
    {
      capability: "schedule",
      ready: scheduleReady,
      count: snapshot?.eventCount ?? 0,
      reason: !snapshot
        ? "schedule_snapshot_missing"
        : scheduleReady
          ? undefined
          : "schedule_snapshot_stale_or_invalid",
      updatedAt: snapshot?.sourceUpdatedAt.toISOString(),
    },
    {
      capability: "ads_publisher",
      ready: adsReady,
      count: publisher ? 1 : 0,
      reason: adsReady
        ? undefined
        : "ahmv_publisher_missing_or_noncanonical",
      updatedAt: publisher?.updatedAt.toISOString(),
    },
    {
      capability: "team_feed",
      ready: teamFeedReady,
      count: taggedContentCount,
      reason:
        mappedServices.length === 0
          ? "social_service_team_mapping_missing"
          : entitledServices.length === 0
            ? "social_service_or_subscription_not_ready"
            : connectedAccountCount === 0
              ? "connected_social_account_missing"
              : taggedContentCount === 0
                ? "tagged_social_content_missing"
                : undefined,
      updatedAt: mappedServices
        .map((service) => service.updatedAt)
        .sort((a, b) => b.getTime() - a.getTime())[0]
        ?.toISOString(),
    },
  ];

  return {
    ready: checks.every((check) => check.ready),
    checkedAt: now.toISOString(),
    checks,
  };
}
