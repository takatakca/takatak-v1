import type { Metadata } from "next";

import { TakatakEcosystemHero } from "@/components/website/home/TakatakEcosystemHero";
import { PromoMarquee } from "@/components/website/promotions/PromoMarquee";
import { TrendingProjectsRail } from "@/components/website/home/TrendingProjectsRail";
import { DiscoverySection } from "@/components/website/home/DiscoverySection";
import { PopularBusinessUpgrades } from "@/components/website/home/PopularBusinessUpgrades";
import { DomainHostingSpotlight } from "@/components/website/home/DomainHostingSpotlight";
import { PricingGateways } from "@/components/website/home/PricingGateways";
import { BusinessTransformationStage } from "@/components/website/home/BusinessTransformationStage";
import { ManagedDeliveryJourney } from "@/components/website/home/ManagedDeliveryJourney";
import { ConciergeSupportSection } from "@/components/website/home/ConciergeSupportSection";
import { FinalCtaSection } from "@/components/website/home/FinalCtaSection";
import { brand } from "@/lib/website/brand";

export const metadata: Metadata = {
  title:
    "TAKATAK — Business services marketplace: websites, domains, hosting & growth",
  description: brand.tagline,
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return (
    <>
      <TakatakEcosystemHero />
      <PromoMarquee />
      <TrendingProjectsRail />
      <DiscoverySection />
      <BusinessTransformationStage />
      <PopularBusinessUpgrades />
      <DomainHostingSpotlight />
      <PricingGateways />
      <ManagedDeliveryJourney />
      <ConciergeSupportSection />
      <FinalCtaSection />
    </>
  );
}
