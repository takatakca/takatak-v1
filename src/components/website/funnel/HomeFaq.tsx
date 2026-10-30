"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Kicker } from "@/components/website/premium/ui";
import { HOME_FAQ, homeCopy } from "@/lib/website/home-funnel";
import { useLanguage } from "@/lib/website/use-language";
import { sectionId } from "./HomeSectionNav";

/** Short answers to the questions that stop a sign-up. */
export function HomeFaq() {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(0);
  return (
    <section
      id={sectionId("faq")}
      aria-labelledby="home-faq-title"
      className="relative border-t border-white/[0.06] py-16 sm:py-24"
      style={{ scrollMarginTop: "calc(var(--tk-header-h, 64px) + 60px)" }}
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <Kicker>{homeCopy.faq.kicker[lang]}</Kicker>
          <h2 id="home-faq-title" className="mt-4 text-3xl font-extrabold tracking-[-0.025em] text-white sm:text-[44px]">
            {homeCopy.faq.title[lang]}
          </h2>
        </div>
        <ul className="grid gap-3">
          {HOME_FAQ.map((item, i) => {
            const on = open === i;
            return (
              <li key={item.q.en} className={`rounded-2xl border transition-colors ${on ? "border-[#1F8BFF]/50 bg-[#1F8BFF]/[0.07]" : "border-white/10 bg-white/[0.03]"}`}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={on}
                    aria-controls={`home-faq-${i}`}
                    onClick={() => setOpen(on ? -1 : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15.5px] font-semibold text-white"
                  >
                    {item.q[lang]}
                    <Plus size={18} className={`shrink-0 text-[#29C3FF] transition-transform duration-300 ${on ? "rotate-45" : ""}`} aria-hidden />
                  </button>
                </h3>
                <div id={`home-faq-${i}`} className={`grid transition-[grid-template-rows] duration-300 ${on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <p className="overflow-hidden px-5 text-[14.5px] leading-7 text-white/70">
                    <span className="block pb-5">{item.a[lang]}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
