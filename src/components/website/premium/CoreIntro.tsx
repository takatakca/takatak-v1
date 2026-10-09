"use client";

import { Reveal } from "@/components/website/home/Reveal";
import { NUMBERED_CATEGORIES, SOCIAL_NETWORKS_LIVE } from "@/lib/website/core-categories";
import { pricing } from "@/lib/website/pricing";
import { CountUp, Kicker, useCopy } from "./ui";

/** Section title for the core categories, with counters for real numbers from the code. */
export function CoreIntro() {
  const { tk, lang } = useCopy();
  const stats = [
    { value: NUMBERED_CATEGORIES.length, label: tk("home.core.stat.services") },
    { value: SOCIAL_NETWORKS_LIVE.length, label: tk("home.core.stat.networks") },
    { value: pricing.hosting.length, label: tk("home.core.stat.hosting") },
    {
      value: pricing.domain.register.amount,
      label: tk("home.core.stat.domain"),
      format: (n: number) =>
        new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
          style: "currency",
          currency: "CAD",
          currencyDisplay: "narrowSymbol",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(n),
    },
  ];
  return (
    <section aria-labelledby="home-core-title" className="relative">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:pt-14">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Reveal>
            <Kicker>{tk("home.core.kicker")}</Kicker>
            <h2 id="home-core-title" className="mt-4 text-balance text-3xl font-extrabold leading-[1.08] tracking-[-0.025em] text-white sm:text-[44px]">
              {tk("home.core.title")}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/68">{tk("home.core.subtitle")}</p>
          </Reveal>
          <Reveal delay={120}>
            <dl className="grid grid-cols-2 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="tk-glass rounded-2xl p-4 sm:p-5">
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <CountUp
                      value={s.value}
                      format={s.format}
                      className="tk-gradient-text block text-3xl font-extrabold tracking-tight sm:text-4xl"
                    />
                    <span className="mt-1 block text-[13px] leading-5 text-white/60">{s.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
