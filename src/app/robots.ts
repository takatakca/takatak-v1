import type { MetadataRoute } from "next";

import { getApplicationOrigin } from "@/lib/config/app-origin";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getApplicationOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/verification",
        ],
      },
    ],

    sitemap: `${baseUrl}/sitemap.xml`,
  };
}