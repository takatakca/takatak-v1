import "server-only";

import { resolveEffectiveSocialEntitlements } from "@/lib/billing/social";
import { getPrisma } from "@/lib/db/prisma";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";
import { readPublicationReceipt } from "@/lib/social/publishing/publication-model";

export type MyTasksTab = "open" | "pending" | "rejected" | "approved";

export function readMyTasksTab(
  value: string | string[] | undefined,
): MyTasksTab {
  const tab = Array.isArray(value) ? value[0] : value;
  if (
    tab === "pending" ||
    tab === "rejected" ||
    tab === "approved"
  ) {
    return tab;
  }
  return "open";
}

export type MyTaskItem = {
  id: string;
  status: string;
  comments: string | null;
  requestedAt: string;
  captionPreview: string;
  platform: string;
  brandName: string | null;
  socialPostId: string;
  postStatus: string;
  scheduledAt: string | null;
  publication: {
    state: "sending" | "confirmed" | "failed" | "uncertain" | "needs_reconnect" | null;
    remotePostId: string | null;
    permalinkUrl: string | null;
    errorMessage: string | null;
    confirmedAt: string | null;
  } | null;
};

export type MyTasksPageData =
  | {
      source: "database";
      approvalsEnabled: boolean;
      planName: string;
      canReview: boolean;
      tasks: MyTaskItem[];
    }
  | {
      source: "unavailable";
      message: string;
    };

function captionPreview(caption: string): string {
  const text = caption.trim();
  if (!text) {
    return "No caption";
  }
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

export async function getMyTasksPageData(
  access: ClientScopedAccess,
): Promise<MyTasksPageData> {
  const prisma = getPrisma();

  if (!prisma) {
    return {
      source: "unavailable",
      message: "Tasks could not be loaded.",
    };
  }

  try {
    const [subscription, approvals] = await Promise.all([
      prisma.clientSubscription.findUnique({
        where: { clientId: access.activeClientId },
        select: {
          status: true,
          planCode: true,
          planName: true,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: true,
          xAccountAllowance: true,
          advancedAnalytics: true,
        },
      }),
      prisma.approval.findMany({
        where: { clientId: access.activeClientId },
        select: {
          id: true,
          status: true,
          comments: true,
          requestedAt: true,
          socialPost: {
            select: {
              id: true,
              caption: true,
              platform: true,
              status: true,
              scheduledAt: true,
              metadata: true,
            },
          },
          businessBrand: {
            select: { name: true },
          },
        },
        orderBy: { requestedAt: "desc" },
      }),
    ]);

    const { entitlements } = resolveEffectiveSocialEntitlements({
      clientId: access.activeClientId,
      status: subscription?.status,
      planCode: subscription?.planCode,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd,
      currentPeriodEnd: subscription?.currentPeriodEnd,
      addOns: {
        xAccountAllowance: subscription?.xAccountAllowance ?? 0,
        advancedAnalytics: subscription?.advancedAnalytics ?? false,
      },
    });

    return {
      source: "database",
      approvalsEnabled: entitlements.approvals,
      planName: entitlements.planName,
      canReview: hasEffectivePermission(access, "approve_content"),
      tasks: approvals.map((approval) => {
        const receipt = readPublicationReceipt(approval.socialPost.metadata);
        return {
          id: approval.id,
          status: approval.status,
          comments: approval.comments,
          requestedAt: approval.requestedAt.toISOString().slice(0, 10),
          captionPreview: captionPreview(approval.socialPost.caption),
          platform: approval.socialPost.platform,
          brandName: approval.businessBrand?.name ?? null,
          socialPostId: approval.socialPost.id,
          postStatus: approval.socialPost.status,
          scheduledAt: approval.socialPost.scheduledAt?.toISOString() ?? null,
          publication: receipt
            ? {
                state: receipt.state,
                remotePostId: receipt.remotePostId,
                permalinkUrl: receipt.permalinkUrl,
                errorMessage: receipt.errorMessage,
                confirmedAt: receipt.confirmedAt,
              }
            : null,
        };
      }),
    };
  } catch (error) {
    console.error(
      "[my-tasks] Query failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return {
      source: "unavailable",
      message: "Tasks could not be loaded.",
    };
  }
}
