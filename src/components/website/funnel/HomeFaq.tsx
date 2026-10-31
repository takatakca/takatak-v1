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
    <Section id={sectionId("faq")} labelledBy="home-faq-title" className="hp-bg py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Rise>
          <Eyebrow>{homeV2.faq.eyebrow[lang]}</Eyebrow>
          <TwoTone id="home-faq-title" lead={homeV2.faq.lead[lang]} rest={homeV2.faq.rest[lang]} />
          <button
            type="button"
            onClick={() => openLiveChat({ page: "/", intent: "faq", lang })}
            className="hp-ghost hp-focus mt-8 inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14.5px] font-semibold"
          >
            <Headset size={16} className="hp-accent" aria-hidden /> {lang === "fr" ? "Parler à TAKATAK" : "Talk to TAKATAK"}
          </button>
        </Rise>
        <ul className="hp-line border-t">
          {HOME_FAQ.map((item, i) => {
            const on = open === i;
            return (
              <li key={item.q.en} className="hp-line border-b">
                <h3>
                  <button
                    type="button"
                    aria-expanded={on}
                    aria-controls={`home-faq-${i}`}
                    onClick={() => setOpen(on ? -1 : i)}
                    className="hp-ink hp-focus flex w-full items-center justify-between gap-6 py-6 text-left text-[18px] font-semibold tracking-[-0.015em] sm:text-[20px]"
                  >
                    {item.q[lang]}
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1 transition-all duration-500 ${on ? "hp-btn rotate-45 ring-transparent" : "hp-ink ring-[var(--hp-line)]"}`}>
                      <Plus size={17} aria-hidden />
                    </span>
                  </button>
                </h3>
                <div id={`home-faq-${i}`} className={`grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <p className="hp-ink-2 overflow-hidden text-[16px] leading-7">
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
