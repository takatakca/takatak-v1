"use client";

import { ArrowRight, AudioLines, Clapperboard, ImageIcon, MessageSquare, PenLine, Search } from "lucide-react";

import { TAKBOT_MODES, creditsFor } from "@/lib/takbot/catalog";
import { takbotModeCopy } from "@/lib/takbot/copy";
import { homeCopy, homeV2 } from "@/lib/website/home-funnel";
import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";
import { sectionId } from "./HomeSectionNav";
import { Aurora, Eyebrow, Rise, Section, TwoTone } from "./primitives";
import { TakbotDemo } from "./TakbotDemo";

export const MODE_ICONS = {
  chat: MessageSquare,
  write: PenLine,
  research: Search,
  image: ImageIcon,
  voice: AudioLines,
  video: Clapperboard,
} as const;

/** Homepage chapter for TAK bot, the master AI bot. */
export function TakbotSection() {
  const { lang } = useLanguage();
  return (
    // Always a dark chapter, in both themes: TAK bot is the night sky of the page.
    <div className="hp" data-theme="dark">
    <Section id={sectionId("takbot")} labelledBy="home-takbot-title" className="tk-grain overflow-hidden bg-[#030812] py-20 sm:py-32">
      <div aria-hidden className="absolute inset-0 opacity-70">
        <Aurora />
      </div>
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Rise>
          <Eyebrow>{homeV2.takbot.eyebrow[lang]}</Eyebrow>
          <TwoTone id="home-takbot-title" lead={homeV2.takbot.lead[lang]} rest={homeV2.takbot.rest[lang]} />
          <p className="mt-6 max-w-lg text-[17px] leading-8 text-white/60">{homeV2.takbot.body[lang]}</p>

          <ul className="mt-9 grid max-w-lg grid-cols-2 gap-x-6 border-t border-white/10 sm:grid-cols-3">
            {TAKBOT_MODES.map((m) => {
              const Icon = MODE_ICONS[m.key];
              return (
                <li key={m.key} className="border-b border-white/10">
                  <Link to={`/takbot?mode=${m.key}`} className="group flex items-center gap-2.5 py-3.5 text-[14.5px] text-white/75 hover:text-white">
                    <Icon size={16} className="text-[#29C3FF]" aria-hidden />
                    {takbotModeCopy[m.key].name[lang]}
                    <span className="ml-auto text-[11.5px] tabular-nums text-white/35 group-hover:text-white/60">{creditsFor(m)} cr</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/takbot" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-semibold text-[#060D1F] transition-transform hover:scale-[1.03]">
              {homeCopy.takbot.cta[lang]} <ArrowRight size={16} aria-hidden />
            </Link>
            <Link to="/takbot#credits" className="inline-flex items-center gap-2 rounded-full px-5 py-3.5 text-[15px] font-semibold text-white ring-1 ring-white/20 hover:bg-white/[0.06]">
              {homeCopy.takbot.credits[lang]}
            </Link>
          </div>
        </Rise>
        <Rise delay={150}>
          <TakbotDemo />
        </Rise>
      </div>
    </Section>
    </div>
  );
}
