// Applies a verified QMAPS event to TAKATAK local listings and reviews.
//
// Tenant safety: a QMAPS business only affects TAKATAK data once a TAKATAK
// admin has linked it to a workspace (a LocalListing with provider "qmaps"
// and externalId = QMAPS business id). Unlinked events are recorded as
// UNLINKED and change nothing. Every event id is processed at most once.

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
    const listing = await tx.localListing.findUnique({
      where: { provider_externalId: { provider: "qmaps", externalId: businessIdOf(event) } },
      select: { id: true, clientId: true, businessBrandId: true, metadata: true },
    });

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
      await record("UNLINKED", { reason: "business_not_linked" });
      return { eventId: event.eventId, duplicate: false, status: "UNLINKED" as const };
    }

    if (event.eventType === "BUSINESS_UPSERTED") {
      const b = event.business;
      const previousMetadata =
        listing.metadata && typeof listing.metadata === "object" && !Array.isArray(listing.metadata)
          ? (listing.metadata as Record<string, unknown>)
          : {};
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
      const review = await tx.listingReview.upsert({
        where: { provider_externalId: { provider: "qmaps", externalId: r.id } },
        create: {
          clientId: listing.clientId,
          businessBrandId: listing.businessBrandId,
          localListingId: listing.id,
          provider: "qmaps",
          externalId: r.id,
          reviewerName: r.reviewerDisplayName,
          rating: r.rating,
          body: r.body,
          status: "needs_review",
          sentiment: sentimentForRating(r.rating),
          reviewedAt: new Date(r.createdAt),
          metadata: { source: "qmaps" },
        },
        update: {
          reviewerName: r.reviewerDisplayName,
          rating: r.rating,
          body: r.body,
          status: "needs_review",
          sentiment: sentimentForRating(r.rating),
          reviewedAt: new Date(r.createdAt),
        },
        select: { id: true, clientId: true },
      });
      if (review.clientId !== listing.clientId) {
        // A review id can never move between workspaces.
        throw new Error("qmaps_review_workspace_mismatch");
      }
      await record("PROCESSED", { listingId: listing.id, reviewId: review.id });
      return {
        eventId: event.eventId,
        duplicate: false,
        status: "PROCESSED" as const,
        listingId: listing.id,
        reviewId: review.id,
      };
    }

    await tx.listingReview.updateMany({
      where: {
        provider: "qmaps",
        externalId: event.review.id,
        clientId: listing.clientId,
      },
      data: { status: "archived" },
    });
    await record("PROCESSED", { listingId: listing.id });
    return { eventId: event.eventId, duplicate: false, status: "PROCESSED" as const, listingId: listing.id };
  });
}
