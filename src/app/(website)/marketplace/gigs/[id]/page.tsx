import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GigDetailClient } from "@/components/website/marketplace/gig-detail-client";
import { pricePackageFromCatalog, pricePackagesFromCatalog } from "@/lib/website/catalog-prices";
import { loadPublicCatalogRows } from "@/lib/website/load-public-catalog";
import {
  getMarketplacePackage,
  MARKETPLACE_PACKAGES,
  relatedPackages,
} from "@/lib/website/marketplace-catalog";

export function generateStaticParams() {
  return MARKETPLACE_PACKAGES.map(
    (item) => ({
      id: item.id,
    }),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}): Promise<Metadata> {
  const { id } = await params;

  const pkg =
    getMarketplacePackage(id);

  if (!pkg) {
    return {
      title: "Package not found",
    };
  }

  return {
    title: `${pkg.title} — Marketplace`,
    description: pkg.description,
    alternates: { canonical: `/marketplace/gigs/${pkg.id}` },
  };
}

export default async function GigPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;
  const found = getMarketplacePackage(id);

  if (!found) {
    notFound();
  }

  const rows = await loadPublicCatalogRows();
  const pkg = pricePackageFromCatalog(found, rows);

  return (
    <GigDetailClient
      pkg={pkg}
      related={pricePackagesFromCatalog(relatedPackages(found, 3), rows)}
    />
  );
}