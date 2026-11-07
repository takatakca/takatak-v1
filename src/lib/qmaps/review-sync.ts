import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import {
  QMAPS_BUSINESS_ID,
  readQmapsBusinessId,
  readLinkState,
} from "./bridge";
import {
  fetchQmapsReviewPage,
  qmapsReviewCursor,
  qmapsTrackedReviewId,
  type QmapsReadFailure,
} from "./reviews-api";

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export async function getQmapsReviewConnections(clientId: string) {
  if (!QMAPS_BUSINESS_ID.test(clientId)) throw new Error("invalid_workspace");
  const db = getPrisma();
  if (!db) throw new Error("database_unavailable");
  const rows = await db.localListing.findMany({
    where: {
      clientId,
      provider: "qmaps",
      status: { not: "archived" },
      OR: [{ businessBrandId: null }, { businessBrand: { clientId } }],
    },
    select: { id: true, name: true, city: true, metadata: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 100,
  });
  return rows.flatMap((row) => {
    const businessId = readQmapsBusinessId(row.metadata);
    if (!businessId) return [];
    const metadata = object(row.metadata);
    return [
      {
        id: row.id,
        name: row.name,
        city: row.city,
        businessId,
        linkConfirmed: readLinkState(metadata) === "confirmed_on_qmaps",
        hasOlder: !!qmapsReviewCursor(metadata.qmapsReviewsNextCursor),
        lastPulledAt:
          typeof metadata.qmapsReviewsLastPulledAt === "string" &&
          Number.isFinite(Date.parse(metadata.qmapsReviewsLastPulledAt))
            ? metadata.qmapsReviewsLastPulledAt
            : null,
      },
    ];
  });
}
export type QmapsPullResult =
  | {
      ok: true;
      fetched: number;
      created: number;
      updated: number;
      skipped: number;
      hasMore: boolean;
    }
  | {
      ok: false;
      reason:
        | QmapsReadFailure
        | "invalid_listing"
        | "ambiguous_mapping"
        | "no_cursor"
        | "database_unavailable";
    };

export async function syncQmapsReviews(
  clientId: string,
  listingId: string,
  mode: "latest" | "older",
  database?: PrismaClient,
  fetchImpl: typeof fetch = fetch,
): Promise<QmapsPullResult> {
  if (
    ![clientId, listingId].every((id) => QMAPS_BUSINESS_ID.test(id)) ||
    !["latest", "older"].includes(mode)
  )
    return { ok: false, reason: "invalid_listing" };
  const db = database ?? getPrisma();
  if (!db) return { ok: false, reason: "database_unavailable" };
  const scope = {
    id: listingId,
    clientId,
    provider: "qmaps" as const,
    status: { not: "archived" as const },
    OR: [{ businessBrandId: null }, { businessBrand: { clientId } }],
  };
  const listing = await db.localListing.findFirst({
    where: scope,
    select: { id: true, metadata: true, businessBrandId: true },
  });
  if (!listing) return { ok: false, reason: "invalid_listing" };
  const metadata = object(listing.metadata);
  const businessId = readQmapsBusinessId(metadata);
  if (!businessId) return { ok: false, reason: "invalid_listing" };
  const mapping = {
    provider: "qmaps" as const,
    metadata: { path: ["qmapsBusinessId"], equals: businessId },
  };
  const linked = await db.localListing.findMany({
    where: mapping,
    select: { id: true },
    take: 2,
  });
  if (linked.length !== 1 || linked[0].id !== listingId)
    return { ok: false, reason: "ambiguous_mapping" };
  const cursor =
    mode === "older"
      ? qmapsReviewCursor(metadata.qmapsReviewsNextCursor)
      : null;
  if (mode === "older" && !cursor) return { ok: false, reason: "no_cursor" };
  const page = await fetchQmapsReviewPage(
    clientId,
    businessId,
    cursor,
    fetchImpl,
  );
  if (!page.ok) return page;
  return db.$transaction(async (tx) => {
    const current = await tx.localListing.findFirst({
      where: {
        ...scope,
        metadata: { path: ["qmapsBusinessId"], equals: businessId },
      },
      select: { id: true, metadata: true, businessBrandId: true },
    });
    if (!current)
      return { ok: false as const, reason: "invalid_listing" as const };
    const stillLinked = await tx.localListing.findMany({
      where: mapping,
      select: { id: true },
      take: 2,
    });
    if (stillLinked.length !== 1 || stillLinked[0].id !== listingId)
      return { ok: false as const, reason: "ambiguous_mapping" as const };
    let created = 0,
      updated = 0,
      skipped = 0;
    for (const row of page.reviews) {
      const existing = await tx.listingReview.findFirst({
        where: {
          clientId,
          localListingId: listingId,
          provider: "qmaps",
          metadata: { path: ["qmapsReviewId"], equals: row.id },
        },
        select: { id: true, metadata: true },
      });
      const prior = object(existing?.metadata);
      if (
        typeof prior.qmapsSourceUpdatedAt === "string" &&
        Date.parse(prior.qmapsSourceUpdatedAt) > Date.parse(row.updatedAt)
      ) {
        skipped++;
        continue;
      }
      const sourceReply = !!row.ownerReply?.trim() && !!row.ownerRepliedAt;
      const preserveNewReply =
        typeof prior.repliedAt === "string" &&
        Date.parse(prior.repliedAt) > Date.parse(row.updatedAt);
      const reply = preserveNewReply
        ? {
            replyText: prior.replyText ?? null,
            replyState: prior.replyState ?? "not_sent",
            repliedAt: prior.repliedAt,
          }
        : sourceReply
          ? {
              replyText: row.ownerReply,
              replyState: "sent_to_qmaps",
              repliedAt: row.ownerRepliedAt,
            }
          : {
              replyText:
                prior.replyState === "not_sent"
                  ? (prior.replyText ?? null)
                  : null,
              replyState: "not_sent",
              repliedAt: null,
            };
      const confirmed = reply.replyState === "sent_to_qmaps";
      const data = {
        reviewerName: "QMAPS customer",
        rating: row.rating,
        body: row.body,
        reviewedAt: new Date(row.createdAt),
        status: "needs_review" as const,
        replyStatus: confirmed
          ? ("replied_internal" as const)
          : reply.replyText
            ? ("draft_reply" as const)
            : ("not_replied" as const),
        sentiment:
          row.rating >= 4
            ? ("positive" as const)
            : row.rating === 3
              ? ("neutral" as const)
              : ("negative" as const),
        metadata: {
          ...prior,
          ...reply,
          source: "qmaps",
          qmapsReviewId: row.id,
          qmapsSourceUpdatedAt: row.updatedAt,
          qmapsPulledAt: new Date().toISOString(),
        } as Prisma.InputJsonObject,
      };
      if (existing) {
        await tx.listingReview.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await tx.listingReview.create({
          data: {
            ...data,
            id: qmapsTrackedReviewId(clientId, listingId, row.id),
            clientId,
            businessBrandId: current.businessBrandId,
            localListingId: listingId,
            provider: "qmaps",
          },
        });
        created++;
      }
    }
    await tx.localListing.update({
      where: { id: listingId },
      data: {
        status: "active_internal",
        lastCheckedAt: new Date(),
        metadata: {
          ...object(current.metadata),
          qmapsReviewsLastPulledAt: new Date().toISOString(),
          qmapsReviewsNextCursor: page.nextCursor,
          qmapsReviewsWindowSize: page.reviews.length,
        } as Prisma.InputJsonObject,
      },
    });
    await tx.auditLog.create({
      data: {
        clientId,
        action: "reputation.qmaps.pull",
        entityType: "local_listing",
        entityId: listingId,
        metadata: {
          mode,
          fetched: page.reviews.length,
          created,
          updated,
          skipped,
          hasMore: !!page.nextCursor,
        },
      },
    });
    return {
      ok: true as const,
      fetched: page.reviews.length,
      created,
      updated,
      skipped,
      hasMore: !!page.nextCursor,
    };
  });
}
