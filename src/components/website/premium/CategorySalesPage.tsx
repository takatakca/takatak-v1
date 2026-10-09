"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Check, ChevronDown, Clock3 } from "lucide-react";

import { Reveal } from "@/components/website/home/Reveal";
import {
  CORE_CATEGORIES,
  SOCIAL_ANNUAL_SAVINGS_PERCENT,
  SOCIAL_X_ADDON_MONTHLY,
  getCoreCategory,
  type CategoryKey,
  type CoreCategory,
} from "@/lib/website/core-categories";
import { Link } from "@/lib/website/nav";
import { pricing } from "@/lib/website/pricing";
import { CategoryVisual } from "./CategoryVisual";
import { DomainSearchDialog } from "./DomainSearchDialog";
import { FloatCard, Mock } from "./mockups";
import { CategoryPricing } from "./CategoryPricing";
import {
  AvailabilityBadge,
  CategoryIcon,
  CtaButton,
  FromLine,
  IllustrationTag,
  Kicker,
  NavyBackdrop,
  SoonTag,
  accentStyle,
  money,
  useCopy,
} from "./ui";

const SECTIONS = ["included", "how", "see", "pricing", "faq"] as const;

/** Values inserted into FAQ answers, all from the code catalogs. */
function faqVars(key: CategoryKey, lang: "en" | "fr"): Record<string, string | number> {
  if (key === "social") {
    return {
      price: key === "social" ? money(lang, SOCIAL_X_ADDON_MONTHLY) : "",
      pct: SOCIAL_ANNUAL_SAVINGS_PERCENT,
    };
  }
  if (key === "ai") {
    return { p1: money(lang, pricing.ai[0].amount), p2: money(lang, pricing.ai[1].amount) };
  }
  return {};
}

/**
 * Sales page for one core category: promise, what's included, how it works,
 * visuals, pricing, FAQ and a call to action to start.
 */
