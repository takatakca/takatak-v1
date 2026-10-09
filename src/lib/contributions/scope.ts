import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import { AHMV_PUBLISHER } from "./publishers";

export async function ahmvContributionScope() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DATABASE_UNAVAILABLE");
  const brand = await prisma.businessBrand.findFirst({
    where: { website: { in: [AHMV_PUBLISHER.brandWebsite, "https://www.ahmverdun.ca"] }, status: "active" },
    select: { id: true, clientId: true, name: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!brand) throw new Error("AHMV_BRAND_NOT_CONFIGURED");
  return { prisma, brand };
}
