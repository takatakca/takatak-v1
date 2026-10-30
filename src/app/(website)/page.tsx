import type { Metadata } from "next";

import { HomeFaq } from "@/components/website/funnel/HomeFaq";
import { HomeSectionNav } from "@/components/website/funnel/HomeSectionNav";
import { PlanBuilder } from "@/components/website/funnel/PlanBuilder";
import { PricingTabs } from "@/components/website/funnel/PricingTabs";
import { ServiceCarousel } from "@/components/website/funnel/ServiceCarousel";
import { StickyPlanDock } from "@/components/website/funnel/StickyPlanDock";
import { SuiteMarquee } from "@/components/website/funnel/SuiteMarquee";
import { SuiteShowcase } from "@/components/website/funnel/SuiteShowcase";
import { TakbotSection } from "@/components/website/funnel/TakbotSection";
import { PremiumFinalCta } from "@/components/website/premium/PremiumFinalCta";
import { PremiumHero } from "@/components/website/premium/PremiumHero";
import { brand } from "@/lib/website/brand";
import { getApplicationOrigin } from "@/lib/config/app-origin";
import { HomePlanProvider } from "@/lib/website/home-plan";
import { websiteStructuredData } from "@/lib/website/structured-data";

export const metadata: Metadata = {
  title: { absolute: "TAKATAK — Websites, domains, hosting & growth" },
  description: brand.tagline,
  alternates: {
    canonical: "/",
  },
};

// Homepage. The hero is the owner's design (Oct 2026) and stays as is.
// Below it (Oct 30 2026), one sign-up funnel in numbered sections with a
// sticky section menu: services carousel, plan builder, TAK bot, product
// suite, pricing, FAQ, and a plan dock that follows the visitor to /register.
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
      <HomePlanProvider>
        <div id="core" className="relative" style={{ scrollMarginTop: "var(--tk-header-h, 64px)" }}>
          <SuiteMarquee />
          <HomeSectionNav />
          <ServiceCarousel />
          <PlanBuilder />
          <TakbotSection />
          <SuiteShowcase />
          <PricingTabs />
          <HomeFaq />
        </div>
        <PremiumFinalCta />
        <StickyPlanDock />
      </HomePlanProvider>
    </div>
  );
}
