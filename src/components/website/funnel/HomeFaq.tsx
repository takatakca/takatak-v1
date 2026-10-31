"use client";

import { useState } from "react";
import { Headset, Plus } from "lucide-react";

import { openLiveChat } from "@/lib/website/chat-provider";
import { HOME_FAQ, homeV2 } from "@/lib/website/home-funnel";
import { useLanguage } from "@/lib/website/use-language";
import { sectionId } from "./HomeSectionNav";
import { Eyebrow, Rise, Section, TwoTone } from "./primitives";

/** Short answers to the questions that stop a sign-up. */
export function HomeFaq() {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(0);
  return (
    <Section id={sectionId("faq")} labelledBy="home-faq-title" className="py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Rise>
          <Eyebrow>{homeV2.faq.eyebrow[lang]}</Eyebrow>
          <TwoTone id="home-faq-title" lead={homeV2.faq.lead[lang]} rest={homeV2.faq.rest[lang]} />
          <button
            type="button"
            onClick={() => openLiveChat({ page: "/", intent: "faq", lang })}
            className="mt-8 inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14.5px] font-semibold text-white ring-1 ring-white/20 hover:bg-white/[0.06]"
          >
            <Headset size={16} className="text-[#29C3FF]" aria-hidden /> {lang === "fr" ? "Parler à TAKATAK" : "Talk to TAKATAK"}
          </button>
        </Rise>
        <ul className="border-t border-white/10">
          {HOME_FAQ.map((item, i) => {
            const on = open === i;
            return (
              <li key={item.q.en} className="border-b border-white/10">
                <h3>
                  <button
                    type="button"
                    aria-expanded={on}
                    aria-controls={`home-faq-${i}`}
                    onClick={() => setOpen(on ? -1 : i)}
                    className="flex w-full items-center justify-between gap-6 py-6 text-left font-[family-name:var(--font-website-display)] text-[19px] font-semibold tracking-[-0.01em] text-white sm:text-[21px]"
                  >
                    {item.q[lang]}
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1 transition-all duration-500 ${on ? "rotate-45 bg-white text-[#060D1F] ring-white" : "text-white ring-white/20"}`}>
                      <Plus size={17} aria-hidden />
                    </span>
                  </button>
                </h3>
                <div id={`home-faq-${i}`} className={`grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <p className="overflow-hidden text-[16px] leading-7 text-white/60">
                    <span className="block max-w-2xl pb-7">{item.a[lang]}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
