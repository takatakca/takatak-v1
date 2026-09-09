import "server-only";

import {
  countBillablePostsThisMonth,
  loadClientSocialEntitlementContext,
} from "@/lib/billing/social/entitlement-gates";
import { getPrisma } from "@/lib/db/prisma";
import { resolveBrandSessionContext } from "@/lib/security/brand-context";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";
import type { PlanningPageData } from "@/lib/social/planning/planning-types";

export type {
  PlanningPageData,
  PlanningPost,
} from "@/lib/social/planning/planning-types";

function emptyPlanning(
  connectedPlatforms: string[],
): PlanningPageData {
  return {
    posts: [],
    connectedPlatforms,
    postsUsedThisMonth: 0,
    monthlyPostAllowance: null,
  };
}

export async function getSocialPlanningData(
  access: ClientScopedAccess,
): Promise<PlanningPageData> {
  const brand = await resolveBrandSessionContext(access);
  const active =
    brand.availableBrands.find(
      (item) => item.id === brand.activeBrandId,
    ) ?? null;
  const connectedPlatforms = active?.connectedPlatforms ?? [];

  const prisma = getPrisma();
  if (!prisma || !brand.activeBrandId) {
    return emptyPlanning(connectedPlatforms);
  }

  try {
    const [{ entitlements }, postsUsedThisMonth, posts] = await Promise.all([
      loadClientSocialEntitlementContext(prisma, access.activeClientId),
      countBillablePostsThisMonth(prisma, access.activeClientId),
      prisma.socialPost.findMany({
        where: {
          clientId: access.activeClientId,
          businessBrandId: brand.activeBrandId,
        },
        select: {
          id: true,
          platform: true,
          caption: true,
          status: true,
          scheduledAt: true,
        },
        orderBy: { scheduledAt: "asc" },
      }),
    ]);

    return {
      connectedPlatforms,
      postsUsedThisMonth,
      monthlyPostAllowance: entitlements.monthlyPostAllowance,
      posts: posts.map((post) => ({
        id: post.id,
        platform: post.platform,
        caption: post.caption,
        status: post.status,
        scheduledAt: post.scheduledAt?.toISOString() ?? null,
      })),
    };
  } catch (error) {
    console.error(
      "[planning-data] Query failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return emptyPlanning(connectedPlatforms);
  }
}
