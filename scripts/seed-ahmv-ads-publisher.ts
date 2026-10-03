import { getPrisma } from "../src/lib/db/prisma";

const PUBLISHER_CODE = "ahmv";

const PLACEMENTS = [
  {
    code: "home-hero-01",
    name: "AHMV Home — Primary sponsor",
    pagePattern: "/",
    format: "responsive-display",
  },
  {
    code: "schedule-inline-01",
    name: "AHMV Schedule — Inline",
    pagePattern: "/horaires*",
    format: "responsive-display",
  },
  {
    code: "team-inline-01",
    name: "AHMV Team pages — Inline",
    pagePattern: "/equipes/*",
    format: "responsive-display",
  },
  {
    code: "news-inline-01",
    name: "AHMV News — Inline",
    pagePattern: "/nouvelles/*",
    format: "responsive-display",
  },
  {
    code: "gallery-inline-01",
    name: "AHMV Gallery — Inline",
    pagePattern: "/photos*",
    format: "responsive-display",
  },
] as const;

async function main(): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error(
      "DATABASE_URL is required before seeding the AHMV ADS publisher.",
    );
  }

  const publisher = await prisma.adPublisher.upsert({
    where: { code: PUBLISHER_CODE },
    update: {
      name: "AHM Verdun",
      domain: "ahmverdun.com",
      category: "hockey",
      country: "Canada",
      region: "Quebec",
      allowedOrigins: [
        "https://ahmverdun.com",
        "https://www.ahmverdun.com",
      ],
      status: "active",
    },
    create: {
      code: PUBLISHER_CODE,
      name: "AHM Verdun",
      domain: "ahmverdun.com",
      category: "hockey",
      country: "Canada",
      region: "Quebec",
      allowedOrigins: [
        "https://ahmverdun.com",
        "https://www.ahmverdun.com",
      ],
      status: "active",
    },
    select: { id: true, code: true, name: true },
  });

  for (const placement of PLACEMENTS) {
    await prisma.adPlacement.upsert({
      where: {
        publisherId_code: {
          publisherId: publisher.id,
          code: placement.code,
        },
      },
      update: {
        name: placement.name,
        pagePattern: placement.pagePattern,
        format: placement.format,
        status: "active",
      },
      create: {
        publisherId: publisher.id,
        code: placement.code,
        name: placement.name,
        pagePattern: placement.pagePattern,
        format: placement.format,
        status: "active",
      },
    });
  }

  console.log(
    `TAKATAK ADS publisher ${publisher.code} ready with ${PLACEMENTS.length} AHMV placements.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
