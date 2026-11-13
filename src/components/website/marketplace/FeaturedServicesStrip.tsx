"use client";

import { ArrowUpRight } from "lucide-react";

import { categoryName, formatCad } from "@/lib/website/marketplace-i18n";
import type { MarketplaceThumbnail } from "@/lib/website/marketplace-catalog";
import type { MarketplaceCard } from "@/lib/website/marketplace-cards";
import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";
import { ServiceThumbnail } from "./ServiceThumbnail";

/** Categories shown here; the "from" price is the cheapest tier in the catalog for that category. */
const FEATURED: { slug: string; thumb: MarketplaceThumbnail }[] = [
  { slug: "website_design", thumb: "website" },
  { slug: "logo_design", thumb: "logo" },
  { slug: "social_media_content", thumb: "social" },
  { slug: "seo_local_visibility", thumb: "seo" },
  { slug: "online_advertising", thumb: "ai" },
  { slug: "data_entry", thumb: "data" },
  { slug: "mobile_app_design", thumb: "mobile" },
  { slug: "ecommerce_setup", thumb: "ecommerce" },
];

const COPY = {
  title: { fr: "Services TAKATAK en vedette", en: "Featured TAKATAK services" },
  lead: { fr: "Les grandes familles de services, avec leur vrai prix de départ.", en: "The main kinds of work, with their real starting price." },
  from: { fr: "Dès", en: "From" },
} as const;

function cheapest(cards: readonly MarketplaceCard[], slug: string): { cents: number; name: string } | null {
  const inCategory = cards.filter((p) => p.category === slug);
  if (!inCategory.length) return null;
  const cents = Math.min(...inCategory.flatMap((p) => p.tiers.map((t) => t.priceCents)));
  return { cents, name: inCategory[0].categoryName };
}

export function FeaturedServicesStrip({ cards }: { cards: MarketplaceCard[] }) {
  const { lang } = useLanguage();
  const rows = FEATURED.flatMap((f) => {
    const c = cheapest(cards, f.slug);
    return c ? [{ ...f, ...c }] : [];
  });
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">{COPY.title[lang]}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{COPY.lead[lang]}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {rows.map((f) => (
          <Link
            key={f.slug}
            to="/marketplace/category/$slug"
            params={{ slug: f.slug }}
            className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-[var(--shadow-card)]"
          >
            <ServiceThumbnail kind={f.thumb} />
            <div className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-foreground transition-colors group-hover:text-primary">
                  {categoryName(f.slug, f.name, lang)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {COPY.from[lang]} {formatCad(f.cents, lang)}
                </div>
              </div>
              <ArrowUpRight size={16} className="shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
