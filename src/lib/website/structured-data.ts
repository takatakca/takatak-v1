// Organization + WebSite JSON-LD for the public homepage. Only facts that are
// already published on the site (name, domain, support email) are included.

import { brand } from "./brand";

export function websiteStructuredData(origin: string): string {
  const base = origin.replace(/\/+$/, "");
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${base}/#organization`,
        name: brand.brandName,
        url: base,
        description: brand.positioning,
        email: brand.supportEmail,
        areaServed: "CA",
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: brand.supportEmail,
          availableLanguage: ["English", "French"],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        name: brand.brandName,
        url: base,
        inLanguage: ["en-CA", "fr-CA"],
        publisher: { "@id": `${base}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${base}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
  // Escape "<" so the payload can never close the surrounding <script> tag.
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}
