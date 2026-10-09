import type { Metadata } from "next";

import { CoreCategoryBlocks } from "@/components/website/premium/CategoryBlock";
import { CategoryNavigator } from "@/components/website/premium/CategoryNavigator";
import { CoreIntro } from "@/components/website/premium/CoreIntro";
import { PremiumFinalCta } from "@/components/website/premium/PremiumFinalCta";
import { PremiumHero } from "@/components/website/premium/PremiumHero";
import { PriceTeaser } from "@/components/website/premium/PriceTeaser";
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

// Premium homepage (Oct 2026): hero, the TAKATAK core (website + 9 categories
// in the owner's order, with a sticky navigator), pricing teaser, final call to action.
export default function HomePage() {
  return (
    <div className="tk-page tk-premium brand-dark">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: websiteStructuredData(getApplicationOrigin()),
        }}
      />
      <PremiumHero />
      <div id="core" className="relative" style={{ scrollMarginTop: "var(--tk-header-h, 64px)" }}>
        <CoreIntro />
        <CategoryNavigator />
        <CoreCategoryBlocks />
      </div>
      <PriceTeaser />
      <PremiumFinalCta />
    </div>
  );
}
