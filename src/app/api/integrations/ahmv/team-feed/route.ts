import { NextRequest, NextResponse } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import {
  AHMV_PUBLIC_TEAM_ID_RE,
  ahmvTeamIdFromServiceMetadata,
  bearerMatches,
  publicAhmvFeedItem,
  resolveAhmvTeamFeedAccess,
  type AhmvMappedService,
  type AhmvPublicContentRow,
} from "@/lib/integrations/ahmv-team-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: HEADERS });
}

export async function GET(request: NextRequest) {
  if (process.env.AHMV_TEAM_FEED_ENABLED !== "true") {
    return json({ status: "disabled", items: [] }, 503);
  }

  if (
    !bearerMatches(
      request.headers.get("authorization"),
      process.env.AHMV_TEAM_FEED_SHARED_TOKEN,
    )
  ) {
    return json({ status: "unauthorized", items: [] }, 401);
  }

  const teamId = request.nextUrl.searchParams.get("teamId") ?? "";
  if (!AHMV_PUBLIC_TEAM_ID_RE.test(teamId)) {
    return json({ status: "unknown_team", items: [] }, 404);
  }

  const headerTeamId = request.headers.get("x-ahmv-team-id") ?? "";
  if (headerTeamId !== teamId) {
    return json({ status: "team_mismatch", items: [] }, 400);
  }

  const prisma = getPrisma();
  if (!prisma) {
    return json({ status: "unavailable", items: [] }, 503);
  }

  // ServiceInstance.metadata is the existing binding surface between one
  // exact AHMV public team ID and one TAKATAK BusinessBrand. We read a bounded
  // set and fail closed on duplicates rather than guessing between tenants.
  const candidates = await prisma.serviceInstance.findMany({
    where: {
      serviceType: "social_media",
      businessBrandId: { not: null },
    },
    select: {
      clientId: true,
      businessBrandId: true,
      status: true,
      metadata: true,
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
    take: 500,
  });

  const matches = candidates.filter(
    (service) => ahmvTeamIdFromServiceMetadata(service.metadata) === teamId,
  );

  if (matches.length === 0) {
    return json({ status: "not_connected", items: [] }, 404);
  }

  if (matches.length > 1) {
    return json({ status: "ambiguous_mapping", items: [] }, 409);
  }

  const service = matches[0] as AhmvMappedService;
  const access = resolveAhmvTeamFeedAccess(service);

  if (access === "subscription_required") {
    return json({ status: "subscription_required", items: [] }, 402);
  }

  if (access !== "ready" || !service.businessBrandId) {
    return json({ status: "not_connected", items: [] }, 404);
  }

  const connectedAccounts = await prisma.socialAccount.count({
    where: {
      clientId: service.clientId,
      businessBrandId: service.businessBrandId,
      status: "connected",
      accessStatus: "available",
      platform: {
        in: ["facebook", "instagram", "tiktok", "x", "youtube"],
      },
    },
  });

  if (connectedAccounts === 0) {
    return json({ status: "not_connected", items: [] }, 404);
  }

  const rows = await prisma.socialContentItem.findMany({
    where: {
      clientId: service.clientId,
      businessBrandId: service.businessBrandId,
      availability: "available",
      permalinkUrl: { not: null },
      socialAccount: {
        status: "connected",
        accessStatus: "available",
        platform: {
          in: ["facebook", "instagram", "tiktok", "x", "youtube"],
        },
      },
    },
    select: {
      externalIdHash: true,
      publishedAt: true,
      captionExcerpt: true,
      permalinkUrl: true,
      thumbnailUrl: true,
      socialAccount: {
        select: { platform: true },
      },
    },
    orderBy: { publishedAt: "desc" },
    take: 20,
  });

  const items = (rows as AhmvPublicContentRow[])
    .map(publicAhmvFeedItem)
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return json({
    status: items.length > 0 ? "active" : "connected",
    teamId,
    items,
    source: "GROUPE TAKATAK",
  });
}
