import type { MetadataRoute } from "next";

import { MARKETPLACE_CATEGORIES } from "@/lib/website/marketplace-catalog";
import { MARKETPLACE_PACKAGES } from "@/lib/website/marketplace-catalog";
import { PUBLIC_SERVICES } from "@/lib/website/public-services";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://takatak.ca";

  const paths = [
    "",
    "/marketplace",
    "/marketplace/search",
    "/marketplace/post-project",
    "/domain",
    "/hosting",
    "/deals",
    "/privacy-manager",
    "/search",
  ];

  return [
    ...paths.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
      changeFrequency:
        path === ""
          ? ("weekly" as const)
          : ("monthly" as const),
      priority:
        path === "" ? 1 : 0.8,
    })),

    ...PUBLIC_SERVICES.map(
      (service) => ({
        url: `${baseUrl}/services/${service.slug}`,
        lastModified: new Date(),
        changeFrequency:
          "monthly" as const,
        priority: 0.7,
      }),
    ),

    ...MARKETPLACE_CATEGORIES.map(
      (category) => ({
        url: `${baseUrl}/marketplace/category/${category.slug}`,
        lastModified: new Date(),
        changeFrequency:
          "weekly" as const,
        priority: 0.7,
      }),
    ),

    ...MARKETPLACE_PACKAGES.map(
      (item) => ({
        url: `${baseUrl}/marketplace/gigs/${item.id}`,
        lastModified: new Date(),
        changeFrequency:
          "weekly" as const,
        priority: 0.6,
      }),
    ),
  ];
}