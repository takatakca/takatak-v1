import "server-only";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { parseReviewImport } from "./import-model";
import { stableReviewImportId } from "./import-id";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getReviewImportLocations(clientId: string) {
  if (!UUID.test(clientId)) throw new Error("invalid_workspace");
  const db = getPrisma();
  if (!db) throw new Error("database_unavailable");
  return db.localListing.findMany({
    where: {
      clientId,
      status: { notIn: ["archived", "planned"] },
      provider: { not: "internal_demo" },
      OR: [{ businessBrandId: null }, { businessBrand: { clientId } }],
    },
    select: { id: true, name: true, city: true, platformName: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 200,
  });
}

/** An authorized operator imports extracted review fields, never entire mailboxes. */
export async function importReviewedReviews(
  clientId: string,
  actorId: string,
  input: unknown,
  database?: PrismaClient,
) {
  if (!UUID.test(clientId) || !UUID.test(actorId))
    throw new Error("invalid_workspace");
  const parsed = parseReviewImport(input);
  if (!parsed.ok) return parsed;
  const { rows, listingId, provenance } = parsed;
  const db = database ?? getPrisma();
  if (!db) throw new Error("database_unavailable");
  return db.$transaction(async (tx) => {
    // Recheck related-object ownership in the write transaction, not from browser options.
    const listing = await tx.localListing.findFirst({
      where: {
        id: listingId,
        clientId,
        status: { notIn: ["archived", "planned"] },
        provider: { not: "internal_demo" },
        OR: [{ businessBrandId: null }, { businessBrand: { clientId } }],
      },
      select: { id: true, businessBrandId: true },
    });
    if (!listing)
      return {
        ok: false as const,
        error: "Choose an active listing in this workspace.",
      };
    const result = await tx.listingReview.createMany({
      skipDuplicates: true,
      data: rows.map((row) => ({
        id: stableReviewImportId(
          clientId,
          listingId,
          row.source,
          row.externalId,
        ),
        clientId,
        businessBrandId: listing.businessBrandId,
        localListingId: listing.id,
        provider: "future_provider" as const,
        reviewerName: row.author,
        rating: row.rating,
        body: row.text,
        reviewedAt: new Date(row.reviewedAt),
        status: "needs_review" as const,
        replyStatus: "not_replied" as const,
        metadata: {
          reputationProvider: row.source,
          source: "reviewed_import",
          ingestion: provenance,
          externalId: row.externalId,
          sourceUrl: row.url,
          importedBy: actorId,
          // Human-entered records never establish provider-verification or skew live-source averages.
          recommended: false,
          sourceVerified: false,
        },
      })),
    });
    // Counts only: do not duplicate review text or mail content into the audit log.
    await tx.auditLog.create({
      data: {
        clientId,
        profileId: actorId,
        action: "reputation.import.reviewed",
        entityType: "local_listing",
        entityId: listing.id,
        metadata: {
          provenance,
          submitted: rows.length,
          created: result.count,
          skipped: rows.length - result.count,
        },
      },
    });
    return {
      ok: true as const,
      created: result.count,
      skipped: rows.length - result.count,
    };
  });
}
