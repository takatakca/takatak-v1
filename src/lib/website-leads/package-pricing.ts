// Server-side pricing of a marketplace package order. The browser sends only
// identifiers (package, tier, add-on labels, promo code); prices always come
// from the TAKATAK catalog, never from client-supplied totals.

import { getMarketplacePackage } from "@/lib/website/marketplace-catalog";

export type PackageOrderSelection = {
  packageId: string;
  tierName: string;
  addonLabels: string[];
  promoCode: string | null;
};

export type PricedPackageOrder = {
  packageId: string;
  title: string;
  category: string;
  tierName: string;
  deliveryDays: number;
  tierPriceCents: number;
  addons: { label: string; priceCents: number }[];
  subtotalCents: number;
  promoCode: string | null;
  discountCents: number;
  totalCents: number;
};

/** Promotions honoured at checkout (mirrors the marketplace UI). */
const PROMOTIONS: Record<string, number> = { FIRST10: 0.1 };

export function priceMarketplaceOrder(selection: PackageOrderSelection): PricedPackageOrder | null {
  const pkg = getMarketplacePackage(selection.packageId);
  if (!pkg) return null;
  const tier = pkg.tiers.find((item) => item.name === selection.tierName);
  if (!tier) return null;

  const uniqueLabels = [...new Set(selection.addonLabels)];
  const addons: { label: string; priceCents: number }[] = [];
  for (const label of uniqueLabels) {
    const addon = pkg.addons.find((item) => item.label === label);
    if (!addon) return null;
    addons.push({ label: addon.label, priceCents: addon.priceCents });
  }

  const subtotalCents = tier.priceCents + addons.reduce((sum, item) => sum + item.priceCents, 0);
  const promoCode = selection.promoCode ? selection.promoCode.toUpperCase() : null;
  const rate = promoCode ? PROMOTIONS[promoCode] ?? 0 : 0;
  const discountCents = Math.round(subtotalCents * rate);

  return {
    packageId: pkg.id,
    title: pkg.title,
    category: pkg.category,
    tierName: tier.name,
    deliveryDays: tier.deliveryDays,
    tierPriceCents: tier.priceCents,
    addons,
    subtotalCents,
    promoCode: rate > 0 ? promoCode : null,
    discountCents,
    totalCents: subtotalCents - discountCents,
  };
}
