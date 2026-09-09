import "server-only";

import type { Prisma } from "@prisma/client";

import {
  effectiveBrandAllowance,
  isKeepSelectionValid,
  planBrandFreeze,
  planScheduledPostBlocks,
} from "@/lib/billing/social/brand-allowance-policy";
import { resolveEffectiveSocialEntitlements } from "@/lib/billing/social/subscription-lifecycle";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

type DbClient =
  | Prisma.TransactionClient
  | {
      clientSubscription: Prisma.TransactionClient["clientSubscription"];
      businessBrand: Prisma.TransactionClient["businessBrand"];
      socialPost: Prisma.TransactionClient["socialPost"];
      auditLog: Prisma.TransactionClient["auditLog"];
    };

async function loadAllowanceContext(db: DbClient, clientId: string) {
  const [subscription, brands] = await Promise.all([
    db.clientSubscription.findUnique({
      where: { clientId },
      select: {
        status: true,
        planCode: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: true,
        xAccountAllowance: true,
        advancedAnalytics: true,
      },
    }),
    db.businessBrand.findMany({
      where: { clientId },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const { lifecycle, entitlements } = resolveEffectiveSocialEntitlements({
    status: subscription?.status,
    planCode: subscription?.planCode,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd,
    currentPeriodEnd: subscription?.currentPeriodEnd,
    addOns: {
      xAccountAllowance: subscription?.xAccountAllowance ?? 0,
      advancedAnalytics: subscription?.advancedAnalytics ?? false,
    },
  });

  const allowance = effectiveBrandAllowance(
    lifecycle.access,
    entitlements.brandAllowance,
    lifecycle.displayKey,
  );

  return {
    brands,
    allowance,
    monthlyPostAllowance: entitlements.monthlyPostAllowance,
    lifecycle,
    entitlements,
  };
}

export async function previewSocialBrandAllowance(clientId: string) {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError("unavailable", "Brand allowance is unavailable.");
  }

  const context = await loadAllowanceContext(prisma, clientId);
  const plan = planBrandFreeze(context.brands, context.allowance, null);

  return {
    ...plan,
    hasPaidPlan: context.lifecycle.access === "paid",
    brands: context.brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      status: brand.status,
      createdAt: brand.createdAt.toISOString(),
    })),
  };
}

export async function assertClientCanAddBrand(clientId: string): Promise<void> {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError("unavailable", "The brand service is unavailable.");
  }

  const context = await loadAllowanceContext(prisma, clientId);
  const billable = context.brands.filter(
    (brand) =>
      brand.status === "active" ||
      brand.status === "draft" ||
      brand.status === "paused",
  ).length;

  if (billable >= context.allowance) {
    throw new ServiceError(
      "forbidden",
      context.allowance === 0
        ? "This workspace cannot add brands while Social access is locked."
        : `This plan allows ${context.allowance} active brand${context.allowance === 1 ? "" : "s"}. Freeze another brand or upgrade to add more.`,
    );
  }
}

export async function applySocialBrandAllowance(options: {
  clientId: string;
  actorProfileId?: string | null;
  keepBrandIds?: string[] | null;
}): Promise<{
  frozenIds: string[];
  restoredIds: string[];
  blockedPostIds: string[];
}> {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError("unavailable", "Brand allowance is unavailable.");
  }

  return prisma.$transaction(async (transaction) => {
    const context = await loadAllowanceContext(transaction, options.clientId);
    const keepIds = options.keepBrandIds ?? null;

    if (keepIds) {
      if (!isKeepSelectionValid(context.brands, context.allowance, keepIds)) {
        throw new ServiceError(
          "invalid_input",
          "Select which brands to keep, up to this plan's allowance.",
        );
      }
    } else {
      const preview = planBrandFreeze(context.brands, context.allowance, null);
      if (preview.overAllowance) {
        throw new ServiceError(
          "invalid_input",
          "This plan covers fewer brands than you have. Choose which brands stay active.",
        );
      }
    }

    const plan = planBrandFreeze(context.brands, context.allowance, keepIds);

    if (plan.freezeIds.length > 0) {
      await transaction.businessBrand.updateMany({
        where: {
          clientId: options.clientId,
          id: { in: plan.freezeIds },
        },
        data: { status: "frozen" },
      });
    }

    if (plan.restoreIds.length > 0) {
      await transaction.businessBrand.updateMany({
        where: {
          clientId: options.clientId,
          id: { in: plan.restoreIds },
        },
        data: { status: "active" },
      });
    }

    const frozenIds = [
      ...plan.freezeIds,
      ...context.brands
        .filter(
          (brand) =>
            brand.status === "frozen" && !plan.restoreIds.includes(brand.id),
        )
        .map((brand) => brand.id),
    ];

    const posts = await transaction.socialPost.findMany({
      where: {
        clientId: options.clientId,
        status: "scheduled",
      },
      select: {
        id: true,
        businessBrandId: true,
        status: true,
        scheduledAt: true,
      },
    });

    const blockedPostIds = planScheduledPostBlocks({
      posts: posts.map((post) => ({
        id: post.id,
        brandId: post.businessBrandId,
        status: post.status,
        scheduledAt: post.scheduledAt,
      })),
      frozenBrandIds: frozenIds,
      monthlyPostAllowance: context.monthlyPostAllowance,
    });

    if (blockedPostIds.length > 0) {
      await transaction.socialPost.updateMany({
        where: {
          clientId: options.clientId,
          id: { in: blockedPostIds },
        },
        data: { status: "blocked_by_plan" },
      });
    }

    if (
      plan.freezeIds.length > 0 ||
      plan.restoreIds.length > 0 ||
      blockedPostIds.length > 0
    ) {
      await transaction.auditLog.create({
        data: {
          profileId: options.actorProfileId ?? null,
          clientId: options.clientId,
          action: "social_brand_allowance_applied",
          entityType: "Client",
          entityId: options.clientId,
          metadata: {
            freezeIds: plan.freezeIds,
            restoreIds: plan.restoreIds,
            blockedPostCount: blockedPostIds.length,
            allowance: context.allowance,
          },
        },
      });
    }

    return {
      frozenIds: plan.freezeIds,
      restoredIds: plan.restoreIds,
      blockedPostIds,
    };
  });
}
