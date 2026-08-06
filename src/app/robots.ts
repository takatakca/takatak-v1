import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://takatak.ca";

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