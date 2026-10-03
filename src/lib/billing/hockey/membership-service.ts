import "server-only";

import {
  HOCKEY_MEMBERSHIP_CATALOG,
  isHockeyMembershipPlanCode,
} from "./plan-catalog";
import {
  HOCKEY_SOURCE_APPLICATION,
  resolveHockeyMembershipAccess,
} from "./membership-policy";
import { isActiveSupporterGrant } from "./premium-grant-policy";
import { getPrisma } from "@/lib/db/prisma";

export async function getHockeyMembershipSnapshot(authUserId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    return {
      available: false as const,
      access: "blocked" as const,
      accessSource: null,
      status: null,
      planCode: null,
      planName: null,
      displayWeeklyCad: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      complimentaryUntil: null,
      availableThankYouWeeks: 0,
      features: [] as string[],
    };
  }

  const now = new Date();
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
      hockeyPremiumGrants: {
        where: {
          sourceApplication: HOCKEY_SOURCE_APPLICATION,
          status: { in: ["active", "available"] },
          revokedAt: null,
        },
        orderBy: { createdAt: "asc" },
        select: {
          status: true,
          planCode: true,
          grantedWeeks: true,
          activatedAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      },
    },
  });

  const membership = identity?.hockeyMemberships[0] ?? null;
  const stripeAccess =
    resolveHockeyMembershipAccess(membership?.status ?? null) === "paid";

  const activeGrant =
    identity?.hockeyPremiumGrants.find((grant) =>
      isActiveSupporterGrant(grant, now),
    ) ?? null;

  const availableThankYouWeeks =
    identity?.hockeyPremiumGrants
      .filter((grant) => grant.status === "available")
      .reduce((total, grant) => total + grant.grantedWeeks, 0) ?? 0;

  const access = stripeAccess || activeGrant ? "paid" : "blocked";
  const accessSource = stripeAccess
    ? ("stripe" as const)
    : activeGrant
      ? ("complimentary" as const)
      : null;

  const effectivePlanCode =
    stripeAccess && membership && isHockeyMembershipPlanCode(membership.planCode)
      ? membership.planCode
      : activeGrant && isHockeyMembershipPlanCode(activeGrant.planCode)
        ? activeGrant.planCode
        : membership && isHockeyMembershipPlanCode(membership.planCode)
          ? membership.planCode
          : null;

  const plan = effectivePlanCode
    ? HOCKEY_MEMBERSHIP_CATALOG[effectivePlanCode]
    : null;

  return {
    available: true as const,
    access,
    accessSource,
    status: membership?.status ?? null,
    planCode: effectivePlanCode,
    planName: plan?.planName ?? null,
    displayWeeklyCad: plan?.displayWeeklyCad ?? null,
    currentPeriodEnd: membership?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: membership?.cancelAtPeriodEnd ?? false,
    complimentaryUntil:
      accessSource === "complimentary"
        ? activeGrant?.expiresAt?.toISOString() ?? null
        : null,
    availableThankYouWeeks,
    features: access === "paid" && plan ? [...plan.features] : [],
  };
}
