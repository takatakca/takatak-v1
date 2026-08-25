import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ServiceProductPage } from "@/components/website/services/ServiceProductPage";
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
    title: `${service.title.en} — TAKATAK`,
    description: service.tagline.en,
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

  return <ServiceProductPage page={service} />;
}
