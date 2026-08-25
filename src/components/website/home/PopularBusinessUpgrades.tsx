"use client";

import { useState } from "react";
import { Link } from "@/lib/website/nav";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import { pricing } from "@/lib/website/pricing";
import { QMAPS, FLEXS } from "@/lib/website/product-destinations";
import { Reveal } from "./Reveal";
import { PerspectiveCard } from "@/components/website/motion/PerspectiveCard";
import { WebsiteCommerceScene } from "./upgrades/WebsiteCommerceScene";
import { BrandBoardScene } from "./upgrades/BrandBoardScene";
import { LocalGrowthScene } from "./upgrades/LocalGrowthScene";
import { AutomationFlowScene } from "./upgrades/AutomationFlowScene";
import {
  Eyebrow,
  PriceTag,
  PrimaryCta,
  ProductExternalCta,
  ProductLabel,
  SecondaryCta,
  WelcomeOfferPrompt,
} from "./upgrades/upgradeParts";

/** Shared offer surface: quiet depth, mockups allowed to breathe. */
function OfferSurface({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <PerspectiveCard max={3}>
      <article
        className={`tk-sheen flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card/90 p-5 shadow-[var(--shadow-card)] backdrop-blur transition-colors duration-300 hover:border-primary/45 md:p-7 ${className}`}
      >
        {children}
      </article>
    </PerspectiveCard>
  );
}

const websitePackages = [
  { key: "starter", tier: pricing.websites[0] },
  { key: "business", tier: pricing.websites[1] },
  { key: "premium", tier: pricing.websites[2] },
  { key: "ecommerce", tier: pricing.websites[3] },
] as const;

/**
 * Popular business upgrades — TAKATAK's premium digital storefront.
 *
 * Editorial composition, not a card grid: the website is the hero product
 * (left), brand and local growth stack beside it, and automation runs as a
 * second cinematic feature across the full width.
 */
