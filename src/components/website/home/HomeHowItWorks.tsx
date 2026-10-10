"use client";

import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/website/nav";
import type { TranslationKey } from "@/lib/website/i18n";
import { useLanguage } from "@/lib/website/use-language";
import { Reveal } from "./Reveal";

const STEPS = ["s1", "s2", "s3"] as const;

/** Three-step summary of the managed TAKATAK process. */
export function HomeHowItWorks() {
  const { t } = useLanguage();
  return (
    <section aria-labelledby="home-how-title" className="border-y border-border bg-secondary/50">
      <div className="mx-auto max-w-7xl px-4 py-16 md:py-24">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t("home.how.kicker")}</p>
          <h2 id="home-how-title" className="mt-3 text-balance text-3xl font-bold leading-tight text-foreground md:text-4xl">
            {t("home.how.title")}
          </h2>
        </Reveal>

        <ol className="relative mt-10 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          <span
            aria-hidden
            className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-7 hidden h-px bg-gradient-to-r from-primary/10 via-primary/40 to-primary/10 md:block"
          />
          {STEPS.map((s, i) => (
            <li key={s} className="relative rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] md:text-center">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground md:mx-auto">
                <span className="sr-only">{i + 1}. </span>
                <span aria-hidden>{String(i + 1).padStart(2, "0")}</span>
              </span>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{t(`home.how.${s}.title` as TranslationKey)}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(`home.how.${s}.desc` as TranslationKey)}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 md:text-center">
          <Link
            to="/marketplace/post-project"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            {t("home.lead.cta")} <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
