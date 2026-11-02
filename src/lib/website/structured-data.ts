// Organization + WebPage + WebSite JSON-LD for the public homepage. Only facts that are
// already published on the site (name, domain, support email) are included.

import { brand } from "./brand";
import { HOME_SEO, type HomeLanguage } from "./home-seo";

export function websiteStructuredData(origin: string, lang: HomeLanguage = "en"): string {
  const base = origin.replace(/\/+$/, "");
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${base}/#organization`,
        name: "Groupe TAKATAK",
        alternateName: brand.brandName,
        url: base,
        description: HOME_SEO[lang].description,
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
        "@type": "WebPage",
        "@id": `${base}/${lang === "fr" ? "?lang=fr" : ""}#webpage`,
        url: `${base}/${lang === "fr" ? "?lang=fr" : ""}`,
        name: HOME_SEO[lang].title,
        description: HOME_SEO[lang].description,
        inLanguage: lang === "fr" ? "fr-CA" : "en-CA",
        isPartOf: { "@id": `${base}/#website` },
        about: { "@id": `${base}/#organization` },
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
