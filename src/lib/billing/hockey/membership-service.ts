import "server-only";

import {
  HOCKEY_MEMBERSHIP_CATALOG,
  isHockeyMembershipPlanCode,
} from "./plan-catalog";
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
      planName: null,
      displayWeeklyCad: null,
      features: [] as string[],
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
  const access = resolveHockeyMembershipAccess(membership?.status ?? null);

  if (!membership || !isHockeyMembershipPlanCode(membership.planCode)) {
    return {
      available: true as const,
      access: "blocked" as const,
      status: membership?.status ?? null,
      planCode: null,
      planName: null,
      displayWeeklyCad: null,
      currentPeriodEnd: membership?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: membership?.cancelAtPeriodEnd ?? false,
      features: [] as string[],
    };
  }

  const plan = HOCKEY_MEMBERSHIP_CATALOG[membership.planCode];

  return {
    available: true as const,
    access,
    status: membership.status,
    planCode: membership.planCode,
    planName: plan.planName,
    displayWeeklyCad: plan.displayWeeklyCad,
    currentPeriodEnd: membership.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: membership.cancelAtPeriodEnd,
    features: access === "paid" ? [...plan.features] : [],
  };
}
