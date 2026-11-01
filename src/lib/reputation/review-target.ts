import "server-only";
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  QMAPS_BUSINESS_ID,
  matchesTrackedQmapsReview,
  readQmapsBusinessId,
} from "@/lib/qmaps/bridge";
import type { ReviewDraftSource } from "./review-target-model";
export { canonicalReviewReply } from "./review-target-model";
export type ReviewTarget = {
  id: string;
  source: ReviewDraftSource;
  author: string;
  location: string;
  rating: number | null;
  text: string;
  fingerprint: string;
  qmapsReviewId?: string;
  businessId?: string;
  replyText: string | null;
  replyAt: string | null;
  providerLocator?: string;
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export function reviewReplyHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
function target(input: Omit<ReviewTarget, "fingerprint">): ReviewTarget {
  return {
    ...input,
    fingerprint: reviewReplyHash(
      JSON.stringify([
        input.source,
        input.id,
        input.qmapsReviewId ?? null,
        input.businessId ?? null,
        input.providerLocator ?? null,
        input.rating,
        input.text,
        input.replyText,
      ]),
    ),
  };
}
export type ReviewTargetDatabase = Pick<
  PrismaClient,
  "externalReview" | "reviewResponse" | "listingReview" | "localListing"
>;
export async function resolveReviewTarget(
  db: ReviewTargetDatabase,
  clientId: string,
  source: ReviewDraftSource,
  id: string,
): Promise<ReviewTarget | null> {
  if (![clientId, id].every((value) => QMAPS_BUSINESS_ID.test(value)))
    return null;
  if (source === "google") {
    const row = await db.externalReview.findFirst({
      where: { id, clientId, source: "google", location: { clientId } },
      select: {
        id: true,
        externalId: true,
        rating: true,
        comment: true,
        reviewerName: true,
        replyComment: true,
        replyUpdatedAt: true,
        location: { select: { id: true, title: true, resourceName: true } },
      },
    });
    return row
      ? target({
          id: row.id,
          source,
          author: row.reviewerName || "Customer",
          location: row.location.title,
          providerLocator: `${row.location.id}:${row.location.resourceName}:${row.externalId}`,
          rating: row.rating,
          text: row.comment || "",
          replyText: row.replyComment,
          replyAt: row.replyUpdatedAt?.toISOString() ?? null,
        })
      : null;
  }
  if (source === "takatak") {
    const row = await db.reviewResponse.findFirst({
      where: { id, clientId, profile: { clientId } },
      select: {
        id: true,
        rating: true,
        feedback: true,
        contactName: true,
        profile: { select: { id: true, name: true } },
      },
    });
    return row
      ? target({
          id: row.id,
          source,
          author: row.contactName || "Customer",
          location: row.profile.name,
          providerLocator: row.profile.id,
          rating: row.rating,
          text: row.feedback || "",
          replyText: null,
          replyAt: null,
        })
      : null;
  }
  if (source !== "qmaps") return null;
  const row = await db.listingReview.findFirst({
    where: {
      id,
      clientId,
      provider: "qmaps",
      status: { notIn: ["archived", "planned", "internal_demo"] },
      localListing: {
        clientId,
        provider: "qmaps",
        status: { not: "archived" },
        OR: [{ businessBrandId: null }, { businessBrand: { clientId } }],
      },
    },
    select: {
      id: true,
      rating: true,
      body: true,
      reviewerName: true,
      metadata: true,
      localListing: { select: { id: true, name: true, metadata: true } },
    },
  });
  if (!row?.localListing) return null;
  const metadata = object(row.metadata),
    sourceId = metadata.qmapsReviewId,
    businessId = readQmapsBusinessId(row.localListing.metadata);
  if (
    typeof sourceId !== "string" ||
    !matchesTrackedQmapsReview(metadata, sourceId) ||
    !businessId ||
    metadata.source === "reviewed_import"
  )
    return null;
  const mappings = await db.localListing.findMany({
    where: {
      provider: "qmaps",
      metadata: { path: ["qmapsBusinessId"], equals: businessId },
    },
    select: { id: true },
    take: 2,
  });
  if (mappings.length !== 1 || mappings[0].id !== row.localListing.id)
    return null;
  return target({
    id: row.id,
    source,
    author: row.reviewerName || "QMAPS customer",
    location: row.localListing.name,
    providerLocator: row.localListing.id,
    rating: row.rating,
    text: row.body || "",
    qmapsReviewId: sourceId,
    businessId,
    replyText:
      metadata.replyState === "sent_to_qmaps" &&
      typeof metadata.replyText === "string"
        ? metadata.replyText
        : null,
    replyAt:
      metadata.replyState === "sent_to_qmaps" &&
      typeof metadata.repliedAt === "string" &&
      Number.isFinite(Date.parse(metadata.repliedAt))
        ? metadata.repliedAt
        : null,
  });
}
