// Reviewer decisions on a SocialPost's latest Approval, tenant-scoped.

import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import {
  applyApprovalDecision,
  type ApprovalDecision,
} from "@/lib/social/publishing/publication-model";

export type DecisionResult =
  | { ok: true; approvalId: string; approvalStatus: string; postStatus: string }
  | { ok: false; reason: "not_found" | "approval_closed" | "post_not_reviewable" | "unavailable" };

const COMMENT_LIMIT = 2_000;

export async function decideSocialPostApproval(input: {
  clientId: string;
  socialPostId: string;
  reviewerProfileId: string | null;
  decision: ApprovalDecision;
  comment: string | null;
}): Promise<DecisionResult> {
  const prisma = getPrisma();
  if (!prisma) return { ok: false, reason: "unavailable" };
  const comment = input.comment?.trim().slice(0, COMMENT_LIMIT) || null;

  return prisma.$transaction(async (tx) => {
    const post = await tx.socialPost.findFirst({
      where: { id: input.socialPostId, clientId: input.clientId },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        approvals: {
          select: { id: true, status: true },
          orderBy: { requestedAt: "desc" },
          take: 1,
        },
      },
    });
    if (!post) return { ok: false, reason: "not_found" } as const;
    const approval = post.approvals[0];
    if (!approval) return { ok: false, reason: "not_found" } as const;

    const next = applyApprovalDecision({
      decision: input.decision,
      currentApprovalStatus: approval.status,
      currentPostStatus: post.status,
      scheduledAt: post.scheduledAt,
    });
    if (!next.ok) return { ok: false, reason: next.reason } as const;

    const now = new Date();
    const updated = await tx.approval.updateMany({
      where: { id: approval.id, clientId: input.clientId, status: approval.status },
      data: {
        status: next.approvalStatus,
        comments: comment ?? undefined,
        reviewedByProfileId: input.reviewerProfileId,
        reviewedAt: now,
      },
    });
    if (updated.count !== 1) return { ok: false, reason: "approval_closed" } as const;

    const moved = await tx.socialPost.updateMany({
      where: { id: post.id, clientId: input.clientId, status: post.status },
      data: { status: next.postStatus },
    });
    if (moved.count !== 1) {
      throw new ServiceError("conflict", "The post changed while it was being reviewed.");
    }
    return {
      ok: true,
      approvalId: approval.id,
      approvalStatus: next.approvalStatus,
      postStatus: next.postStatus,
    } as const;
  });
}
