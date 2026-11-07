import type { MarketplacePackage } from "./marketplace-catalog";

/**
 * What a package card needs, taken from the real catalog (marketplace-catalog.ts) after the
 * server applies the database prices. Cards and the package page then show the same price.
 */
export type MarketplaceCard = Pick<MarketplacePackage, "id" | "title" | "category" | "categoryName" | "blurb" | "thumb"> & {
  tiers: { name: string; priceCents: number; deliveryDays: number }[];
};

export function toMarketplaceCard(p: MarketplacePackage): MarketplaceCard {
  return {
    id: p.id,
    title: p.title,
    category: p.category,
    categoryName: p.categoryName,
    blurb: p.blurb,
    thumb: p.thumb,
    tiers: p.tiers.map((t) => ({ name: t.name, priceCents: t.priceCents, deliveryDays: t.deliveryDays })),
  };
}

/** The cards for these ids, in this order; ids not in the catalog are skipped. */
export function pickCards(cards: readonly MarketplaceCard[], ids: readonly string[]): MarketplaceCard[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return ids.flatMap((id) => {
    const card = byId.get(id);
    return card ? [card] : [];
  });
}
