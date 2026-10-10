import "server-only";

import { getPrisma } from "@/lib/db/prisma";

import { PUBLIC_CATALOG_CODE, type CatalogPriceRow } from "./catalog-prices";

/** Active CAD prices for the public site. Empty when the catalog is not seeded. */
export async function loadPublicCatalogRows(): Promise<CatalogPriceRow[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const now = new Date();
    const prices = await prisma.productPrice.findMany({
      where: {
        active: true,
        currency: "CAD",
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        plan: {
          status: "active",
          product: { code: PUBLIC_CATALOG_CODE, status: "active" },
        },
      },
      orderBy: { startsAt: "desc" },
      select: {
        unitAmountMinor: true,
        currency: true,
        plan: { select: { code: true } },
      },
    });

    const rows: CatalogPriceRow[] = [];
    const seen = new Set<string>();
    for (const price of prices) {
      if (seen.has(price.plan.code)) continue;
      seen.add(price.plan.code);
      rows.push({
        planCode: price.plan.code,
        unitAmountMinor: price.unitAmountMinor,
        currency: price.currency,
      });
    }
    return rows;
  } catch (error) {
    console.error(
      "[catalog-prices] Public catalog could not be read.",
      error instanceof Error ? error.message : "unknown_error",
    );
    return [];
  }
}
