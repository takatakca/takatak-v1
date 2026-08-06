import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GigDetailClient } from "@/components/website/marketplace/gig-detail-client";
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
      title:
        "Package not found — TAKATAK",
    };
  }

  return {
    title: `${pkg.title} — TAKATAK Marketplace`,
    description: pkg.description,
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

  const pkg =
    getMarketplacePackage(id);

  if (!pkg) {
    notFound();
  }

  return (
    <GigDetailClient
      pkg={pkg}
      related={relatedPackages(
        pkg,
        3,
      )}
    />
  );
}