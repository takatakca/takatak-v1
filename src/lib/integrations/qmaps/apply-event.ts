// Applies a verified QMAPS event to TAKATAK local listings and reviews.
//
// Tenant safety: a QMAPS business only affects TAKATAK data once a TAKATAK
// admin has linked it to exactly one workspace in Admin › QMAPS (#171: a
// LocalListing with provider "qmaps" and metadata.qmapsBusinessId). Unlinked
// or ambiguous businesses are recorded as UNLINKED and change nothing. Every
// event id is processed at most once. No database change: QMAPS review ids
// live in ListingReview.metadata.qmapsReviewId, the key the reply form uses.

import { createHash } from "node:crypto";
import type { Prisma, ReviewSentiment } from "@prisma/client";

import type { QmapsEvent } from "./parser";

type TransactionClient = Pick<
  Prisma.TransactionClient,
  "localListing" | "listingReview" | "sourceSynchronizationEvent"
>;

export interface QmapsApplyDb {
  sourceSynchronizationEvent: Pick<Prisma.TransactionClient["sourceSynchronizationEvent"], "findUnique">;
  $transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>;
}

export class QmapsEventConflictError extends Error {
  constructor() {
    super("Event id was already used with a different payload.");
    this.name = "QmapsEventConflictError";
  }
}

export type QmapsApplyResult = {
  eventId: string;
  duplicate: boolean;
  status: "PROCESSED" | "UNLINKED";
  listingId?: string;
  reviewId?: string;
};

export function sentimentForRating(rating: number): ReviewSentiment {
  if (rating >= 4) return "positive";
  if (rating === 3) return "neutral";
  return "negative";
}

function businessIdOf(event: QmapsEvent): string {
  return event.eventType === "BUSINESS_UPSERTED" ? event.business.id : event.review.businessId;
}

function storedPayload(event: QmapsEvent): Prisma.InputJsonObject {
  // Business data is public QMAPS listing data; review text is not duplicated
  // into the synchronization log.
  if (event.eventType === "BUSINESS_UPSERTED") {
    return { eventType: event.eventType, business: event.business as unknown as Prisma.InputJsonObject };
  }
  return { eventType: event.eventType, reviewId: event.review.id, businessId: event.review.businessId };
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function applyQmapsEvent(
  db: QmapsApplyDb,
  event: QmapsEvent,
  rawBody: string,
  now = new Date(),
): Promise<QmapsApplyResult> {
  const payloadHash = createHash("sha256").update(rawBody, "utf8").digest("hex");

  const previous = await db.sourceSynchronizationEvent.findUnique({
    where: { eventId: event.eventId },
  });
  if (previous) {
    if (previous.payloadHash !== payloadHash) throw new QmapsEventConflictError();
    const response = (previous.responsePayload ?? {}) as Record<string, unknown>;
    return {
      eventId: event.eventId,
      duplicate: true,
      status: previous.status === "UNLINKED" ? "UNLINKED" : "PROCESSED",
      ...(typeof response.listingId === "string" ? { listingId: response.listingId } : {}),
      ...(typeof response.reviewId === "string" ? { reviewId: response.reviewId } : {}),
    };
  }

  return db.$transaction(async (tx) => {
    // take: 2 so a business linked to two workspaces is refused, never guessed.
    const linked = await tx.localListing.findMany({
      where: { provider: "qmaps", metadata: { path: ["qmapsBusinessId"], equals: businessIdOf(event) } },
      select: { id: true, clientId: true, businessBrandId: true, metadata: true },
      take: 2,
    });
    const listing = linked.length === 1 ? linked[0] : null;

    const record = async (
      status: "PROCESSED" | "UNLINKED",
      response: Prisma.InputJsonObject,
    ) => {
      await tx.sourceSynchronizationEvent.create({
        data: {
          eventId: event.eventId,
          eventType: event.eventType,
          sourceApplication: "qmaps",
          payloadHash,
          payload: storedPayload(event),
          responsePayload: response,
          status,
          processedAt: now,
        },
      });
    };

    if (!listing) {
      await record("UNLINKED", { reason: linked.length > 1 ? "business_linked_twice" : "business_not_linked" });
      return { eventId: event.eventId, duplicate: false, status: "UNLINKED" as const };
    }

    if (event.eventType === "BUSINESS_UPSERTED") {
      const b = event.business;
      const previousMetadata = objectOf(listing.metadata);
      await tx.localListing.update({
        where: { id: listing.id },
        data: {
          name: b.name,
          platformName: "QMAPS",
          category: b.category,
          phone: b.phone,
          website: b.website,
          addressLine1: b.address,
          city: b.city,
          region: b.region,
          postalCode: b.postalCode,
          ...(b.country ? { country: b.country === "CA" ? "Canada" : b.country } : {}),
          status: b.isActive ? "active_internal" : "archived",
          lastCheckedAt: now,
          metadata: {
            ...previousMetadata,
            qmaps: {
              avgRating: b.avgRating,
              reviewsCount: b.reviewsCount,
              isClaimed: b.isClaimed,
              isActive: b.isActive,
              syncedAt: now.toISOString(),
            },
          } as Prisma.InputJsonObject,
        },
      });
      await record("PROCESSED", { listingId: listing.id });
      return { eventId: event.eventId, duplicate: false, status: "PROCESSED" as const, listingId: listing.id };
    }

    if (event.eventType === "REVIEW_UPSERTED") {
      const r = event.review;
      const fields = {
        reviewerName: r.reviewerDisplayName,
        rating: r.rating,
        body: r.body,
        status: "needs_review" as const,
        sentiment: sentimentForRating(r.rating),
        reviewedAt: new Date(r.createdAt),
      };
      const existing = await tx.listingReview.findFirst({
        where: {
          provider: "qmaps",
          clientId: listing.clientId,
          metadata: { path: ["qmapsReviewId"], equals: r.id },
        },
        select: { id: true, metadata: true },
      });
      let reviewId: string;
      if (existing) {
        // Keep what TAKATAK added (for example a reply sent from the dashboard).
        await tx.listingReview.update({
          where: { id: existing.id },
          data: {
            ...fields,
            metadata: { ...objectOf(existing.metadata), source: "qmaps", qmapsReviewId: r.id } as Prisma.InputJsonObject,
          },
        });
        reviewId = existing.id;
      } else {
        const created = await tx.listingReview.create({
          data: {
            ...fields,
            clientId: listing.clientId,
            businessBrandId: listing.businessBrandId,
            localListingId: listing.id,
            provider: "qmaps",
            metadata: { source: "qmaps", qmapsReviewId: r.id },
          },
          select: { id: true },
        });
        reviewId = created.id;
      }
      await record("PROCESSED", { listingId: listing.id, reviewId });
      return {
        eventId: event.eventId,
        duplicate: false,
        status: "PROCESSED" as const,
        listingId: listing.id,
        reviewId,
      };
    }

    await tx.listingReview.updateMany({
      where: {
        provider: "qmaps",
        clientId: listing.clientId,
        metadata: { path: ["qmapsReviewId"], equals: event.review.id },
      },
      data: { status: "archived" },
    });
    await record("PROCESSED", { listingId: listing.id });
    return { eventId: event.eventId, duplicate: false, status: "PROCESSED" as const, listingId: listing.id };
  });
}
