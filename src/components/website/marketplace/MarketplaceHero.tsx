"use client";

import { useState } from "react";
import { Clock, Search, ShieldCheck } from "lucide-react";

import { fastestDelivery, packageTitle, startingPrice } from "@/lib/website/marketplace-i18n";
import type { MarketplaceCard } from "@/lib/website/marketplace-cards";
import { useNavigate } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";
import { ServiceThumbnail } from "./ServiceThumbnail";

/** Label in the visitor's language; the search runs on the catalog's English words. */
const QUICK_PICKS = [
  { q: "Logo design", fr: "Logo", en: "Logo design" },
  { q: "Website", fr: "Site web", en: "Website" },
  { q: "Social media", fr: "Réseaux sociaux", en: "Social media" },
  { q: "Shopify store", fr: "Boutique Shopify", en: "Shopify store" },
  { q: "Local SEO", fr: "SEO local", en: "Local SEO" },
  { q: "Menu design", fr: "Menu de restaurant", en: "Menu design" },
];

/** Real packages from the catalog (marketplace-catalog.ts ids): their own title, starting price and fastest delivery. */
const HERO_COLLAGE = [
  { id: "website-starter", pos: "top-0 left-0 w-[56%] rotate-[-3deg] z-20" },
  { id: "logo-design", pos: "top-[6%] right-0 w-[42%] rotate-[4deg] z-10" },
  { id: "local-seo", pos: "bottom-[-4%] left-[4%] w-[42%] rotate-[2deg] z-30" },
  { id: "mobile-app-prototype", pos: "bottom-[2%] right-[0%] w-[42%] rotate-[-4deg] z-20" },
];

const COPY = {
  title1: { fr: "Le bon pigiste", en: "Find the right freelancer" },
  title2: { fr: "pour chaque service.", en: "for any service." },
  lead: {
    fr: "Sites web, image de marque, contenu, marketing, automatisation et plus, livrés par TAKATAK avec un paiement protégé sur chaque projet.",
    en: "Websites, branding, content, marketing, automation and more — delivered through TAKATAK with a protected payment on every project.",
  },
  placeholder: { fr: "Rechercher « logo »", en: 'Search for "logo design"' },
  search: { fr: "Rechercher", en: "Search" },
  popular: { fr: "Populaires :", en: "Popular:" },
  escrow: {
    fr: "Paiement protégé : l’argent n’est versé qu’une fois le travail approuvé.",
    en: "Protected payment: the freelancer is paid only once you approve the work.",
  },
  badge: { fr: "Paiement protégé TAKATAK", en: "TAKATAK protected payment" },
} as const;

export function MarketplaceHero({ cards }: { cards: MarketplaceCard[] }) {
  const { lang } = useLanguage();
  const collage = HERO_COLLAGE.flatMap((c) => {
    const pkg = cards.find((card) => card.id === c.id);
    return pkg ? [{ ...c, pkg }] : [];
  });
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  // An empty search opens every service instead of doing nothing.
  const go = (term: string = q) => {
    const t = term.trim();
    void navigate({ to: "/marketplace/search", search: (t ? { q: t } : {}) as never });
  };
  return (
    <section className="brand-dark border-b border-border relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--brand-accent-cyan), var(--brand-accent-violet), transparent)" }}
      />
      <div className="max-w-7xl mx-auto px-4 py-12 md:py-16 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center relative">
        <div>
          <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold tracking-tight leading-[1.05] text-foreground">
            {COPY.title1[lang]}
            <br />
            {COPY.title2[lang]}
          </h1>
          <p className="mt-5 text-muted-foreground max-w-xl text-base md:text-lg">
            {COPY.lead[lang]}
          </p>
          <div className="mt-7 max-w-xl">
            <div className="flex items-stretch rounded-lg border border-white/15 bg-white overflow-hidden focus-within:border-primary transition-colors shadow-[0_12px_40px_-20px_rgba(0,0,0,0.5)]">
              <div className="flex items-center pl-4 text-neutral-500">
                <Search size={18} aria-hidden />
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") go(); }}
                placeholder={COPY.placeholder[lang]}
                aria-label={COPY.search[lang]}
                className="flex-1 bg-transparent outline-none px-3 py-3.5 text-[15px] min-w-0 text-neutral-900 placeholder:text-neutral-500"
              />
              <button
                onClick={() => go()}
                className="px-6 text-sm font-semibold text-primary-foreground bg-primary hover:opacity-90 transition-opacity"
              >
                {COPY.search[lang]}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 items-center text-xs">
              <span className="text-muted-foreground">{COPY.popular[lang]}</span>
              {QUICK_PICKS.map((p) => (
                <button
                  key={p.q}
                  type="button"
                  onClick={() => { setQ(p.q); go(p.q); }}
                  className="px-2.5 py-1 rounded-full border border-white/15 bg-white/5 text-foreground/90 hover:border-white/30 hover:bg-white/10 transition-colors"
                >
                  {p[lang]}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-7 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck size={14} className="text-primary" aria-hidden />
            {COPY.escrow[lang]}
          </div>
        </div>
        <div className="hidden lg:block">
          <div className="relative h-[520px] w-full">
            {/* soft backdrop */}
            <div className="absolute inset-6 rounded-3xl bg-white/[0.04] border border-white/10" />
            {collage.map((c) => (
              <div
                key={c.id}
                className={`absolute ${c.pos} rounded-xl border border-black/5 bg-white overflow-hidden shadow-[0_28px_56px_-24px_rgba(0,0,0,0.6)] hover:rotate-0 transition-transform duration-300`}
              >
                <ServiceThumbnail kind={c.pkg.thumb} />
                <div className="p-3">
                  <div className="text-[13px] font-semibold text-neutral-900 line-clamp-1">{packageTitle(c.pkg, lang)}</div>
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-neutral-600">
                    <Clock size={10} aria-hidden />
                    <span>{fastestDelivery(c.pkg, lang)}</span>
                  </div>
                  <div className="mt-1.5 text-[13px] font-bold text-neutral-900">{startingPrice(c.pkg, lang)}</div>
                </div>
              </div>
            ))}
            {/* floating trust badge */}
            <div className="absolute top-[3%] left-[50%] z-40 -translate-x-1/2 -translate-y-1/2 px-3 py-2 rounded-full bg-white text-neutral-900 text-[11px] font-semibold shadow-lg inline-flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-primary" aria-hidden />
              {COPY.badge[lang]}
            </div>
          </div>
        </div>
        {/* Mobile collage — stacked tilted cards */}
        <div className="lg:hidden">
          <div className="relative h-[320px] w-full mt-2">
            {collage.slice(0, 3).map((c, i) => (
              <div
                key={c.id}
                className="absolute rounded-xl border border-black/5 bg-white overflow-hidden shadow-[0_22px_44px_-18px_rgba(0,0,0,0.55)]"
                style={{
                  width: "62%",
                  left: `${i * 16}%`,
                  top: `${i * 22}px`,
                  transform: `rotate(${[-4, 2, 5][i]}deg)`,
                  zIndex: 10 + i,
                }}
              >
                <ServiceThumbnail kind={c.pkg.thumb} />
                <div className="p-2.5">
                  <div className="text-[12px] font-semibold text-neutral-900 line-clamp-1">{packageTitle(c.pkg, lang)}</div>
                  <div className="mt-1 text-[11px] font-bold text-neutral-900">{startingPrice(c.pkg, lang)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}