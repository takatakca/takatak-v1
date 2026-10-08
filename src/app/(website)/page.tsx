import type { Metadata } from "next";

import { HomeHero } from "@/components/website/home/HomeHero";
import { HomeEcosystemGrid } from "@/components/website/home/HomeEcosystemGrid";
import { HomeHowItWorks } from "@/components/website/home/HomeHowItWorks";
import { HomePricingTeaser } from "@/components/website/home/HomePricingTeaser";
import { FinalCtaSection } from "@/components/website/home/FinalCtaSection";
import { brand } from "@/lib/website/brand";
import { getApplicationOrigin } from "@/lib/config/app-origin";
import { websiteStructuredData } from "@/lib/website/structured-data";

export const metadata: Metadata = {
  title: { absolute: "TAKATAK — Websites, domains, hosting & growth" },
  description: brand.tagline,
  alternates: {
    canonical: "/",
  },
};

// Short homepage (Oct 2026): hero, services, how it works, pricing, final call to action.
export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: websiteStructuredData(getApplicationOrigin()),
        }}
      />
      <HomeHero />
      <HomeEcosystemGrid />
      <HomeHowItWorks />
      <HomePricingTeaser />
      <FinalCtaSection />
    </>
  );
}
