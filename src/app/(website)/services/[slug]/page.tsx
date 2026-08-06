import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicServicePage } from "@/components/website/services/public-service-page";
import {
  getPublicService,
  PUBLIC_SERVICES,
} from "@/lib/website/public-services";

export function generateStaticParams() {
  return PUBLIC_SERVICES.map(
    (service) => ({
      slug: service.slug,
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

  const service =
    getPublicService(slug);

  if (!service) {
    return {
      title: "Service not found",
    };
  }

  return {
    title: `${service.title} — TAKATAK`,
    description:
      service.shortDescription,
  };
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = await params;

  const service =
    getPublicService(slug);

  if (!service) {
    notFound();
  }

  return (
    <PublicServicePage
      service={service}
    />
  );
}