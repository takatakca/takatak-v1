import type { MetadataRoute } from "next";

import { getApplicationOrigin } from "@/lib/config/app-origin";
import { MARKETPLACE_CATEGORIES } from "@/lib/website/marketplace-catalog";
import { MARKETPLACE_PACKAGES } from "@/lib/website/marketplace-catalog";
import { servicePages } from "@/lib/website/service-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getApplicationOrigin();

  const paths = [
    "",
    "/marketplace",
    "/marketplace/search",
    "/marketplace/post-project",
    "/domain",
    "/hosting",
    "/deals",
    "/pricing",
    "/services",
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

    ...servicePages.map((service) => ({
      url: `${baseUrl}/services/${service.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),

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