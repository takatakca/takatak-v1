import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BusinessEcosystemSection } from "@/components/website/home/business-ecosystem-section";
import { FinalCtaSection } from "@/components/website/home/final-cta-section";
import { PremiumHero } from "@/components/website/home/premium-hero";
import { PremiumProcessSection } from "@/components/website/home/premium-process-section";
import { UpmindDomainSearch } from "@/components/website/domain/upmind-domain-search";
import { FeaturedServicesStrip } from "@/components/website/marketplace/featured-services-strip";
import { PopularServicesGrid } from "@/components/website/marketplace/popular-services-grid";
import { TrustBlock } from "@/components/website/marketplace/trust-block";
import { PromoMarquee } from "@/components/website/promotions/promo-marquee";
import { brand } from "@/lib/website/brand";

export const metadata: Metadata = {
  title:
    "TAKATAK — Launch, host, market, and automate your business",
  description: brand.tagline,
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return (
    <>
      <PremiumHero />

      <PromoMarquee />

      <section className="mx-auto max-w-5xl px-4 pt-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-slate-950 md:text-3xl">
            Find your perfect domain
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Instant availability search,
            registration, and DNS — fully
            managed through TAKATAK. From
            $19.99/year in CAD.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <UpmindDomainSearch />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-950 md:text-3xl">
              Popular services
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Hand-picked services from vetted
              TAKATAK freelancers.
            </p>
          </div>

          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
          >
            See all
            <ArrowRight size={14} />
          </Link>
        </div>

        <PopularServicesGrid />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <FeaturedServicesStrip />
      </section>

      <PremiumProcessSection />

      <BusinessEcosystemSection />

      <div className="mx-auto max-w-7xl px-4 py-16 pb-24 md:pb-28">
        <TrustBlock />
      </div>

      <FinalCtaSection />
    </>
  );
}