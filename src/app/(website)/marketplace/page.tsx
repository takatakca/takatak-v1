import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { FeaturedServicesStrip } from "@/components/website/marketplace/featured-services-strip";
import { HowItWorks } from "@/components/website/marketplace/how-it-works";
import { MarketplaceCategoryGrid } from "@/components/website/marketplace/marketplace-category-grid";
import { MarketplaceHero } from "@/components/website/marketplace/marketplace-hero";
import { PopularServicesGrid } from "@/components/website/marketplace/popular-services-grid";
import { TrustBlock } from "@/components/website/marketplace/trust-block";
import { WorkflowsBlock } from "@/components/website/marketplace/workflows-block";

export const metadata: Metadata = {
  title:
    "TAKATAK Marketplace — Hire vetted talent",
  description:
    "Logos, websites, content, automation and more, delivered through TAKATAK.",
};

export default function MarketplacePage() {
  return (
    <>
      <MarketplaceHero />

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-12 md:py-16">
        <section>
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
              href="/marketplace/post-project"
              className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700"
            >
              Post a custom project
              <ArrowRight size={14} />
            </Link>
          </div>

          <PopularServicesGrid />
        </section>

        <FeaturedServicesStrip />

        <HowItWorks />

        <section>
          <h2 className="mb-6 text-2xl font-bold text-slate-950 md:text-3xl">
            Explore by category
          </h2>

          <MarketplaceCategoryGrid />
        </section>

        <WorkflowsBlock />

        <TrustBlock />
      </div>
    </>
  );
}