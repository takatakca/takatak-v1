import type { Metadata } from "next";

import { MarketplaceSearchView } from "@/components/website/marketplace/MarketplaceSearchView";
import {
  MARKETPLACE_CATEGORIES,
  searchMarketplacePackages,
  shortestDelivery,
  startingPriceCents,
} from "@/lib/website/marketplace-catalog";

export const metadata: Metadata = {
  title: "Recherche · Search marketplace",
  alternates: { canonical: "/marketplace/search" },
};

function readValue(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
}

export default async function MarketplaceSearchPage({
  searchParams,
}: {
  searchParams: Promise<
    Record<
      string,
      string | string[] | undefined
    >
  >;
}) {
  const resolved =
    await searchParams;

  const query = readValue(
    resolved.q,
  );

  const category = readValue(
    resolved.category,
  );

  const sort =
    readValue(resolved.sort) ||
    "recommended";

  const results = [
    ...searchMarketplacePackages(
      query,
      category || undefined,
    ),
  ];

  if (sort === "price_asc") {
    results.sort(
      (left, right) =>
        startingPriceCents(left) -
        startingPriceCents(right),
    );
  }

  if (sort === "price_desc") {
    results.sort(
      (left, right) =>
        startingPriceCents(right) -
        startingPriceCents(left),
    );
  }

  if (sort === "delivery") {
    results.sort(
      (left, right) =>
        shortestDelivery(left) -
        shortestDelivery(right),
    );
  }

  return (
    <MarketplaceSearchView
      query={query}
      category={category}
      sort={sort}
      categories={MARKETPLACE_CATEGORIES}
      results={results}
    />
  );
}
