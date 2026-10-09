"use client";

import { ArrowRight, Check, Cog, Rocket, TrendingUp, type LucideIcon } from "lucide-react";
import { Link } from "@/lib/website/nav";
import type { TranslationKey } from "@/lib/website/i18n";
import { cadenceKeys, formatCAD, pricing, type Cadence } from "@/lib/website/pricing";
import { useLanguage } from "@/lib/website/use-language";
import { Reveal } from "./Reveal";

interface Plan {
  k: "launch" | "grow" | "operate";
  icon: LucideIcon;
  amount: number;
  cadence: Cadence;
  to: string;
  featured?: boolean;
}

// Starting prices come from src/lib/website/pricing.ts (same data as /pricing).
const PLANS: readonly Plan[] = [
  { k: "launch", icon: Rocket, amount: pricing.websites[0].amount, cadence: "one-time", to: "/services/websites" },
  { k: "grow", icon: TrendingUp, amount: pricing.marketing[0].amount, cadence: "one-time", to: "/services/marketing", featured: true },
  { k: "operate", icon: Cog, amount: pricing.ai[0].amount, cadence: "one-time", to: "/services/ai-business-tools" },
];

/** Three starting points with clear CAD prices, linking to the full pricing page. */
export function HomePricingTeaser() {
  const { t } = useLanguage();
  return (
    <section aria-labelledby="home-pricing-title" className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 md:py-24">
        <Reveal className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h2 id="home-pricing-title" className="text-3xl font-bold leading-tight text-foreground md:text-4xl">
              {t("home.gate.title")}
            </h2>
            <p className="mt-3 text-base text-muted-foreground">{t("home.gate.subtitle")}</p>
          </div>
          <Link to="/pricing" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            {t("home.gate.all")} <ArrowRight size={14} aria-hidden />
          </Link>
        </Reveal>

        <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
          {PLANS.map((p) => {
            const Icon = p.icon;
            return (
              <li
                key={p.k}
                className={`relative flex flex-col rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)] ${
                  p.featured ? "border-primary/60 ring-1 ring-primary/30" : "border-border"
                }`}
              >
                {p.featured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                    {t("home.gate.popular")}
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden>
                    <Icon size={18} />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{t(`home.gate.${p.k}.name` as TranslationKey)}</h3>
                    <p className="text-xs font-medium uppercase tracking-wider text-primary">{t(`home.gate.${p.k}.tag` as TranslationKey)}</p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-muted-foreground">{t(`home.gate.${p.k}.desc` as TranslationKey)}</p>

                <p className="mt-4 text-sm text-muted-foreground">
                  {t("home.gate.from")} <span className="text-2xl font-bold text-foreground">{formatCAD(p.amount)}</span>
                  <span className="text-xs">{t(cadenceKeys[p.cadence] as TranslationKey)}</span>
                </p>

                <ul className="mb-6 mt-5 grid gap-2">
                  {(["f1", "f2", "f3"] as const).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground/85">
                      <Check size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                      {t(`home.gate.${p.k}.${f}` as TranslationKey)}
                    </li>
                  ))}
                </ul>

                <Link
                  to={p.to}
                  className={`mt-auto inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    p.featured
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "border border-border bg-secondary text-foreground hover:border-primary/40"
                  }`}
                >
                  {t(`home.gate.${p.k}.cta` as TranslationKey)} <ArrowRight size={15} aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-xs text-muted-foreground">{t("home.prices.note")}</p>
      </div>
    </section>
  );
}
