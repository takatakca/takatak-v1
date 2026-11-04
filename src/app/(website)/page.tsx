import type { Metadata } from "next";

import { FinalChapter } from "@/components/website/funnel/FinalChapter";
import { HomeFaq } from "@/components/website/funnel/HomeFaq";
import { NewsletterSignup } from "@/components/website/funnel/NewsletterSignup";
import { HomeSectionNav } from "@/components/website/funnel/HomeSectionNav";
import { AiTeam } from "@/components/website/funnel/AiTeam";
import { DeviceShowcase } from "@/components/website/funnel/DeviceShowcase";
import { KineticMarquee } from "@/components/website/funnel/KineticMarquee";
import { LiveBand } from "@/components/website/funnel/LiveBand";
import { PhoneChapter } from "@/components/website/funnel/PhoneChapter";
import { OrderSheet } from "@/components/website/funnel/OrderSheet";
import { PlanConfigurator } from "@/components/website/funnel/PlanConfigurator";
import { PricingTabs } from "@/components/website/funnel/PricingTabs";
import { ServiceGallery } from "@/components/website/funnel/ServiceGallery";
import { StickyPlanDock } from "@/components/website/funnel/StickyPlanDock";
import { PhotoStories } from "@/components/website/funnel/Stories";
import { SuiteBento } from "@/components/website/funnel/SuiteBento";
import { TakbotSection } from "@/components/website/funnel/TakbotSection";
import { UpsellToast } from "@/components/website/funnel/UpsellToast";
import { PremiumHero } from "@/components/website/premium/PremiumHero";
import { GlowPointer } from "@/components/website/funnel/primitives";
import { homeLanguage, homeMetadata } from "@/lib/website/home-seo";
import { getApplicationOrigin } from "@/lib/config/app-origin";
import { HomePlanProvider } from "@/lib/website/home-plan";
import { HomeThemeRoot } from "@/lib/website/home-theme";
import { websiteStructuredData } from "@/lib/website/structured-data";

export async function generateMetadata({ searchParams }: {
  searchParams: Promise<{ lang?: string | string[] }>;
}): Promise<Metadata> {
  return homeMetadata(homeLanguage((await searchParams).lang), getApplicationOrigin());
}

// Homepage. Hero (owner, Nov 3 2026): plain words on the left, TAK-TAK on the
// right (one bar with voice, suggestions and the guided assistant, six starting
// points). Below it (Oct 31 2026), light by default with a dark mode toggle: photo stories, services gallery, plan configurator, TAK-TAK, product
// suite, pricing, FAQ, newsletter (own unchecked consent box), and a plan dock that follows the visitor to /register.
export default async function HomePage({ searchParams }: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const lang = homeLanguage((await searchParams).lang);
  return (
    <div className="tk-page tk-premium brand-dark">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: websiteStructuredData(getApplicationOrigin(), lang),
        }}
      />
      <HomePlanProvider>
        <PremiumHero />
        <HomeThemeRoot>
          <div id="core" className="relative" style={{ scrollMarginTop: "var(--tk-header-h, 64px)" }}>
            <HomeSectionNav />
            <LiveBand />
            <section id="home-services" aria-labelledby="home-services-title" style={{ scrollMarginTop: "calc(var(--tk-header-h, 64px) + 56px)" }}>
              <PhotoStories />
              <ServiceGallery />
            </section>
            <KineticMarquee />
            <PlanConfigurator />
            <TakbotSection />
            <AiTeam />
            <DeviceShowcase />
            <PhoneChapter />
            <SuiteBento />
            <PricingTabs />
            <HomeFaq />
            <NewsletterSignup />
          </div>
          <FinalChapter />
          <StickyPlanDock />
          <OrderSheet />
          <UpsellToast />
          <GlowPointer />
        </HomeThemeRoot>
      </HomePlanProvider>
    </div>
  );
}
