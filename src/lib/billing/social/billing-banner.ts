import "server-only";

import {
  resolveSocialBillingBanner,
  type SocialBillingBannerModel,
} from "@/lib/billing/social/billing-banner-policy";
import {
  resolveEffectiveSocialEntitlements,
} from "@/lib/billing/social/subscription-lifecycle";
import {
  effectiveBrandAllowance,
  planBrandFreeze,
} from "@/lib/billing/social/brand-allowance-policy";
import type { SocialEntitlements } from "@/lib/billing/social/types";
import { getPrisma } from "@/lib/db/prisma";

export type SocialShellBilling = {
  planName: string;
  hasPaidPlan: boolean;
  reports: boolean;
  analyticsHistoryDays: number | null;
  entitlements: SocialEntitlements;
  banner: SocialBillingBannerModel | null;
};

function periodEndLabel(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.toLocaleDateString("en-CA");
}

export async function getSocialShellBilling(
  clientId: string,
): Promise<SocialShellBilling | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  try {
    const [subscription, brands] = await Promise.all([
      prisma.clientSubscription.findUnique({
        where: { clientId },
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
      prisma.businessBrand.findMany({
        where: { clientId },
        select: {
          id: true,
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

    const freeze = planBrandFreeze(
      brands,
      effectiveBrandAllowance(
        lifecycle.access,
        entitlements.brandAllowance,
        lifecycle.displayKey,
      ),
      null,
    );
    const overAllowance = freeze.overAllowance;
    const billableCount = freeze.billableCount;

    return {
      planName: entitlements.planName,
      hasPaidPlan: lifecycle.access === "paid",
      reports: entitlements.reports,
      analyticsHistoryDays: entitlements.analyticsHistoryDays,
      entitlements,
      banner: resolveSocialBillingBanner({
        access: lifecycle.access,
        statusLabel: lifecycle.label,
        planName: entitlements.planName,
        cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd),
        periodEndLabel: periodEndLabel(subscription?.currentPeriodEnd),
        overAllowance,
        brandAllowance: entitlements.brandAllowance,
        billableCount,
      }),
    };
  } catch (error) {
    console.error(
      "[social-billing-banner] Could not load shell billing:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return null;
  }
}
