import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { resolveBrandSessionContext } from "@/lib/security/brand-context";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";
import type { InboxPageData, InboxThread } from "@/lib/social/inbox/inbox-types";

export type {
  InboxKind,
  InboxPageData,
  InboxThread,
} from "@/lib/social/inbox/inbox-types";

export async function getSocialInboxData(
  access: ClientScopedAccess,
  requestedBrandId: string | null = null,
): Promise<InboxPageData> {
  const brand = await resolveBrandSessionContext(access, requestedBrandId);
  const active =
    brand.availableBrands.find(
      (item) => item.id === brand.activeBrandId,
    ) ?? null;

  const connectedPlatforms = active?.connectedPlatforms ?? [];
  const attentionPlatforms: string[] = [];

  if (active?.facebookSurface?.attentionRequired) {
    attentionPlatforms.push("facebook");
  }

  return {
    connectedPlatforms,
    attentionPlatforms,
    threads: await googleReviewThreads(access.activeClientId),
  };
}

/** Reviews imported from Google Business Profile for this workspace (newest first). */
const REVIEW_LIMIT = 100;

async function googleReviewThreads(clientId: string): Promise<InboxThread[]> {
  const prisma = getPrisma();
  if (!prisma) return [];
  try {
    const rows = await prisma.externalReview.findMany({
      where: { clientId },
      orderBy: { externalCreateAt: "desc" },
      take: REVIEW_LIMIT,
      select: {
        id: true,
        reviewerName: true,
        rating: true,
        comment: true,
        externalCreateAt: true,
        replyComment: true,
        location: { select: { title: true } },
      },
    });
    return rows.map((row) => {
      const stars = Math.min(5, Math.max(1, row.rating));
      const comment = row.comment?.trim() ?? "";
      return {
        id: `review:${row.id}`,
        senderName: row.reviewerName?.trim() || "Google",
        senderImageUrl: null,
        platform: "google_business",
        kind: "review" as const,
        preview: `${"★".repeat(stars)} ${comment}`.trim().slice(0, 160),
        body: comment,
        occurredAt: row.externalCreateAt.toISOString(),
        unread: false,
        unresolved: !row.replyComment?.trim(),
        rating: stars,
        reply: row.replyComment?.trim() || null,
        locationTitle: row.location.title,
        replyHref: "/dashboard/growth/reviews",
      };
    });
  } catch {
    console.error("[social-inbox] google reviews unavailable");
    return [];
  }
}
