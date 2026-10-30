"use client";

import { ArrowRight, AudioLines, Clapperboard, ImageIcon, MessageSquare, PenLine, Search, Sparkles } from "lucide-react";

import { Kicker } from "@/components/website/premium/ui";
import { TAKBOT_MODES, creditsFor } from "@/lib/takbot/catalog";
import { takbotModeCopy } from "@/lib/takbot/copy";
import { homeCopy } from "@/lib/website/home-funnel";
import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";
import { sectionId } from "./HomeSectionNav";
import { TakbotOrbit } from "./TakbotOrbit";

export const MODE_ICONS = {
  chat: MessageSquare,
  write: PenLine,
  research: Search,
  image: ImageIcon,
  voice: AudioLines,
  video: Clapperboard,
} as const;

/** Homepage teaser for TAK bot, the master AI bot. */
export function TakbotSection() {
  const { lang } = useLanguage();
  return (
    <section
      id={sectionId("takbot")}
      aria-labelledby="home-takbot-title"
      className="relative overflow-hidden border-t border-white/[0.06] bg-[#040916] py-16 sm:py-24"
      style={{ scrollMarginTop: "calc(var(--tk-header-h, 64px) + 60px)" }}
    >
      <div aria-hidden className="tk-grid-lines pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 lg:grid-cols-2">
        <div>
          <Kicker>{homeCopy.takbot.kicker[lang]}</Kicker>
          <h2 id="home-takbot-title" className="tk-gradient-text mt-4 text-balance text-3xl font-extrabold leading-[1.06] tracking-[-0.03em] sm:text-5xl">
            {homeCopy.takbot.title[lang]}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/70">{homeCopy.takbot.subtitle[lang]}</p>
          <ul className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {TAKBOT_MODES.map((m) => {
              const Icon = MODE_ICONS[m.key];
              return (
                <li key={m.key}>
                  <Link
                    to={`/takbot?mode=${m.key}`}
                    className="tk-lift group flex h-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 hover:border-[#29C3FF]/40"
                  >
                    <span className="flex items-center justify-between">
                      <Icon size={18} className="text-[#29C3FF]" aria-hidden />
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] font-semibold text-white/65">
                        {creditsFor(m)} cr
                      </span>
                    </span>
                    <span className="text-[14px] font-bold text-white">{takbotModeCopy[m.key].name[lang]}</span>
                    <span className="text-[12px] leading-4 text-white/50">{takbotModeCopy[m.key].hint[lang]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/takbot" className="tk-btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold">
              <Sparkles size={16} aria-hidden /> {homeCopy.takbot.cta[lang]} <ArrowRight size={16} aria-hidden />
            </Link>
            <Link to="/takbot#credits" className="tk-btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-semibold">
              {homeCopy.takbot.credits[lang]}
            </Link>
          </div>
        </div>
        <div className="overflow-hidden">
          <TakbotOrbit size={520} />
        </div>
      </div>
    </section>
  );
}
