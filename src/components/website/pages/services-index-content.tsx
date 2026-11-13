"use client";

import { ArrowRight, ClipboardList, Cog, FileText, LayoutGrid, PenTool, Smartphone, Sparkles, Users, type LucideIcon } from "lucide-react";

import { Reveal } from "@/components/website/home/Reveal";
import { accentStyle, CategoryIcon, money, NavyBackdrop } from "@/components/website/premium/ui";
import { getCoreCategory, SERVICE_SLUG_TO_CATEGORY } from "@/lib/website/core-categories";
import type { TranslationKey } from "@/lib/website/i18n";
import { Link } from "@/lib/website/nav";
import { cadenceKeys } from "@/lib/website/pricing";
import { servicePages } from "@/lib/website/service-pages";
import { useLanguage } from "@/lib/website/use-language";

/** Icons for the services that have no category of their own. */
const SERVICE_ICON: Record<string, LucideIcon> = {
  "logo-branding": PenTool,
  "mobile-apps": Smartphone,
  "lead-generation": Users,
  automation: Cog,
  "ai-business-tools": Sparkles,
  "data-admin": ClipboardList,
  "menu-flyer-design": FileText,
  marketplace: LayoutGrid,
};

function ServiceIcon({ slug }: { slug: string }) {
  const key = SERVICE_SLUG_TO_CATEGORY[slug];
  if (key) {
    const category = getCoreCategory(key);
    return (
      <span className="shrink-0" style={accentStyle(category)}>
        <CategoryIcon category={category} size={42} />
      </span>
    );
  }
  const Icon = SERVICE_ICON[slug] ?? LayoutGrid;
  return (
    <span aria-hidden className="relative grid h-[42px] w-[42px] shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#1F8BFF,#29C3FF)] text-white shadow-[0_12px_30px_-12px_rgb(31_139_255/0.8)]">
      <span className="absolute inset-0 rounded-2xl bg-[linear-gradient(180deg,rgb(255_255_255/0.28),transparent_55%)]" />
      <Icon size={19} className="relative" />
    </span>
  );
}

/** /services: every service TAKATAK delivers, by family, with its real starting price. */
export function ServicesIndexContent() {
  const { t, tx, lang } = useLanguage();
  const groups = Array.from(new Set(servicePages.map((page) => page.eyebrow.en)));

  return (
    <div className="tk-page tk-premium brand-dark bg-[#060D1F] text-white">
      <section aria-labelledby="services-title" className="relative overflow-hidden">
        <NavyBackdrop grid />
        <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-12 sm:pt-16 lg:pb-16 lg:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75 ring-1 ring-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden /> TAKATAK
          </p>
          <h1 id="services-title" className="tk-gradient-text mt-6 text-[40px] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-5xl lg:text-[56px]">
            {lang === "fr" ? "Tous les services" : "All services"}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-[17px]">
            {lang === "fr"
              ? "Tous les services livrés par TAKATAK, avec configuration gérée et soutien canadien. Prix en dollars canadiens, avant taxes."
              : "Every service TAKATAK delivers, with managed setup and Canadian support. Prices in Canadian dollars, before taxes."}
          </p>
          <Link to="/pricing" className="tk-btn-ghost mt-7 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold">
            {t("common.viewPricing")} <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-20">
        {groups.map((group) => {
          const items = servicePages.filter((page) => page.eyebrow.en === group);
          if (!items.length) return null;
          return (
            <section key={group} aria-label={tx(items[0]!.eyebrow)} className="mt-12 first:mt-4">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.22em] text-sky-300">{tx(items[0]!.eyebrow)}</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map((service, i) => {
                  const amount = service.packages.reduce((min, pack) => (pack.amount < min ? pack.amount : min), service.packages[0]?.amount ?? 0);
                  const cadence = service.packages.find((pack) => pack.amount === amount)?.cadence;
                  return (
                    <Reveal key={service.slug} delay={i * 50} className="h-full">
                      <Link to={service.route} className="tk-glass tk-lift group flex h-full flex-col rounded-2xl p-5">
                        <div className="flex items-start gap-3.5">
                          <ServiceIcon slug={service.slug} />
                          <div className="min-w-0">
                            <h3 className="text-[16px] font-bold text-white">{tx(service.title)}</h3>
                            <p className="mt-1.5 text-[14px] leading-6 text-white/65">{tx(service.tagline)}</p>
                          </div>
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                          {amount > 0 ? (
                            <span className="text-[14px] text-white/65">
                              {t("service.startingAt")} <span className="font-bold text-white">{money(lang, amount)}</span>
                              {cadence && <span className="text-[12.5px] text-white/55">{t(cadenceKeys[cadence] as TranslationKey)}</span>}
                            </span>
                          ) : (
                            <span />
                          )}
                          <span className="inline-flex shrink-0 items-center gap-1.5 text-[14px] font-semibold text-sky-300">
                            {t("common.explore")} <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" aria-hidden />
                          </span>
                        </div>
                      </Link>
                    </Reveal>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
