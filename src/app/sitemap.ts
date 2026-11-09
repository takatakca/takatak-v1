import type { MetadataRoute } from "next";

import { getApplicationOrigin } from "@/lib/config/app-origin";
import { MARKETPLACE_CATEGORIES } from "@/lib/website/marketplace-catalog";
import { MARKETPLACE_PACKAGES } from "@/lib/website/marketplace-catalog";
import { servicePages } from "@/lib/website/service-pages";
import { homeLanguageAlternates } from "@/lib/website/home-seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getApplicationOrigin();

  const paths = [
    "",
    "/marketplace",
    "/marketplace/search",
    "/marketplace/post-project",
    "/domain",
    "/hosting",
    "/monitoring",
    "/deals",
    "/pricing",
    "/takbot",
    "/infolettre",
    "/free-tools",
    "/services",
    "/privacy-manager",
    "/search",
    "/about",
    "/contact",
    "/freelancers",
  ];

  return [
    ...paths.map((path) => ({
      url: `${baseUrl}${path}`,
      ...(path === "" ? { alternates: { languages: homeLanguageAlternates(baseUrl) } } : {}),
      lastModified: new Date(),
      changeFrequency:
        path === ""
          ? ("weekly" as const)
          : ("monthly" as const),
      priority:
        path === "" ? 1 : 0.8,
    })),

    {
      url: `${baseUrl}/?lang=fr`,
      alternates: { languages: homeLanguageAlternates(baseUrl) },
      changeFrequency: "weekly" as const,
      priority: 1,
    },

    // Services whose page lives elsewhere (/domain, /hosting) are listed once, above.
    ...servicePages.filter((service) => service.route === `/services/${service.slug}`).map((service) => ({
      url: `${baseUrl}${service.route}`,
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
