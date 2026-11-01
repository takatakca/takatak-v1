import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { QMAPS_BUSINESS_ID, readQmapsBusinessId } from "./bridge";
import {
  fetchQmapsReviewVisibility,
  type QmapsReadFailure,
} from "./reviews-api";
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export type QmapsVisibilityResult =
  | { ok: true; checked: number; archived: number; hasMore: boolean }
  | {
      ok: false;
      reason:
        | QmapsReadFailure
        | "invalid_listing"
        | "ambiguous_mapping"
        | "database_unavailable";
    };

/** Archive only explicit source-unavailable IDs, never absence from a list page. */
export async function reconcileQmapsReviewVisibility(
  clientId: string,
  listingId: string,
  database?: PrismaClient,
  fetchImpl: typeof fetch = fetch,
): Promise<QmapsVisibilityResult> {
  if (![clientId, listingId].every((id) => QMAPS_BUSINESS_ID.test(id)))
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
    select: { id: true, metadata: true },
  });
  if (!listing) return { ok: false, reason: "invalid_listing" };
  const metadata = object(listing.metadata),
    businessId = readQmapsBusinessId(metadata);
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
    typeof metadata.qmapsVisibilityCursor === "string" &&
    QMAPS_BUSINESS_ID.test(metadata.qmapsVisibilityCursor)
      ? metadata.qmapsVisibilityCursor
      : null;
  const rows = await db.listingReview.findMany({
    where: {
      clientId,
      localListingId: listingId,
      provider: "qmaps",
      status: { not: "archived" },
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    select: { id: true, metadata: true, updatedAt: true },
    orderBy: { id: "asc" },
    take: 101,
  });
  const batch = rows.slice(0, 100),
    hasMore = rows.length > 100;
  const candidates = batch.map((row) => ({
    localId: row.id,
    updatedAt: row.updatedAt,
    sourceId: object(row.metadata).qmapsReviewId,
  }));
  if (
    candidates.some(
      (row) =>
        typeof row.sourceId !== "string" ||
        !QMAPS_BUSINESS_ID.test(row.sourceId),
    )
  )
    return { ok: false, reason: "invalid_listing" };
  const ids = Array.from(
    new Set(candidates.map((row) => row.sourceId as string)),
  );
  const result = ids.length
    ? await fetchQmapsReviewVisibility(clientId, businessId, ids, fetchImpl)
    : { ok: true as const, unavailableReviewIds: [] };
  if (!result.ok) return result;
  return db.$transaction(async (tx) => {
    const current = await tx.localListing.findFirst({
      where: {
        ...scope,
        metadata: { path: ["qmapsBusinessId"], equals: businessId },
      },
      select: { id: true, metadata: true },
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
    let archived = 0;
    for (const row of candidates) {
      if (!result.unavailableReviewIds.includes(row.sourceId as string))
        continue;
      const changed = await tx.listingReview.updateMany({
        where: {
          id: row.localId,
          clientId,
          localListingId: listingId,
          provider: "qmaps",
          updatedAt: row.updatedAt,
          metadata: { path: ["qmapsReviewId"], equals: row.sourceId as string },
        },
        data: { status: "archived" },
      });
      archived += changed.count;
    }
    await tx.localListing.update({
      where: { id: listingId },
      data: {
        metadata: {
          ...object(current.metadata),
          qmapsVisibilityCursor: hasMore ? batch[batch.length - 1].id : null,
          ...(ids.length
            ? { qmapsVisibilityLastCheckedAt: new Date().toISOString() }
            : {}),
        } as Prisma.InputJsonObject,
      },
    });
    await tx.auditLog.create({
      data: {
        clientId,
        action: "reputation.qmaps.visibility",
        entityType: "local_listing",
        entityId: listingId,
        metadata: { checked: ids.length, archived, hasMore },
      },
    });
    return { ok: true as const, checked: ids.length, archived, hasMore };
  });
}
