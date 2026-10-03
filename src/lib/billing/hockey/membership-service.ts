import "server-only";

import {
  AHMV_ACCESS_ENTITLEMENT,
  getAhmvCatalogPlan,
  hasAhmvEntitlement,
} from "./product-catalog-service";
import {
  HOCKEY_SOURCE_APPLICATION,
  resolveHockeyMembershipAccess,
} from "./membership-policy";
import { getPrisma } from "@/lib/db/prisma";

export async function getHockeyMembershipSnapshot(authUserId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    return {
      available: false as const,
      access: "blocked" as const,
      status: null,
      planCode: null,
      legacyPlanCode: null,
      planName: null,
      price: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      features: [] as string[],
      hasAhmvAccess: false,
    };
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId },
    select: {
      id: true,
      hockeyMemberships: {
        where: { sourceApplication: HOCKEY_SOURCE_APPLICATION },
        take: 1,
        select: {
          status: true,
          planCode: true,
          planName: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      },
    },
  });

  const membership = identity?.hockeyMemberships[0] ?? null;
  const billingAccess = resolveHockeyMembershipAccess(membership?.status ?? null);
  const catalogPlan = membership
    ? await getAhmvCatalogPlan(membership.planCode)
    : null;

  const features =
    billingAccess === "paid" && catalogPlan
      ? [...catalogPlan.entitlements]
      : [];
  const hasAhmvAccess =
    billingAccess === "paid" &&
    hasAhmvEntitlement(features, AHMV_ACCESS_ENTITLEMENT);

  return {
    available: true as const,
    identityId: identity?.id ?? null,
    access: hasAhmvAccess ? ("paid" as const) : ("blocked" as const),
    status: membership?.status ?? null,
    planCode: catalogPlan?.code ?? null,
    legacyPlanCode: membership?.planCode ?? null,
    planName: catalogPlan?.name ?? membership?.planName ?? null,
    price: catalogPlan?.price
      ? {
          currency: catalogPlan.price.currency,
          unitAmountMinor: catalogPlan.price.unitAmountMinor,
          billingInterval: catalogPlan.price.billingInterval,
          intervalCount: catalogPlan.price.intervalCount,
          provider: catalogPlan.price.provider,
          providerPriceId: catalogPlan.price.providerPriceId,
        }
      : null,
    currentPeriodEnd: membership?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: membership?.cancelAtPeriodEnd ?? false,
    features,
    hasAhmvAccess,
  };
}
