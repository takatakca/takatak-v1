"use client";

import { Link } from "@/lib/website/nav";
import { ArrowRight, Check, Rocket, TrendingUp, Cog } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { pricing, formatCAD, cadenceKeys, type Cadence } from "@/lib/website/pricing";
import { useLanguage } from "@/lib/website/use-language";
import type { TranslationKey } from "@/lib/website/i18n";
import { Reveal } from "./Reveal";
import { TiltCard } from "./TiltCard";

interface Gateway {
  k: "launch" | "grow" | "operate";
  icon: LucideIcon;
  amount: number;
  cadence: Cadence;
  to: string;
  featured?: boolean;
}

const GATEWAYS: readonly Gateway[] = [
  { k: "launch",  icon: Rocket,     amount: pricing.websites[0].amount,  cadence: "one-time", to: "/services/websites" },
  { k: "grow",    icon: TrendingUp, amount: pricing.marketing[0].amount, cadence: "one-time", to: "/services/marketing", featured: true },
  { k: "operate", icon: Cog,        amount: pricing.ai[0].amount,        cadence: "one-time", to: "/services/ai-business-tools" },
];

export function PricingGateways() {
  const { t } = useLanguage();
  return (
    <section className="brand-dark relative overflow-hidden border-y border-border">
      <div
        aria-hidden
        className="tk-grid-drift pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(var(--brand-dark-border) 1px, transparent 1px), linear-gradient(90deg, var(--brand-dark-border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 py-16 md:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold leading-tight text-foreground md:text-4xl">{t("home.gate.title")}</h2>
          <p className="mt-3 text-base text-muted-foreground">{t("home.gate.subtitle")}</p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {GATEWAYS.map((g, i) => {
            const Icon = g.icon;
            return (
              <Reveal key={g.k} delay={i * 90}>
                <TiltCard max={5}>
                  <div
                    className={`tk-sheen relative flex h-full flex-col rounded-2xl border bg-card/70 p-7 backdrop-blur-sm transition-colors ${
                      g.featured ? "border-primary/60 shadow-[var(--shadow-glow)]" : "border-border"
                    }`}
                  >
                    {g.featured && (
                      <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                        {t("home.gate.popular")}
                      </span>
                    )}
                    <div className="tk-tilt-layer flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
                        <Icon size={20} />
                      </span>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{t(`home.gate.${g.k}.name` as TranslationKey)}</h3>
                        <p className="text-xs uppercase tracking-wider text-primary">{t(`home.gate.${g.k}.tag` as TranslationKey)}</p>
                      </div>
                    </div>

                    <p className="mt-5 text-sm leading-6 text-muted-foreground">{t(`home.gate.${g.k}.desc` as TranslationKey)}</p>

                    <p className="mt-5 text-sm text-muted-foreground">
                      {t("home.gate.from")}{" "}
                      <span className="text-2xl font-bold text-foreground">{formatCAD(g.amount)}</span>
                      <span className="text-xs">{t(cadenceKeys[g.cadence] as TranslationKey)}</span>
                    </p>

                    <ul className="mt-6 grid gap-2.5">
                      {(["f1", "f2", "f3"] as const).map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-foreground/85">
                          <Check size={15} className="mt-0.5 shrink-0 text-primary" />
                          {t(`home.gate.${g.k}.${f}` as TranslationKey)}
                        </li>
                      ))}
                    </ul>

                    <Link
                      to={g.to as never}
                      className={`mt-auto inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold ${
                        g.featured
                          ? "tk-glow-cta text-primary-foreground"
                          : "border border-white/15 bg-white/5 text-foreground hover:bg-white/10"
                      }`}
                      style={g.featured ? { backgroundImage: "var(--gradient-hero)" } : undefined}
                    >
                      {t(`home.gate.${g.k}.cta` as TranslationKey)} <ArrowRight size={15} />
                    </Link>
                  </div>
                </TiltCard>
              </Reveal>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            {t("home.gate.all")} <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
