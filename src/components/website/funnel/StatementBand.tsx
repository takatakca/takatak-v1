"use client";

import { Fragment } from "react";

import { TAKBOT_ENGINES } from "@/lib/takbot/catalog";
import { CORE_CATEGORIES, SOCIAL_NETWORKS_LIVE } from "@/lib/website/core-categories";
import { homeV2 } from "@/lib/website/home-funnel";
import { useLanguage } from "@/lib/website/use-language";
import { Rise } from "./primitives";

/** Oversized moving type that names every service, then the proof in numbers. */
export function StatementBand() {
  const { lang } = useLanguage();
  const words = homeV2.band.words[lang];
  // Numbers come from the code, so the band can never drift from the product.
  const values = [String(CORE_CATEGORIES.length), String(TAKBOT_ENGINES.length), String(SOCIAL_NETWORKS_LIVE.length), "FR · EN"];

  const row = (outlined: boolean) => (
    <div className="flex w-max items-center">
      {[0, 1].map((copy) => (
        <div key={copy} aria-hidden={copy === 1 ? true : undefined} className="flex items-center">
          {words.map((w, i) => (
            <Fragment key={`${copy}-${w}`}>
              <span
                className={`whitespace-nowrap px-6 font-[family-name:var(--font-website-display)] text-[64px] font-bold leading-none tracking-[-0.04em] sm:text-[112px] ${
                  outlined === (i % 2 === 0) ? "tk-outline-text" : "text-white"
                }`}
              >
                {w}
              </span>
              <span aria-hidden className="h-3 w-3 shrink-0 rounded-full bg-[#1F8BFF] shadow-[0_0_24px_#1F8BFF]" />
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <section aria-label={words.join(", ")} className="tk-grain relative overflow-hidden border-y border-white/[0.06] bg-[#040A18] py-14 sm:py-20">
      <div className="tk-marquee-mask">
        <div className="tk-marquee">{row(false)}</div>
      </div>
      <div className="tk-marquee-mask mt-2">
        <div className="tk-marquee tk-marquee-reverse">{row(true)}</div>
      </div>

      <dl className="mx-auto mt-14 grid max-w-7xl grid-cols-2 gap-y-8 px-4 sm:mt-20 lg:grid-cols-4">
        {homeV2.band.proof.map((p, i) => (
          <Rise key={p.label.en} delay={i * 90} className={`px-1 lg:px-8 ${i > 0 ? "lg:border-l lg:border-white/10" : ""}`}>
            <dt className="sr-only">{p.label[lang]}</dt>
            <dd>
              <span className="block font-[family-name:var(--font-website-display)] text-[44px] font-bold leading-none tracking-[-0.04em] text-white sm:text-[56px]">
                {values[i]}
              </span>
              <span className="mt-3 block text-[14px] text-white/55">{p.label[lang]}</span>
            </dd>
          </Rise>
        ))}
      </dl>
    </section>
  );
}
