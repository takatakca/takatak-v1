"use client";

import { ArrowRight } from "lucide-react";

import type { MarketplaceCard } from "@/lib/website/marketplace-cards";
import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";
import { FeaturedServicesStrip } from "./FeaturedServicesStrip";
import { HowItWorks } from "./HowItWorks";
import { MarketplaceCategoryGrid } from "./MarketplaceCategoryGrid";
import { MarketplaceHero } from "./MarketplaceHero";
import { PopularServicesGrid } from "./PopularServicesGrid";
import { TrustBlock } from "./TrustBlock";
import { WorkflowsBlock } from "./WorkflowsBlock";

const COPY = {
  popular: { fr: "Services populaires", en: "Popular services" },
  popularLead: { fr: "Une sélection de forfaits TAKATAK, avec leur vrai prix de départ.", en: "A selection of TAKATAK packages, with their real starting price." },
  custom: { fr: "Publier un projet sur mesure", en: "Post a custom project" },
  explore: { fr: "Explorer par catégorie", en: "Explore by category" },
} as const;

/** /marketplace landing, in the visitor's language. `cards` is the real catalog with database prices. */
export function MarketplaceLanding({ cards }: { cards: MarketplaceCard[] }) {
  const { lang } = useLanguage();
  return (
    <>
      <MarketplaceHero cards={cards} />
      <div className="mx-auto max-w-7xl space-y-16 px-4 py-12 md:py-16">
        <section>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-foreground md:text-3xl">{COPY.popular[lang]}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{COPY.popularLead[lang]}</p>
            </div>
            <Link to="/marketplace/post-project" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {COPY.custom[lang]} <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
          <PopularServicesGrid cards={cards} />
        </section>

        <FeaturedServicesStrip cards={cards} />
        <HowItWorks />

        <section>
          <h2 className="mb-6 text-2xl font-bold text-foreground md:text-3xl">{COPY.explore[lang]}</h2>
          <MarketplaceCategoryGrid />
        </section>

        <WorkflowsBlock />
        <TrustBlock />
      </div>
    </>
  );
}
