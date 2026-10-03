import "server-only";

import { getPrisma } from "@/lib/db/prisma";

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
  if (
    !plan ||
    plan.status !== "active" ||
    !plan.selfServeEligible ||
    !plan.price ||
    !plan.price.providerPriceId
  ) {
    return null;
  }
  return plan;
}

export function hasAhmvEntitlement(
  entitlements: readonly string[],
  entitlement: string,
): boolean {
  return entitlements.includes(entitlement);
}
