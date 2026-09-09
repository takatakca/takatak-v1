import "server-only";

import { resolveEffectiveSocialEntitlements } from "@/lib/billing/social";
import { getPrisma } from "@/lib/db/prisma";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";

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
};

export type MyTasksPageData =
  | {
      source: "database";
      approvalsEnabled: boolean;
      planName: string;
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
            select: { caption: true, platform: true },
          },
          businessBrand: {
            select: { name: true },
          },
        },
        orderBy: { requestedAt: "desc" },
      }),
    ]);

    const { entitlements } = resolveEffectiveSocialEntitlements({
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
      tasks: approvals.map((approval) => ({
        id: approval.id,
        status: approval.status,
        comments: approval.comments,
        requestedAt: approval.requestedAt.toISOString().slice(0, 10),
        captionPreview: captionPreview(approval.socialPost.caption),
        platform: approval.socialPost.platform,
        brandName: approval.businessBrand?.name ?? null,
      })),
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
