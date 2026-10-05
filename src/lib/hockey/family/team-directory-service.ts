import "server-only";

import { HOCKEY_SOURCE_APPLICATION } from "@/lib/billing/hockey/membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import type { AhmvTeamDirectoryEnvelope } from "./team-directory-parser";

export async function applyAhmvTeamDirectory(
  envelope: AhmvTeamDirectoryEnvelope,
) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("hockey_team_directory_database_unavailable");
  }

  return prisma.$transaction(async (tx) => {
    for (const team of envelope.teams) {
      await tx.hockeyPublicTeam.upsert({
        where: {
          sourceApplication_teamId: {
            sourceApplication: HOCKEY_SOURCE_APPLICATION,
            teamId: team.teamId,
          },
        },
        update: {
          categorySlug: team.categorySlug,
          level: team.level,
          name: team.name,
          seasonCode: team.seasonCode,
          active: team.active,
          sourceUpdatedAt: envelope.occurredAt,
        },
        create: {
          sourceApplication: HOCKEY_SOURCE_APPLICATION,
          teamId: team.teamId,
          categorySlug: team.categorySlug,
          level: team.level,
          name: team.name,
          seasonCode: team.seasonCode,
          active: team.active,
          sourceUpdatedAt: envelope.occurredAt,
        },
      });
    }

    let deactivated = 0;
    if (envelope.mode === "full") {
      const activeTeamIds = envelope.teams
        .filter((team) => team.active)
        .map((team) => team.teamId);

      const result = await tx.hockeyPublicTeam.updateMany({
        where: {
          sourceApplication: HOCKEY_SOURCE_APPLICATION,
          active: true,
          ...(activeTeamIds.length > 0
            ? { teamId: { notIn: activeTeamIds } }
            : {}),
        },
        data: {
          active: false,
          sourceUpdatedAt: envelope.occurredAt,
        },
      });
      deactivated = result.count;
    }

    return {
      mode: envelope.mode,
      synchronized: envelope.teams.length,
      deactivated,
    };
  });
}
