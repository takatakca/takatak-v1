"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Headset } from "lucide-react";

import { Kicker, SegmentedTabs } from "@/components/website/premium/ui";
import { openLiveChat } from "@/lib/website/chat-provider";
import { SUITE_GROUPS, homeCopy, type SuiteStatus } from "@/lib/website/home-funnel";
import { externalLinkProps } from "@/lib/website/product-destinations";
import { useLanguage } from "@/lib/website/use-language";
import { sectionId } from "./HomeSectionNav";

const STATUS_STYLE: Record<SuiteStatus, string> = {
  live: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  early: "border-sky-300/30 bg-sky-300/10 text-sky-100",
  clover: "border-white/20 bg-white/[0.06] text-white/80",
  soon: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  planned: "border-amber-300/35 bg-amber-300/10 text-amber-100",
};

/** TAKATAK's own products, grouped by who they serve, with their real status. */
export function SuiteShowcase() {
  const { lang } = useLanguage();
  const [groupKey, setGroupKey] = useState(SUITE_GROUPS[0].key);
  const group = SUITE_GROUPS.find((g) => g.key === groupKey) ?? SUITE_GROUPS[0];

  return (
    <section
      id={sectionId("suite")}
      aria-labelledby="home-suite-title"
      className="relative border-t border-white/[0.06] py-16 sm:py-24"
      style={{ scrollMarginTop: "calc(var(--tk-header-h, 64px) + 60px)" }}
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <Kicker>{homeCopy.suite.kicker[lang]}</Kicker>
            <h2 id="home-suite-title" className="mt-4 text-balance text-3xl font-extrabold leading-[1.08] tracking-[-0.025em] text-white sm:text-[44px]">
              {homeCopy.suite.title[lang]}
            </h2>
            <p className="mt-4 text-base leading-7 text-white/68">{homeCopy.suite.subtitle[lang]}</p>
          </div>
          <SegmentedTabs
            items={SUITE_GROUPS.map((g) => ({ id: g.key, label: g.title[lang] }))}
            value={group.key}
            onChange={setGroupKey}
            idBase="home-suite"
            label={homeCopy.suite.kicker[lang]}
          />
        </div>

        <div id="home-suite-panel" role="tabpanel" aria-labelledby={`home-suite-tab-${group.key}`} key={group.key} className="tk-slide-in mt-10 grid gap-6 lg:grid-cols-12">
          <div className="group relative overflow-hidden rounded-[28px] border border-white/10 lg:col-span-5">
            <div className="tk-zoom relative h-full min-h-[320px]">
              <Image src={group.image} alt="" fill sizes="(min-width: 1024px) 500px, 100vw" className="object-cover" />
              <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgb(6_13_31/0.15),rgb(6_13_31/0.95)_75%)]" />
            </div>
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <p className="text-2xl font-extrabold text-white">{group.title[lang]}</p>
              <p className="mt-3 text-[15px] leading-7 text-white/75">{group.lead[lang]}</p>
              <button
                type="button"
                onClick={() => openLiveChat({ page: "/", intent: `suite_${group.key}`, lang })}
                className="tk-btn-primary mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
              >
                <Headset size={16} aria-hidden /> {homeCopy.suite.ask[lang]}
              </button>
            </div>
          </div>

          <ul className="grid content-start gap-3 sm:grid-cols-2 lg:col-span-7">
            {group.products.map((p, i) => {
              const inner = (
                <>
                  <span className="flex items-start justify-between gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[linear-gradient(145deg,#1F8BFF,#29C3FF)] text-[13px] font-extrabold tracking-wide text-white shadow-[0_10px_24px_-12px_#1F8BFF]">
                      {p.mono}
                    </span>
                    {p.url && <ArrowUpRight size={16} className="text-white/40 transition-colors group-hover:text-white" aria-hidden />}
                  </span>
                  <span className="mt-3 block text-[15px] font-bold tracking-wide text-white">{p.name}</span>
                  <span className="mt-1 block text-[13px] leading-5 text-white/60">{p.desc[lang]}</span>
                  <span className={`mt-3 inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] ${STATUS_STYLE[p.status]}`}>
                    {homeCopy.suite.status[p.status][lang]}
                  </span>
                </>
              );
              const cls = "tk-lift group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.035] p-4 hover:border-[#1F8BFF]/45";
              return (
                <li key={p.key} className="tk-stagger" style={{ animationDelay: `${i * 45}ms` }}>
                  {p.url ? (
                    <a href={p.url} {...externalLinkProps} className={cls} aria-label={`${homeCopy.suite.open[lang]} ${p.name}`}>
                      {inner}
                    </a>
                  ) : (
                    <div className={cls}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
