import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CategoryResults } from "@/components/website/marketplace/category-results";
import {
  getMarketplaceCategory,
  getMarketplacePackages,
  MARKETPLACE_CATEGORIES,
} from "@/lib/website/marketplace-catalog";

export function generateStaticParams() {
  return MARKETPLACE_CATEGORIES.map(
    (category) => ({
      slug: category.slug,
    }),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const category =
    getMarketplaceCategory(slug);

  if (!category) {
    return {
      title:
        "Category not found — TAKATAK",
    };
  }

  return {
    title: `${category.name} — TAKATAK Marketplace`,
    description: `Browse ${category.name} packages on the TAKATAK marketplace.`,
  };
}

export default async function MarketplaceCategoryPage({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = await params;

  const category =
    getMarketplaceCategory(slug);

  if (!category) {
    notFound();
  }

  const packages =
    getMarketplacePackages(slug);

  return (
    <CategoryResults
      category={category}
      packages={packages}
    />
  );
}