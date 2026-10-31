import "server-only";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { readCockpit } from "./cockpit-model";

// All canonical data stays in V1. No child database, browser tenant selector,
// provider credential, email address or phone number is returned by this feed.
type CockpitDatabase = {
  reviewResponse: Pick<PrismaClient["reviewResponse"], "findMany">;
  externalReview: Pick<PrismaClient["externalReview"], "findMany">;
  listingReview: Pick<PrismaClient["listingReview"], "findMany">;
};
export async function getReviewCockpit(
  clientId: string,
  database?: CockpitDatabase,
) {
  const db = database ?? getPrisma();
  if (!db) throw new Error("database_unavailable");
  return readCockpit(clientId, {
    feedback: (tenant, take) =>
      db.reviewResponse.findMany({
        where: { clientId: tenant, profile: { clientId: tenant } },
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          rating: true,
          feedback: true,
          contactName: true,
          status: true,
          createdAt: true,
          profile: { select: { name: true } },
        },
      }),
    external: (tenant, take) =>
      db.externalReview.findMany({
        where: { clientId: tenant, location: { clientId: tenant } },
        orderBy: { externalCreateAt: "desc" },
        take,
        select: {
          id: true,
          source: true,
          reviewerName: true,
          rating: true,
          comment: true,
          externalCreateAt: true,
          replyComment: true,
          location: { select: { title: true } },
        },
      }),
    listing: (tenant, take) =>
      db.listingReview.findMany({
        where: {
          clientId: tenant,
          status: { notIn: ["archived", "internal_demo", "planned"] },
          provider: { not: "internal_demo" },
          OR: [
            { localListingId: null },
            { localListing: { clientId: tenant } },
          ],
        },
        orderBy: { reviewedAt: "desc" },
        take,
        select: {
          id: true,
          provider: true,
          reviewerName: true,
          rating: true,
          title: true,
          body: true,
          status: true,
          replyStatus: true,
          reviewedAt: true,
          createdAt: true,
          metadata: true,
          localListing: { select: { name: true } },
        },
      }),
  });
}
