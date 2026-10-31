import type { Metadata } from "next";

import { FinalChapter } from "@/components/website/funnel/FinalChapter";
import { HomeFaq } from "@/components/website/funnel/HomeFaq";
import { HomeSectionNav } from "@/components/website/funnel/HomeSectionNav";
import { PlanConfigurator } from "@/components/website/funnel/PlanConfigurator";
import { PricingTabs } from "@/components/website/funnel/PricingTabs";
import { ServiceGallery } from "@/components/website/funnel/ServiceGallery";
import { StickyPlanDock } from "@/components/website/funnel/StickyPlanDock";
import { PhotoStories, QuickActions } from "@/components/website/funnel/Stories";
import { SuiteBento } from "@/components/website/funnel/SuiteBento";
import { TakbotSection } from "@/components/website/funnel/TakbotSection";
import { PremiumHero } from "@/components/website/premium/PremiumHero";
import { brand } from "@/lib/website/brand";
import { getApplicationOrigin } from "@/lib/config/app-origin";
import { HomePlanProvider } from "@/lib/website/home-plan";
import { HomeThemeRoot } from "@/lib/website/home-theme";
import { websiteStructuredData } from "@/lib/website/structured-data";

export const metadata: Metadata = {
  title: { absolute: "TAKATAK — Websites, domains, hosting & growth" },
  description: brand.tagline,
  alternates: {
    canonical: "/",
  },
};

// Homepage. The hero is the owner's design (Oct 2026) and stays as is.
// Below it (Oct 31 2026), light by default with a dark mode toggle: quick
// actions, photo stories, services gallery, plan configurator, TAK bot, product
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
        <HomeThemeRoot>
          <div id="core" className="relative" style={{ scrollMarginTop: "var(--tk-header-h, 64px)" }}>
            <HomeSectionNav />
            <QuickActions />
            <section id="home-services" aria-labelledby="home-services-title" style={{ scrollMarginTop: "calc(var(--tk-header-h, 64px) + 56px)" }}>
              <PhotoStories />
              <ServiceGallery />
            </section>
            <PlanConfigurator />
            <TakbotSection />
            <SuiteBento />
            <PricingTabs />
            <HomeFaq />
          </div>
          <FinalChapter />
          <StickyPlanDock />
        </HomeThemeRoot>
      </HomePlanProvider>
    </div>
  );
}
