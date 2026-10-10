import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CategorySalesPage } from "@/components/website/premium/CategorySalesPage";
import { ServiceProductPage } from "@/components/website/services/ServiceProductPage";
import { SERVICE_SLUG_TO_CATEGORY } from "@/lib/website/core-categories";
import {
  getServicePage,
  servicePages,
} from "@/lib/website/service-pages";

export function generateStaticParams() {
  return servicePages.map((service) => ({
    slug: service.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getServicePage(slug);

  if (!service) {
    return { title: "Service not found" };
  }

  return {
    title: service.title.en,
    description: service.tagline.en,
    alternates: { canonical: `/services/${service.slug}` },
  };
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getServicePage(slug);

  if (!service) {
    notFound();
  }

  // The TAKATAK core categories get the premium sales page; other services keep theirs.
  const category = SERVICE_SLUG_TO_CATEGORY[service.slug];
  if (category) {
    return <CategorySalesPage categoryKey={category} />;
  }

  return <ServiceProductPage page={service} />;
}
