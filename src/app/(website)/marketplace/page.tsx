import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/website/nav";

import { MarketplaceHero } from "@/components/website/marketplace/MarketplaceHero";
import { MarketplaceCategoryGrid } from "@/components/website/marketplace/MarketplaceCategoryGrid";
import { PopularServicesGrid } from "@/components/website/marketplace/PopularServicesGrid";
import { FeaturedServicesStrip } from "@/components/website/marketplace/FeaturedServicesStrip";
import { HowItWorks } from "@/components/website/marketplace/HowItWorks";
import { WorkflowsBlock } from "@/components/website/marketplace/WorkflowsBlock";
import { TrustBlock } from "@/components/website/marketplace/TrustBlock";

export const metadata: Metadata = {
  title: "TAKATAK Marketplace — Hire vetted talent",
  description:
    "Logos, websites, content, automation and more. Delivered through TAKATAK with escrowed payments.",
};

export default function MarketplacePage() {
  return (
    <>
      <MarketplaceHero />
      <div className="mx-auto max-w-7xl space-y-16 px-4 py-12 md:py-16">
        <section>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-foreground md:text-3xl">
                Popular services
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hand-picked services from vetted TAKATAK freelancers.
              </p>
            </div>
            <Link
              to="/marketplace/post-project"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Post a custom project <ArrowRight size={14} />
            </Link>
          </div>
          <PopularServicesGrid />
        </section>

        <FeaturedServicesStrip />
        <HowItWorks />

        <section>
          <h2 className="mb-6 text-2xl font-bold text-foreground md:text-3xl">
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
