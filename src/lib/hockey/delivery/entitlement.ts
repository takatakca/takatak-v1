import "server-only";

import { getAhmvCatalogPlan } from "@/lib/billing/hockey/product-catalog-service";
import {
  HOCKEY_SOURCE_APPLICATION,
  resolveHockeyMembershipAccess,
} from "@/lib/billing/hockey/membership-policy";
import { isActiveSupporterGrant } from "@/lib/billing/hockey/premium-grant-policy";
import { getPrisma } from "@/lib/db/prisma";

export async function getIdentityHockeyFeatures(
  identityId: string,
  now = new Date(),
): Promise<Set<string>> {
  const prisma = getPrisma();
  if (!prisma) return new Set();

  const identity = await prisma.masterIdentity.findUnique({
    where: { id: identityId },
    select: {
      hockeyMemberships: {
        where: { sourceApplication: HOCKEY_SOURCE_APPLICATION },
        take: 1,
        select: { status: true, planCode: true },
      },
      hockeyPremiumGrants: {
        where: {
          sourceApplication: HOCKEY_SOURCE_APPLICATION,
          status: "active",
          revokedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { expiresAt: "desc" },
        take: 1,
        select: {
          status: true,
          planCode: true,
          activatedAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      },
    },
  });

  if (!identity) return new Set();

  const membership = identity.hockeyMemberships[0] ?? null;
  if (
    membership &&
    resolveHockeyMembershipAccess(membership.status) === "paid"
  ) {
    const plan = await getAhmvCatalogPlan(membership.planCode);
    if (plan) return new Set(plan.entitlements);
  }

  const grant = identity.hockeyPremiumGrants[0] ?? null;
  if (grant && isActiveSupporterGrant(grant, now)) {
    const plan = await getAhmvCatalogPlan(grant.planCode);
    if (plan) return new Set(plan.entitlements);
  }

  return new Set();
}
