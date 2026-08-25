"use client";

import { Link } from "@/lib/website/nav";
import { ArrowRight, FileText, Layers, MessageSquare, Search, ShieldCheck, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import type { TranslationKey } from "@/lib/website/i18n";
import { Reveal } from "./Reveal";

const STEPS: readonly { n: string; icon: LucideIcon; k: string }[] = [
  { n: "01", icon: Search, k: "s1" },
  { n: "02", icon: FileText, k: "s2" },
  { n: "03", icon: MessageSquare, k: "s3" },
  { n: "04", icon: ShieldCheck, k: "s4" },
];

const PILLARS: readonly { icon: LucideIcon; k: string }[] = [
  { icon: Layers, k: "p1" },
  { icon: Wrench, k: "p2" },
  { icon: ShieldCheck, k: "p6" },
];

export function JourneySection() {
  const { t } = useLanguage();
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 md:py-24">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t("home.process.badge")}</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-foreground md:text-4xl">{t("home.journey.title")}</h2>
          <p className="mt-3 text-base text-muted-foreground">{t("home.journey.subtitle")}</p>
        </Reveal>

        <ol className="relative mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <span aria-hidden className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block" />
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal as="li" key={s.k} delay={i * 80} className="relative">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-card text-primary shadow-[var(--shadow-card)]">
                  <Icon size={19} />
                </span>
                <p className="mt-4 text-xs font-semibold tracking-widest text-muted-foreground">{s.n}</p>
                <h3 className="mt-1 text-base font-semibold text-foreground">{t(`home.process.${s.k}.title` as TranslationKey)}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{t(`home.process.${s.k}.desc` as TranslationKey)}</p>
              </Reveal>
            );
          })}
        </ol>

        <div className="mt-14 grid grid-cols-1 gap-4 rounded-2xl border border-border bg-secondary/40 p-6 sm:grid-cols-3 md:p-8">
          {PILLARS.map((p, i) => {
            const Icon = p.icon;
            return (
              <Reveal key={p.k} delay={i * 70}>
                <div className="flex gap-3">
                  <Icon size={18} className="mt-0.5 shrink-0 text-primary" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{t(`home.why.${p.k}.title` as TranslationKey)}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(`home.why.${p.k}.desc` as TranslationKey)}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/marketplace/post-project" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
            {t("home.process.cta1")} <ArrowRight size={15} />
          </Link>
          <Link to="/services" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground hover:border-primary/50">
            {t("home.process.cta2")}
          </Link>
        </div>
      </div>
    </section>
  );
}
