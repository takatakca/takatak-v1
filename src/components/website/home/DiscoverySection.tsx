"use client";

import type { ReactNode } from "react";
import { Link } from "@/lib/website/nav";
import {
  ArrowRight, Palette, Smartphone, Share2, Target, Utensils, ClipboardList,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import type { TranslationKey } from "@/lib/website/i18n";
import { pricing, formatCAD, cadenceKeys, type Cadence } from "@/lib/website/pricing";
import { Reveal } from "./Reveal";
import { PerspectiveCard } from "@/components/website/motion/PerspectiveCard";
import { WebsiteDiscoveryVisual } from "./discovery/WebsiteDiscoveryVisual";
import { DomainHostingDiscoveryVisual } from "./discovery/DomainHostingDiscoveryVisual";
import { BrandingDiscoveryVisual } from "./discovery/BrandingDiscoveryVisual";
import { MarketingDiscoveryVisual } from "./discovery/MarketingDiscoveryVisual";
import { LocalGrowthDiscoveryVisual } from "./discovery/LocalGrowthDiscoveryVisual";
import { OperationsDiscoveryVisual } from "./discovery/OperationsDiscoveryVisual";
import { QmapsFlexsStory } from "./discovery/QmapsFlexsStory";
import { QMAPS, FLEXS, externalLinkProps } from "@/lib/website/product-destinations";

interface Solution {
  k: "websites" | "domains" | "branding" | "marketing" | "local" | "ops";
  visual: ReactNode;
  amount: number;
  cadence: Cadence;
  primary: string;
  secondary: string;
  /** Editorial span on large screens. */
  span: "wide" | "narrow";
  story?: boolean;
}

/** Six art-directed solution groups. Everything else lives on /services. */
const SOLUTIONS: readonly Solution[] = [
  { k: "websites",  visual: <WebsiteDiscoveryVisual />,       amount: pricing.websites[0].amount, cadence: "one-time", primary: "/services/websites",       secondary: "/marketplace/category/website_design", span: "wide" },
  { k: "domains",   visual: <DomainHostingDiscoveryVisual />, amount: pricing.domain.register.amount, cadence: "yearly", primary: "/domain",                secondary: "/hosting",                             span: "narrow" },
  { k: "branding",  visual: <BrandingDiscoveryVisual />,      amount: pricing.branding[0].amount, cadence: "one-time", primary: "/services/logo-branding",  secondary: "/marketplace/category/logo_design",    span: "narrow" },
  { k: "marketing", visual: <MarketingDiscoveryVisual />,     amount: pricing.marketing[0].amount, cadence: "one-time", primary: "/services/marketing",     secondary: "/services/social-media",               span: "wide" },
  { k: "local",     visual: <LocalGrowthDiscoveryVisual />,   amount: pricing.local[0].amount,    cadence: "one-time", primary: "/services/local-listings", secondary: "/services/lead-generation",            span: "wide", story: true },
  { k: "ops",       visual: <OperationsDiscoveryVisual />,    amount: pricing.voip[0].amount,     cadence: "monthly",  primary: "/services/voip",           secondary: "/services/automation",                 span: "narrow" },
];

/** Compact secondary rail — quick access, no cards. */
const RAIL: readonly { icon: LucideIcon; k: string; to: string }[] = [
  { icon: Palette,       k: "branding", to: "/marketplace/category/logo_design" },
  { icon: Smartphone,    k: "apps",     to: "/services/mobile-apps" },
  { icon: Share2,        k: "social",   to: "/services/social-media" },
  { icon: Target,        k: "leads",    to: "/services/lead-generation" },
  { icon: Utensils,      k: "print",    to: "/marketplace/gigs/menu-design" },
  { icon: ClipboardList, k: "data",     to: "/marketplace/category/data_entry" },
];

export function DiscoverySection() {
  const { t, tx } = useLanguage();
  return (
    <section className="relative border-b border-border bg-secondary/25">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in oklab, var(--foreground) 5%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--foreground) 5%, transparent) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at 50% 0%, black 20%, transparent 78%)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-4 top-6 select-none text-[14vw] font-black leading-none tracking-tighter text-foreground/[0.035] md:text-[9rem]"
      >
        SOLUTIONS
      </span>
      <div className="relative mx-auto max-w-7xl px-4 py-16 md:py-24">
        <Reveal>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="min-w-0">
              <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">{t("home.disc.title")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t("home.disc.subtitle")}</p>
            </div>
            <Link to="/services" className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              {t("home.disc.all")} <ArrowRight size={14} />
            </Link>
          </div>
        </Reveal>

        {/* Editorial composition: alternating wide / narrow rows on desktop,
            a single readable column on mobile. */}
        <ul className="mt-9 grid grid-cols-1 gap-4 lg:grid-cols-5">
          {SOLUTIONS.map((s, i) => (
            <Reveal
              as="li"
              key={s.k}
              delay={Math.min(i, 5) * 60}
              className={s.span === "wide" ? "lg:col-span-3" : "lg:col-span-2"}
            >
              <PerspectiveCard max={4}>
                <article className="tk-sheen group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-colors duration-300 hover:border-primary/50 hover:shadow-[var(--shadow-glow)] md:p-6">
                  {s.visual}

                  <div className="mt-5 flex items-start justify-between gap-3">
                    <h3 className="min-w-0 text-lg font-semibold leading-7 text-foreground md:text-xl">
                      {t(`disc2.${s.k}.title` as TranslationKey)}
                    </h3>
                    <span className="shrink-0 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-semibold text-foreground">
                      {t("price.from")} {formatCAD(s.amount)}
                      <span className="font-medium text-muted-foreground">
                        {t(cadenceKeys[s.cadence] as TranslationKey)}
                      </span>
                    </span>
                  </div>

                  <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
                    {t(`disc2.${s.k}.desc` as TranslationKey)}
                  </p>

                  {s.story && (
                    <>
                      <p className="mt-3 text-[13px] leading-6 text-foreground/80">
                        {t("disc2.local.secondary")}
                      </p>
                      <QmapsFlexsStory className="mt-4" />
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] font-semibold">
                        <a href={QMAPS.productUrl} {...externalLinkProps} className="text-primary hover:underline">
                          {tx({ en: QMAPS.en.open, fr: QMAPS.fr.open })} ↗
                        </a>
                        <a href={FLEXS.productUrl} {...externalLinkProps} className="text-primary hover:underline">
                          {tx({ en: FLEXS.en.open, fr: FLEXS.fr.open })} ↗
                        </a>
                      </div>
                    </>
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
                    <Link
                      to={s.primary as never}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      {t(`disc2.${s.k}.cta1` as TranslationKey)}
                      <ArrowRight size={13} className="transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                    <Link
                      to={s.secondary as never}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3.5 py-2 text-[13px] font-semibold text-foreground transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      {t(`disc2.${s.k}.cta2` as TranslationKey)}
                    </Link>
                  </div>
                </article>
              </PerspectiveCard>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={120}>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("home.disc.quick")}</span>
            {RAIL.map((r) => {
              const Icon = r.icon;
              return (
                <Link
                  key={r.k}
                  to={r.to as never}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] text-foreground/80 transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  <Icon size={13} className="text-primary" />
                  {t(`cat.${r.k}.title` as TranslationKey)}
                </Link>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
