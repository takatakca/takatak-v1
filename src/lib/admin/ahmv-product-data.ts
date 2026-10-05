import "server-only";

import { getPrisma } from "@/lib/db/prisma";

const ACCESS_STATUSES = ["active", "past_due", "grace_period"] as const;

function monthlyEquivalent(
  unitAmountMinor: number,
  interval: string,
  intervalCount: number,
): number {
  const count = Math.max(1, intervalCount);
  switch (interval) {
    case "day":
      return Math.round((unitAmountMinor * 365) / 12 / count);
    case "week":
      return Math.round((unitAmountMinor * 52) / 12 / count);
    case "month":
      return Math.round(unitAmountMinor / count);
    case "year":
      return Math.round(unitAmountMinor / 12 / count);
    default:
      return 0;
  }
}

export async function getAhmvAdminProductData() {
  const prisma = getPrisma();
  if (!prisma) {
    return {
      available: false as const,
      product: null,
      subscriptions: [],
      counts: {
        customers: 0,
        active: 0,
        pastDue: 0,
        canceled: 0,
        failed: 0,
      },
      estimatedMrrMinor: 0,
      contributions: {
        count: 0,
        grossMinor: 0,
        feesMinor: 0,
        netMinor: 0,
      },
    };
  }

  const now = new Date();
  const [product, subscriptionGroups, contributionAggregate] = await Promise.all([
    prisma.productCatalog.findUnique({
      where: { code: "ahmv" },
      select: {
        code: true,
        name: true,
        status: true,
        plans: {
          orderBy: { name: "asc" },
          select: {
            code: true,
            legacyCode: true,
            name: true,
            status: true,
            selfServeEligible: true,
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
            entitlements: {
              select: {
                entitlement: {
                  select: { code: true, name: true, active: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.hockeyMembership.groupBy({
      by: ["status", "planCode"],
      where: { sourceApplication: "ahmverdun" },
      _count: { _all: true },
    }),
    prisma.supportContribution.aggregate({
      where: { productCode: "ahmv", status: "paid" },
      _count: { _all: true },
      _sum: {
        amountMinor: true,
        feesMinor: true,
        netAmountMinor: true,
      },
    }),
  ]);

  let estimatedMrrMinor = 0;
  const planRows = product?.plans ?? [];

  for (const group of subscriptionGroups) {
    if (!ACCESS_STATUSES.includes(group.status as (typeof ACCESS_STATUSES)[number])) {
      continue;
    }
    const plan = planRows.find(
      (candidate) =>
        candidate.code === group.planCode ||
        candidate.legacyCode === group.planCode,
    );
    const price = plan?.prices[0];
    if (!price) continue;
    estimatedMrrMinor +=
      monthlyEquivalent(
        price.unitAmountMinor,
        price.billingInterval,
        price.intervalCount,
      ) * group._count._all;
  }

  const countStatus = (status: string) =>
    subscriptionGroups
      .filter((group) => group.status === status)
      .reduce((sum, group) => sum + group._count._all, 0);

  const active = subscriptionGroups
    .filter((group) =>
      ACCESS_STATUSES.includes(group.status as (typeof ACCESS_STATUSES)[number]),
    )
    .reduce((sum, group) => sum + group._count._all, 0);

  const customers = subscriptionGroups.reduce(
    (sum, group) => sum + group._count._all,
    0,
  );

  return {
    available: true as const,
    product: product
      ? {
          ...product,
          plans: product.plans.map((plan) => ({
            ...plan,
            price: plan.prices[0] ?? null,
            entitlements: plan.entitlements.map((row) => row.entitlement),
          })),
        }
      : null,
    subscriptions: subscriptionGroups.map((group) => ({
      status: group.status,
      planCode: group.planCode,
      count: group._count._all,
    })),
    counts: {
      customers,
      active,
      pastDue: countStatus("past_due"),
      canceled: countStatus("canceled"),
      failed: countStatus("expired") + countStatus("suspended"),
    },
    estimatedMrrMinor,
    contributions: {
      count: contributionAggregate._count._all,
      grossMinor: contributionAggregate._sum.amountMinor ?? 0,
      feesMinor: contributionAggregate._sum.feesMinor ?? 0,
      netMinor: contributionAggregate._sum.netAmountMinor ?? 0,
    },
  };
}
