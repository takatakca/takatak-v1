// Public TAKATAK prices. ProductPrice.unitAmountMinor is CAD cents.
// Plan codes:
//   domain.domain-register, hosting.portfolio, websites.starter, social.starter, …
//   marketplace.<packageId>.<tier name>
//   marketplace.<packageId>.addon.<slug>
// A missing row keeps the price in pricing.ts or marketplace-packages.ts.

import {
  featuredPrices,
  pricing,
  pricingGroups,
  type FeaturedPrice,
  type PricingGroup,
} from "./pricing";

export const PUBLIC_CATALOG_CODE = "takatak_public";

export type CatalogPriceRow = {
  planCode: string;
  unitAmountMinor: number;
  currency: string;
};

export type PublicPricing = {
  pricing: typeof pricing;
  featuredPrices: FeaturedPrice[];
  pricingGroups: PricingGroup[];
};

const GROUP_FIELD = {
  domains: "domain",
  hosting: "hosting",
  websites: "websites",
  apps: "apps",
  branding: "branding",
  marketing: "marketing",
  social: "social",
  local: "local",
  leads: "leads",
  voip: "voip",
  ai: "ai",
  admin: "admin",
  design: "design",
} as const;

type LooseTier = {
  key: string;
  name: string;
  amount: number;
  cadence: "one-time" | "monthly" | "yearly" | "per-lead" | "custom";
  suffix?: string;
  description?: string;
};

type LoosePricing = {
  domain: { register: LooseTier; transfer: LooseTier };
  hosting: LooseTier[];
  websites: LooseTier[];
  apps: LooseTier[];
  branding: LooseTier[];
  marketing: LooseTier[];
  social: LooseTier[];
  local: LooseTier[];
  leads: LooseTier[];
  voip: LooseTier[];
  ai: LooseTier[];
  admin: LooseTier[];
  design: LooseTier[];
};

function patchPricing(rows: readonly CatalogPriceRow[]): LoosePricing {
  const amounts = acceptedMinor(rows);
  const next = structuredClone(pricing) as unknown as LoosePricing;
  const domainRegister = amounts.get("domain.domain-register");
  const domainTransfer = amounts.get("domain.domain-transfer");
  if (domainRegister !== undefined) next.domain.register.amount = domainRegister / 100;
  if (domainTransfer !== undefined) next.domain.transfer.amount = domainTransfer / 100;
  for (const field of Object.values(GROUP_FIELD)) {
    if (field === "domain") continue;
    for (const tier of next[field]) {
      const minor = amounts.get(`${field}.${tier.key}`);
      if (minor !== undefined) tier.amount = minor / 100;
    }
  }
  return next;
}

function acceptedMinor(rows: readonly CatalogPriceRow[]): Map<string, number> {
  const amounts = new Map<string, number>();
  for (const row of rows) {
    if (row.currency !== "CAD") continue;
    if (!Number.isInteger(row.unitAmountMinor) || row.unitAmountMinor < 0) continue;
    if (row.unitAmountMinor > 100_000_000) continue;
    if (!amounts.has(row.planCode)) amounts.set(row.planCode, row.unitAmountMinor);
  }
  return amounts;
}

function tiersFor(
  table: LoosePricing,
  field: (typeof GROUP_FIELD)[keyof typeof GROUP_FIELD],
): LooseTier[] {
  if (field === "domain") return [table.domain.register, table.domain.transfer];
  return table[field];
}

function featuredAmount(table: LoosePricing, key: string): number {
  switch (key) {
    case "domain":
      return table.domain.register.amount;
    case "hosting":
      return table.hosting[0].amount;
    case "website":
      return table.websites[0].amount;
    case "app":
      return table.apps[0].amount;
    case "marketing":
      return table.marketing[0].amount;
    case "social":
      return table.social[0].amount;
    case "local":
      return table.local[0].amount;
    case "leads":
      return table.leads[1].amount;
    case "voip":
      return table.voip[0].amount;
    case "ai":
      return table.ai[0].amount;
    case "logo":
      return table.branding[0].amount;
    case "design":
      return table.design[0].amount;
    default:
      return 0;
  }
}

export function presentCatalogPricing(rows: readonly CatalogPriceRow[]): PublicPricing {
  const table = patchPricing(rows);
  return {
    pricing: table as unknown as typeof pricing,
    featuredPrices: featuredPrices.map((item) => ({
      ...item,
      from: featuredAmount(table, item.key),
    })),
    pricingGroups: pricingGroups.map((group) => {
      const field = GROUP_FIELD[group.key as keyof typeof GROUP_FIELD];
      const tiers = tiersFor(table, field);
      return {
        ...group,
        tiers: tiers.map((tier) => ({
          key: tier.key,
          name: tier.name,
          amount: tier.amount,
          cadence: tier.cadence,
          suffix: "suffix" in tier ? tier.suffix : undefined,
          description: "description" in tier ? tier.description : undefined,
        })),
      };
    }),
  };
}

export function marketplaceTierCode(packageId: string, tierName: string): string {
  return `marketplace.${packageId}.${tierName}`;
}

export function marketplaceAddonCode(packageId: string, label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `marketplace.${packageId}.addon.${slug}`;
}

export function pricePackageFromCatalog<
  T extends {
    id: string;
    tiers: Array<{ name: string; priceCents: number }>;
    addons: Array<{ label: string; priceCents: number }>;
  },
>(pkg: T, rows: readonly CatalogPriceRow[]): T {
  const cents = acceptedMinor(rows);
  return {
    ...pkg,
    tiers: pkg.tiers.map((tier) => {
      const priceCents = cents.get(marketplaceTierCode(pkg.id, tier.name));
      return priceCents === undefined ? tier : { ...tier, priceCents };
    }),
    addons: pkg.addons.map((addon) => {
      const priceCents = cents.get(marketplaceAddonCode(pkg.id, addon.label));
      return priceCents === undefined ? addon : { ...addon, priceCents };
    }),
  };
}

export function pricePackagesFromCatalog<
  T extends {
    id: string;
    tiers: Array<{ name: string; priceCents: number }>;
    addons: Array<{ label: string; priceCents: number }>;
  },
>(packages: readonly T[], rows: readonly CatalogPriceRow[]): T[] {
  return packages.map((pkg) => pricePackageFromCatalog(pkg, rows));
}