export function CategorySalesPage({ categoryKey }: { categoryKey: CategoryKey }) {
  const category = getCoreCategory(categoryKey);
  const { tk, lang } = useCopy();
  const [domainOpen, setDomainOpen] = useState(false);
  const openDomain = useCallback(() => setDomainOpen(true), []);
  const closeDomain = useCallback(() => setDomainOpen(false), []);
  const k = category.key;
  const name = tk(`cat.${k}.name`);
  const vars = faqVars(k, lang);
  const ctaProps = { onDomainSearch: openDomain, page: category.route };

  return (
    <div className="tk-page tk-premium brand-dark" style={accentStyle(category)}>
      {/* 1. Promise */}
      <section aria-labelledby="cat-title" className="relative overflow-hidden">
        <NavyBackdrop grid />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[620px] w-[620px] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--tk-accent) 45%, transparent), transparent)" }}
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-10 sm:pt-14 lg:grid-cols-12 lg:gap-12 lg:pb-24 lg:pt-20">
          <div className="lg:col-span-5">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              <Link to="/" className="hover:text-white">{tk("cat.common.core")}</Link>
              <span aria-hidden>/</span>
              <span className="tk-accent-text">
                {category.index !== null ? tk("cat.common.number", { n: category.index }) : tk("cat.common.start")}
              </span>
            </nav>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <CategoryIcon category={category} size={52} />
              <div>
                <p className="text-xl font-bold text-white">{name}</p>
                <p className="text-[13px] text-white/55">{tk(`cat.${k}.eyebrow`)}</p>
              </div>
            </div>
            <h1 id="cat-title" className="mt-7 text-balance text-[36px] font-extrabold leading-[1.04] tracking-[-0.035em] text-white sm:text-5xl lg:text-[54px]">
              <span className="tk-gradient-text">{tk(`cat.${k}.title`)}</span>
            </h1>
            <p className="mt-5 text-base leading-7 text-white/72 sm:text-[17px]">{tk(`cat.${k}.promise`)}</p>
            <ul className="mt-6 grid gap-2.5">
              {(["h1", "h2", "h3"] as const).map((h) => (
                <li key={h} className="flex items-start gap-3 text-[15px] text-white/88">
                  <span aria-hidden className="tk-accent-soft mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full">
                    {category.availability === "planned" ? (
                      <Clock3 size={12} className="tk-accent-text" />
                    ) : (
                      <Check size={12} strokeWidth={3} className="tk-accent-text" />
                    )}
                  </span>
                  {tk(`cat.${k}.${h}`)}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <AvailabilityBadge availability={category.availability} />
              <FromLine category={category} className="text-sm" />
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <CtaButton cta={category.primary} {...ctaProps} />
              <CtaButton cta={category.secondary} variant="ghost" {...ctaProps} />
            </div>
          </div>
          <div className="lg:col-span-7">
            <CategoryVisual
              category={category}
              idBase={`cat-${k}`}
              preload
              sizes="(min-width: 1280px) 720px, (min-width: 1024px) 56vw, 100vw"
              overlay={
                <div className="tk-drift absolute -bottom-6 left-4 hidden w-[240px] sm:block lg:-left-6">
                  <FloatCard
                    icon={<category.icon size={15} />}
                    title={name}
                    subtitle={tk(`cat.avail.${category.availability}`)}
                    tone={category.availability === "live" ? "ok" : "accent"}
                  />
                </div>
              }
            />
          </div>
        </div>
      </section>

      {/* In-page navigation */}
      <nav
        aria-label={tk("cat.page.nav")}
        className="sticky z-30 border-y border-white/[0.08] bg-[#060D1F]/80 backdrop-blur-xl"
        style={{ top: "var(--tk-header-h, 64px)" }}
      >
        <ul className="tk-no-scrollbar mx-auto flex max-w-7xl gap-1.5 overflow-x-auto px-4 py-2.5">
          {SECTIONS.map((s) => (
            <li key={s} className="shrink-0">
              <a
                href={`#${s}`}
                className="inline-flex rounded-full border border-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white/65 transition-colors hover:border-[color-mix(in_oklab,var(--tk-accent)_55%,transparent)] hover:text-white"
              >
                {tk(`cat.page.nav.${s}`)}
              </a>
            </li>
          ))}
          <li className="ml-auto hidden shrink-0 sm:block">
            <CtaButton cta={category.primary} {...ctaProps} className="!px-4 !py-1.5 text-[13px]" />
          </li>
        </ul>
      </nav>

      <HeaderHeightSync />

      {/* 2. What's included */}
      <Section id="included" title={tk("cat.page.included")} subtitle={tk("cat.page.includedSub")}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {category.included.map((item, i) => {
            const Icon = item.icon;
            return (
              <Reveal as="li" key={i} delay={(i % 3) * 80}>
                <div className="tk-glass tk-lift relative h-full rounded-2xl p-6">
                  <div className="flex items-start justify-between gap-3">
                    <span aria-hidden className="tk-accent-soft tk-accent-text grid h-11 w-11 place-items-center rounded-xl">
                      <Icon size={20} />
                    </span>
                    {item.soon && <SoonTag />}
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-white">{tk(`cat.${k}.inc${i + 1}.t`)}</h3>
                  <p className="mt-2 text-[15px] leading-6 text-white/65">{tk(`cat.${k}.inc${i + 1}.d`)}</p>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </Section>

      {/* 3. How it works */}
      <Section id="how" title={tk("cat.page.how")} subtitle={tk("cat.page.howSub")} tinted>
        <ol className="relative grid gap-4 md:grid-cols-4">
          <span aria-hidden className="absolute left-0 right-0 top-[27px] hidden h-px bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--tk-accent)_60%,transparent),transparent)] md:block" />
          {Array.from({ length: category.steps }, (_, i) => (
            <Reveal as="li" key={i} delay={i * 90} className="relative">
              <span className="tk-accent-bg relative z-10 grid h-14 w-14 place-items-center rounded-2xl text-lg font-extrabold text-white shadow-[0_14px_30px_-12px_var(--tk-accent)]">
                {i + 1}
              </span>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">{tk("cat.page.step", { n: i + 1 })}</p>
              <h3 className="mt-1 text-lg font-bold text-white">{tk(`cat.${k}.step${i + 1}.t`)}</h3>
              <p className="mt-2 text-[15px] leading-6 text-white/65">{tk(`cat.${k}.step${i + 1}.d`)}</p>
            </Reveal>
          ))}
        </ol>
      </Section>

      {/* 4. Visuals */}
      <Section id="see" title={tk("cat.page.see")} subtitle={tk("cat.page.seeSub")}>
        <div className={`grid gap-5 ${category.views.length === 3 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
          {category.views.map((view, i) => (
            <Reveal key={view.id} delay={i * 100}>
              <figure className="group tk-glass tk-lift rounded-[22px] p-2">
                <div className="relative aspect-[16/10] overflow-hidden rounded-[16px] bg-[#081430]">
                  {view.image ? (
                    <div className="tk-zoom absolute inset-0">
                      <Image
                        src={view.image.src}
                        alt={tk(`cat.${k}.alt.${view.id}`)}
                        fill
                        sizes="(min-width: 1024px) 600px, 100vw"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="absolute inset-0 p-3 sm:p-4">
                      {view.mock && <Mock kind={view.mock} />}
                      <IllustrationTag className="absolute bottom-4 left-4" />
                    </div>
                  )}
                </div>
                <figcaption className="flex items-center justify-between gap-3 px-3 pb-2 pt-3.5">
                  <span className="text-sm font-semibold text-white">{tk(`cat.${k}.view.${view.id}`)}</span>
                  <span className="text-right text-[13px] text-white/55">{tk(`cat.${k}.cap.${view.id}`)}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 5. Pricing */}
      <Section id="pricing" title={tk("cat.page.pricing")} subtitle={tk("cat.page.pricingSub")} tinted>
        <CategoryPricing category={category} {...ctaProps} />
      </Section>

      {/* 6. FAQ */}
      <Section id="faq" title={tk("cat.page.faq")}>
        <div className="mx-auto grid max-w-3xl gap-3">
          {Array.from({ length: category.faqs }, (_, i) => (
            <details key={i} className="tk-faq tk-glass group rounded-2xl px-5 py-4 open:bg-white/[0.06]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[15px] font-semibold text-white">
                {tk(`cat.${k}.faq${i + 1}.q`)}
                <ChevronDown size={18} className="tk-faq-chevron shrink-0 text-white/50" aria-hidden />
              </summary>
              <p className="mt-3 text-[15px] leading-7 text-white/68">{tk(`cat.${k}.faq${i + 1}.a`, vars)}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* 7. Start */}
      <section aria-labelledby="cat-cta-title" className="px-4 pb-6 pt-4">
        <Reveal className="relative mx-auto max-w-[1248px]">
          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,#0B1B3D,#08142E_60%)] px-6 py-14 sm:px-12 sm:py-16">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(560px 260px at 85% 0%, color-mix(in oklab, var(--tk-accent) 35%, transparent), transparent 65%), radial-gradient(520px 260px at 0% 110%, rgb(31 139 255 / 0.25), transparent 60%)",
              }}
            />
            <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <Kicker>{name}</Kicker>
                <h2 id="cat-cta-title" className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-white sm:text-[42px]">
                  {tk("cat.page.ctaTitle")}
                </h2>
                <p className="mt-3 text-base leading-7 text-white/68">{tk("cat.page.ctaBody")}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <CtaButton cta={category.primary} {...ctaProps} className="!px-6 !py-3.5 text-[15px]" />
                <CtaButton cta={category.secondary} variant="ghost" {...ctaProps} className="!py-3.5 text-[15px]" />
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <OtherCategories current={category} />
      <DomainSearchDialog open={domainOpen} onClose={closeDomain} />
    </div>
  );
}

function Section({
  id,
  title,
  subtitle,
  tinted = false,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  tinted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`relative py-16 sm:py-24 ${tinted ? "bg-[linear-gradient(180deg,rgb(11_27_61/0.55),rgb(11_27_61/0.25))]" : ""}`}
      style={{ scrollMarginTop: "calc(var(--tk-header-h, 64px) + 56px)" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/[0.06]" />
      <div className="mx-auto max-w-7xl px-4">
        <Reveal className="mb-10 max-w-2xl sm:mb-12">
          <h2 id={`${id}-title`} className="text-3xl font-extrabold tracking-[-0.025em] text-white sm:text-[40px]">
            {title}
          </h2>
          {subtitle && <p className="mt-3 text-base leading-7 text-white/62">{subtitle}</p>}
        </Reveal>
        {children}
      </div>
    </section>
  );
}

function OtherCategories({ current }: { current: CoreCategory }) {
  const { tk } = useCopy();
  return (
    <section aria-labelledby="others-title" className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <h2 id="others-title" className="text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">
          {tk("cat.page.others")}
        </h2>
        <p className="mt-2 text-[15px] text-white/60">{tk("cat.page.othersSub")}</p>
        <ul className="mt-8 grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-3">
          {CORE_CATEGORIES.filter((c) => c.key !== current.key).map((c) => (
            <li key={c.key}>
              <Link
                to={c.route}
                style={accentStyle(c)}
                className="tk-glass tk-lift group flex h-full items-center gap-4 rounded-2xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tk-cyan)]"
              >
                <CategoryIcon category={c} size={42} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-white">{tk(`cat.${c.key}.name`)}</span>
                  <FromLine category={c} className="block truncate text-[13px] text-white/65" />
                </span>
                <ArrowUpRight size={16} className="shrink-0 text-white/35 transition-colors group-hover:text-white" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Mirrors the header height into --tk-header-h for the sticky in-page nav. */
function HeaderHeightSync() {
  useHeaderHeightEffect();
  return null;
}

import { useEffect } from "react";
function useHeaderHeightEffect() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("header");
    if (!header) return;
    const apply = () => document.documentElement.style.setProperty("--tk-header-h", `${header.offsetHeight}px`);
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(header);
    return () => ro?.disconnect();
  }, []);
}
