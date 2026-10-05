import { getPrisma } from "../src/lib/db/prisma";
import {
  AHMV_PUBLIC_TEAMS,
  AHMV_PUBLIC_TEAM_SOURCE,
} from "../src/lib/hockey/public-team-directory";

async function main(): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("DATABASE_URL is required before seeding AHMV public teams.");
  }

  for (const team of AHMV_PUBLIC_TEAMS) {
    await prisma.hockeyPublicTeam.upsert({
      where: {
        sourceApplication_teamId: {
          sourceApplication: AHMV_PUBLIC_TEAM_SOURCE.sourceApplication,
          teamId: team.teamId,
        },
      },
      update: {
        categorySlug: team.categorySlug,
        level: team.level,
        name: team.name,
        seasonCode: AHMV_PUBLIC_TEAM_SOURCE.seasonCode,
        active: true,
      },
      create: {
        sourceApplication: AHMV_PUBLIC_TEAM_SOURCE.sourceApplication,
        teamId: team.teamId,
        categorySlug: team.categorySlug,
        level: team.level,
        name: team.name,
        seasonCode: AHMV_PUBLIC_TEAM_SOURCE.seasonCode,
        active: true,
      },
    });
  }

  console.log(
    `AHMV public team directory ready with ${AHMV_PUBLIC_TEAMS.length} exact team IDs.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
