"use client";

import { useState } from "react";
import { Headset, MessageSquareText, Mic, Plus, Sparkles } from "lucide-react";

import { openLiveChat } from "@/lib/website/chat-provider";
import { HOME_FAQ, homeV2 } from "@/lib/website/home-funnel";
import { useLanguage } from "@/lib/website/use-language";
import { sectionId } from "./HomeSectionNav";
import { openConcierge } from "./OfferRail";
import { Eyebrow, Rise, Section, TwoTone } from "./primitives";

/** Short answers to the questions that stop a sign-up. */
export function HomeFaq() {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(0);
  return (
    <Section id={sectionId("faq")} labelledBy="home-faq-title" className="hp-bg py-14 sm:py-20">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Rise>
          <Eyebrow>{homeV2.faq.eyebrow[lang]}</Eyebrow>
          <TwoTone id="home-faq-title" lead={homeV2.faq.lead[lang]} rest={homeV2.faq.rest[lang]} />
          <div className="hp-card hp-glow mt-8 max-w-md rounded-[24px] p-5 ring-1 ring-[var(--hp-line)]">
            <p className="hp-ink flex items-center gap-2 text-[15.5px] font-semibold">
              <Sparkles size={16} className="hp-accent" aria-hidden />
              {lang === "fr" ? "Votre question n’est pas là ?" : "Your question isn’t here?"}
            </p>
            <p className="hp-ink-2 mt-1.5 text-[14.5px] leading-6">
              {lang === "fr"
                ? "Demandez à l’assistant ventes : services, prix, délais. Écrivez ou parlez."
                : "Ask the sales assistant: services, prices, timing. Type or talk."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => openConcierge()} className="hp-cta hp-focus inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-semibold">
                <MessageSquareText size={15} aria-hidden /> {lang === "fr" ? "Écrire" : "Type"}
              </button>
              <button type="button" onClick={() => openConcierge({ voice: true })} className="hp-ghost hp-focus inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-semibold">
                <Mic size={15} aria-hidden /> {lang === "fr" ? "Parler" : "Talk"}
              </button>
              <button
                type="button"
                onClick={() => openLiveChat({ page: "/", intent: "faq", lang })}
                className="hp-ghost hp-focus inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-semibold"
              >
                <Headset size={15} aria-hidden /> {lang === "fr" ? "Un humain" : "A person"}
              </button>
            </div>
          </div>
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
