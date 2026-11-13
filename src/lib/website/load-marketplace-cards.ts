import "server-only";

import { pricePackagesFromCatalog } from "./catalog-prices";
import { loadPublicCatalogRows } from "./load-public-catalog";
import { MARKETPLACE_PACKAGES } from "./marketplace-catalog";
import { toMarketplaceCard, type MarketplaceCard } from "./marketplace-cards";

/** Every orderable package as a card, with the same database prices as its package page. */
export async function loadMarketplaceCards(): Promise<MarketplaceCard[]> {
  const rows = await loadPublicCatalogRows();
  return pricePackagesFromCatalog(MARKETPLACE_PACKAGES, rows).map(toMarketplaceCard);
}
