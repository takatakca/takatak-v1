import "server-only";

import { getPrisma } from "@/lib/db/prisma";

import { resolveHockeyStripePriceId } from "./membership-policy";
import { getHockeyMemberPriceId } from "./stripe-env";

export const AHMV_PRODUCT_CODE = "ahmv" as const;
export const AHMV_ACCESS_ENTITLEMENT = "ahmv_access" as const;

export async function getAhmvCatalogPlan(planCode: string | null | undefined) {
  const prisma = getPrisma();
  if (!prisma || !planCode) return null;

  const now = new Date();
  const plan = await prisma.productPlan.findFirst({
    where: {
      product: { code: AHMV_PRODUCT_CODE, status: "active" },
      status: { in: ["active", "planned"] },
      OR: [{ code: planCode }, { legacyCode: planCode }],
    },
    select: {
      code: true,
      legacyCode: true,
      name: true,
      status: true,
      selfServeEligible: true,
      entitlements: {
        where: { entitlement: { active: true } },
        select: { entitlement: { select: { code: true } } },
      },
      prices: {
        where: {
          active: true,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        orderBy: { startsAt: "desc" },
        take: 1,
        select: {
          currency: true,
          unitAmountMinor: true,
          billingInterval: true,
          intervalCount: true,
          provider: true,
          providerPriceId: true,
        },
      },
    },
  });

  if (!plan) return null;

  return {
    code: plan.code,
    legacyCode: plan.legacyCode,
    name: plan.name,
    status: plan.status,
    selfServeEligible: plan.selfServeEligible,
    entitlements: plan.entitlements.map((item) => item.entitlement.code),
    price: plan.prices[0] ?? null,
  };
}

export async function getAhmvSelfServePlan(planCode: string) {
  const plan = await getAhmvCatalogPlan(planCode);
  if (!plan || plan.status !== "active" || !plan.selfServeEligible || !plan.price) {
    return null;
  }
  const stripePriceId = resolveHockeyStripePriceId({
    planCode: plan.code,
    legacyCode: plan.legacyCode,
    catalogProvider: plan.price.provider,
    catalogPriceId: plan.price.providerPriceId,
    memberPriceId: getHockeyMemberPriceId(),
  });
  if (!stripePriceId) return null;
  return { ...plan, stripePriceId };
}

export function hasAhmvEntitlement(
  entitlements: readonly string[],
  entitlement: string,
): boolean {
  return entitlements.includes(entitlement);
}


export async function getAhmvStripePriceMap(): Promise<
  Record<string, { planCode: string; planName: string }>
> {
  const prisma = getPrisma();
  if (!prisma) return {};

  const now = new Date();
  const prices = await prisma.productPrice.findMany({
    where: {
      provider: "stripe",
      active: true,
      providerPriceId: { not: null },
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      plan: {
        status: "active",
        product: { code: AHMV_PRODUCT_CODE, status: "active" },
      },
    },
    select: {
      providerPriceId: true,
      plan: { select: { code: true, name: true } },
    },
  });

  const result: Record<string, { planCode: string; planName: string }> = {};
  for (const price of prices) {
    if (price.providerPriceId) {
      result[price.providerPriceId] = {
        planCode: price.plan.code,
        planName: price.plan.name,
      };
    }
  }

  // The owner's live AHMV Member price (server variable) maps to the Member plan,
  // so its subscriptions are recognized even when the catalog row holds another ID.
  const member = await getAhmvCatalogPlan("hockey_member_weekly_10");
  if (member) {
    const memberPriceId = resolveHockeyStripePriceId({
      planCode: member.code,
      legacyCode: member.legacyCode,
      catalogProvider: null,
      catalogPriceId: null,
      memberPriceId: getHockeyMemberPriceId(),
    });
    if (memberPriceId) result[memberPriceId] = { planCode: member.code, planName: member.name };
  }
  return result;
}
