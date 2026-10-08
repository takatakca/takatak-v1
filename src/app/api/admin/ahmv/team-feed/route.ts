import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import {
  ahmvTeamIdsFromMetadata,
} from "@/lib/integrations/ahmv-team-feed";
import {
  normalizeAhmvPublicTeamIds,
  withAhmvPublicTeamIds,
} from "@/lib/integrations/ahmv-team-feed-admin";
import { requireAdminApiAccess } from "@/lib/security/api-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function uuid(value: unknown): string | null {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export async function PUT(request: Request) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;

  const prisma = getPrisma();
  if (!prisma) {
    return json({ ok: false, error: "database_unavailable" }, 503);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return json({ ok: false, error: "invalid_body" }, 400);
  }

  const body = raw as Record<string, unknown>;
  const teamIds = normalizeAhmvPublicTeamIds(body.teamIds);
  if (!teamIds) {
    return json({ ok: false, error: "invalid_team_ids" }, 400);
  }

  const knownTeams = await prisma.hockeyPublicTeam.findMany({
    where: {
      sourceApplication: "ahmverdun",
      active: true,
      teamId: { in: teamIds },
    },
    select: { teamId: true },
  });
  const knownIds = new Set(knownTeams.map((team) => team.teamId));
  const unknownIds = teamIds.filter((teamId) => !knownIds.has(teamId));
  if (unknownIds.length > 0) {
    return json({ ok: false, error: "unknown_team_ids", teamIds: unknownIds }, 400);
  }

  if (body.kind === "service") {
    const businessBrandId = uuid(body.businessBrandId);
    if (!businessBrandId) {
      return json({ ok: false, error: "invalid_business_brand_id" }, 400);
    }

    const brand = await prisma.businessBrand.findUnique({
      where: { id: businessBrandId },
      select: { id: true, clientId: true, status: true, name: true },
    });
    if (!brand || brand.status !== "active") {
      return json({ ok: false, error: "brand_unavailable" }, 404);
    }

    const existing = await prisma.serviceInstance.findUnique({
      where: {
        clientId_businessBrandId_serviceType: {
          clientId: brand.clientId,
          businessBrandId: brand.id,
          serviceType: "social_media",
        },
      },
      select: { id: true, metadata: true, status: true },
    });

    const metadata = withAhmvPublicTeamIds(existing?.metadata, teamIds);

    const service = existing
      ? await prisma.serviceInstance.update({
          where: { id: existing.id },
          data: { metadata: metadata as Prisma.InputJsonValue },
          select: { id: true, status: true, metadata: true },
        })
      : await prisma.serviceInstance.create({
          data: {
            clientId: brand.clientId,
            businessBrandId: brand.id,
            serviceType: "social_media",
            name: "AHMV Social Team Feed",
            status: "planned",
            metadata: metadata as Prisma.InputJsonValue,
          },
          select: { id: true, status: true, metadata: true },
        });

    return json({
      ok: true,
      kind: "service",
      serviceId: service.id,
      serviceStatus: service.status,
      businessBrandId: brand.id,
      teamIds: ahmvTeamIdsFromMetadata(service.metadata),
    });
  }

  if (body.kind === "content") {
    const socialContentItemId = uuid(body.socialContentItemId);
    if (!socialContentItemId) {
      return json({ ok: false, error: "invalid_social_content_item_id" }, 400);
    }

    const item = await prisma.socialContentItem.findUnique({
      where: { id: socialContentItemId },
      select: {
        id: true,
        clientId: true,
        businessBrandId: true,
        metadata: true,
      },
    });
    if (!item) {
      return json({ ok: false, error: "content_not_found" }, 404);
    }

    const service = await prisma.serviceInstance.findUnique({
      where: {
        clientId_businessBrandId_serviceType: {
          clientId: item.clientId,
          businessBrandId: item.businessBrandId,
          serviceType: "social_media",
        },
      },
      select: { metadata: true },
    });
    if (!service) {
      return json({ ok: false, error: "team_feed_service_not_configured" }, 409);
    }

    const allowedIds = new Set(ahmvTeamIdsFromMetadata(service.metadata));
    const outsideService = teamIds.filter((teamId) => !allowedIds.has(teamId));
    if (outsideService.length > 0) {
      return json(
        {
          ok: false,
          error: "team_ids_not_mapped_to_service",
          teamIds: outsideService,
        },
        409,
      );
    }

    const metadata = withAhmvPublicTeamIds(item.metadata, teamIds);
    const updated = await prisma.socialContentItem.update({
      where: { id: item.id },
      data: { metadata: metadata as Prisma.InputJsonValue },
      select: { id: true, metadata: true },
    });

    return json({
      ok: true,
      kind: "content",
      socialContentItemId: updated.id,
      teamIds: ahmvTeamIdsFromMetadata(updated.metadata),
    });
  }

  return json({ ok: false, error: "invalid_kind" }, 400);
}
