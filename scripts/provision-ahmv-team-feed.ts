import { Prisma } from "@prisma/client";

import { getPrisma } from "../src/lib/db/prisma";
import { withAhmvPublicTeamIds } from "../src/lib/integrations/ahmv-team-feed-admin";

const EXPECTED_TEAM_COUNT = 24;
const CURRENT_SEASON = "2026-2027";
const APPLY = process.argv.includes("--apply");

async function main() {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("DATABASE_URL is required.");
  }

  const brands = await prisma.businessBrand.findMany({
    where: {
      status: "active",
      website: {
        in: [
          "https://ahmverdun.ca",
          "https://www.ahmverdun.ca",
        ],
      },
    },
    select: {
      id: true,
      clientId: true,
      name: true,
      website: true,
    },
    take: 2,
  });

  if (brands.length !== 1) {
    throw new Error(
      `Expected exactly one active canonical AHM Verdun brand, found ${brands.length}.`,
    );
  }
  const brand = brands[0]!;

  const teams = await prisma.hockeyPublicTeam.findMany({
    where: {
      sourceApplication: "ahmverdun",
      seasonCode: CURRENT_SEASON,
      active: true,
    },
    select: { teamId: true },
    orderBy: { teamId: "asc" },
  });

  const teamIds = [...new Set(teams.map((team) => team.teamId))];
  if (
    teams.length !== EXPECTED_TEAM_COUNT ||
    teamIds.length !== EXPECTED_TEAM_COUNT ||
    teamIds.some((teamId) => !/^\d{8,24}$/.test(teamId))
  ) {
    throw new Error(
      `Expected exactly ${EXPECTED_TEAM_COUNT} unique active AHMV ${CURRENT_SEASON} team IDs, found ${teamIds.length}.`,
    );
  }

  const existing = await prisma.serviceInstance.findUnique({
    where: {
      clientId_businessBrandId_serviceType: {
        clientId: brand.clientId,
        businessBrandId: brand.id,
        serviceType: "social_media",
      },
    },
    select: {
      id: true,
      status: true,
      metadata: true,
    },
  });

  if (existing && existing.status !== "planned") {
    throw new Error(
      `Refusing to modify existing Team Feed service in status ${existing.status}; use the authenticated admin workflow instead.`,
    );
  }

  const metadata = withAhmvPublicTeamIds(existing?.metadata, teamIds);

  const plan = {
    mode: APPLY ? "apply" : "dry-run",
    brand: {
      id: brand.id,
      name: brand.name,
      website: brand.website,
    },
    teamCount: teamIds.length,
    action: existing ? "update_planned_mapping" : "create_planned_service",
    existingServiceId: existing?.id ?? null,
    resultingStatus: "planned",
    activatesService: false,
    changesSubscription: false,
    connectsProvider: false,
  };

  if (!APPLY) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  const service = existing
    ? await prisma.serviceInstance.update({
        where: { id: existing.id },
        data: {
          metadata: metadata as Prisma.InputJsonValue,
        },
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

  if (service.status !== "planned") {
    throw new Error("Provisioned Team Feed service did not remain planned.");
  }

  console.log(JSON.stringify({
    ok: true,
    serviceId: service.id,
    status: service.status,
    teamCount: teamIds.length,
    activatesService: false,
    changesSubscription: false,
    connectsProvider: false,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "AHMV Team Feed provisioning failed.");
  process.exitCode = 1;
});