export function PopularBusinessUpgrades() {
  const { t } = useLanguage();
  const [pkg, setPkg] = useState<(typeof websitePackages)[number]["key"]>("starter");
  const active = websitePackages.find((p) => p.key === pkg) ?? websitePackages[0];

  return (
    <section className="relative overflow-hidden border-b border-border bg-[color-mix(in_oklab,var(--foreground)_3%,var(--background))]">
      {/* section environment */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 420px at 78% 4%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 68%), radial-gradient(700px 380px at 4% 92%, color-mix(in oklab, var(--primary) 7%, transparent), transparent 72%)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/3 select-none text-center text-[19vw] font-black leading-none tracking-tighter text-foreground/[0.035]"
      >
        UPGRADE
      </span>

      <div className="relative mx-auto max-w-[1500px] px-4 py-16 md:py-24">
        <Reveal>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="min-w-0">
              <Eyebrow>{t("upg.kicker")}</Eyebrow>
              <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-foreground md:text-[2.6rem] md:leading-[1.1]">
                {t("upg.title")}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{t("upg.sub")}</p>
            </div>
            <Link
              to="/marketplace"
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {t("upg.browse")} <ArrowRight size={14} />
            </Link>
          </div>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-5">
          {/* HERO PRODUCT — premium business website */}
          <Reveal className="lg:col-span-3">
            <OfferSurface>
              <div className="mb-5 flex-1"><WebsiteCommerceScene /></div>
              <Eyebrow>{t("upg.website.eyebrow")}</Eyebrow>
              <h3 className="mt-2 text-2xl font-bold leading-9 text-foreground md:text-[1.8rem]">
                {t("upg.website.title")}
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{t("upg.website.desc")}</p>

              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t("upg.website.pkgs")}
                </p>
                <div role="group" aria-label={t("upg.website.pkgs")} className="mt-2 flex flex-wrap gap-1.5">
                  {websitePackages.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={p.key === pkg}
                      onClick={() => setPkg(p.key)}
                      className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        p.key === pkg
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background/70 text-foreground hover:border-primary/45"
                      }`}
                    >
                      {t(`upg.website.p.${p.key}` as never)}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[13px] text-muted-foreground">{t(`upg.website.b.${pkg}` as never)}</p>
              </div>

              <div className="mt-auto pt-6">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                  <PriceTag amount={active.tier.amount} />
                  <div className="flex flex-wrap gap-2">
                    <PrimaryCta to="/services/websites" search={{ package: active.tier.key }} label={t("upg.website.cta")} />
                    <SecondaryCta to="/pricing" label={t("upg.website.cta2")} />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <ProductLabel>{t("upg.label.managed")}</ProductLabel>
                  <ProductLabel>{t("upg.label.ready")}</ProductLabel>
                </div>
                <WelcomeOfferPrompt
                  serviceKey="websites"
                  next="/services/websites"
                  extra={{ package: active.tier.key }}
                />
              </div>
            </OfferSurface>
          </Reveal>

          {/* STACK — brand + local growth */}
          <div className="grid gap-5 lg:col-span-2">
            <Reveal delay={80}>
              <OfferSurface>
                <div className="mb-4"><BrandBoardScene /></div>
                <Eyebrow>{t("upg.brand.eyebrow")}</Eyebrow>
                <h3 className="mt-2 text-xl font-bold leading-8 text-foreground">{t("upg.brand.title")}</h3>
                <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{t("upg.brand.desc")}</p>
                <div className="mt-auto pt-5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    <PriceTag amount={pricing.branding[0].amount} />
                    <div className="flex flex-wrap gap-2">
                      <PrimaryCta to="/services/logo-branding" search={{ package: pricing.branding[0].key }} label={t("upg.brand.cta")} />
                      <SecondaryCta to="/services/logo-branding" label={t("upg.brand.cta2")} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <ProductLabel>{t("upg.label.setup")}</ProductLabel>
                  </div>
                  <WelcomeOfferPrompt serviceKey="branding" next="/services/logo-branding" />
                </div>
              </OfferSurface>
            </Reveal>

            <Reveal delay={140}>
              <OfferSurface>
                <div className="mb-4"><LocalGrowthScene /></div>
                <Eyebrow>{t("upg.local.eyebrow")}</Eyebrow>
                <h3 className="mt-2 text-xl font-bold leading-8 text-foreground">{t("upg.local.title")}</h3>
                <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{t("upg.local.desc")}</p>
                <div className="mt-auto pt-5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    <PriceTag amount={pricing.local[0].amount} />
                    <PrimaryCta to="/services/local-listings" label={t("upg.local.cta")} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <ProductExternalCta href={QMAPS.productUrl} name="QMAPS" accessibleName={t("upg.local.openQ")} />
                    <ProductExternalCta href={FLEXS.productUrl} name="FLEXS" accessibleName={t("upg.local.openF")} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                    <Link to="/services/local-listings" className="text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
                      {t("upg.local.svcQ")}
                    </Link>
                    <Link to="/services/lead-generation" className="text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
                      {t("upg.local.svcF")}
                    </Link>
                  </div>
                  <WelcomeOfferPrompt serviceKey="local" next="/services/local-listings" />
                </div>
              </OfferSurface>
            </Reveal>
          </div>

          {/* SECOND CINEMATIC FEATURE — automation */}
          <Reveal delay={100} className="lg:col-span-5">
            <OfferSurface>
              <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
                <div>
                  <Eyebrow>{t("upg.auto.eyebrow")}</Eyebrow>
                  <h3 className="mt-2 text-2xl font-bold leading-9 text-foreground md:text-[1.8rem]">
                    {t("upg.auto.title")}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{t("upg.auto.desc")}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                    <PriceTag amount={pricing.ai[0].amount} />
                    <div className="flex flex-wrap gap-2">
                      <PrimaryCta to="/services/automation" search={{ package: pricing.ai[0].key }} label={t("upg.auto.cta")} />
                      <SecondaryCta to="/services/ai-business-tools" label={t("upg.auto.cta2")} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <ProductLabel>{t("upg.label.connected")}</ProductLabel>
                    <ProductLabel>{t("upg.label.managed")}</ProductLabel>
                  </div>
                  <WelcomeOfferPrompt serviceKey="automation" next="/services/automation" />
                </div>
                <AutomationFlowScene />
              </div>
            </OfferSurface>
          </Reveal>
        </div>
      </div>
    </section>
  );
}