"use client";

import { SUITE_GROUPS, homeCopy } from "@/lib/website/home-funnel";
import { TAKBOT_ENGINES } from "@/lib/takbot/catalog";
import { useLanguage } from "@/lib/website/use-language";

/** Two endless rows, opposite directions: TAKATAK products on top, the AI engines TAK bot relays to below. */
export function SuiteMarquee() {
  const { lang } = useLanguage();
  const products = SUITE_GROUPS.flatMap((g) => g.products.map((p) => p.name));
  const engines = TAKBOT_ENGINES.map((e) => e.name);

  const row = (items: string[], reverse: boolean, accent: boolean) => (
    <div className="tk-marquee-mask relative overflow-hidden py-2">
      <div className={`tk-marquee flex w-max gap-3 ${reverse ? "tk-marquee-reverse" : ""}`}>
        {[...items, ...items].map((name, i) => (
          <span
            key={`${name}-${i}`}
            aria-hidden={i >= items.length ? true : undefined}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold tracking-wide ${
              accent ? "border-[#29C3FF]/25 bg-[#29C3FF]/[0.06] text-[#BDEBFF]" : "border-white/10 bg-white/[0.04] text-white/80"
            }`}
          >
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${accent ? "bg-[#29C3FF]" : "bg-[#1F8BFF]"}`} />
            {name}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <section aria-label={homeCopy.marquee.label[lang]} className="relative border-b border-white/[0.06] bg-[#050B1A] py-6">
      <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45">{homeCopy.marquee.label[lang]}</p>
      {row(products, false, false)}
      {row(engines, true, true)}
    </section>
  );
}
