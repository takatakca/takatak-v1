"use client";

import { ArrowDown, ArrowRight, Headset } from "lucide-react";

import { openLiveChat } from "@/lib/website/chat-provider";
import { Link } from "@/lib/website/nav";
import { HeroLiveBrowser } from "./HeroLiveBrowser";
import { NavyBackdrop, useCopy } from "./ui";

/** Homepage hero: brand promise, start actions, and a laptop whose browser bar is the service search. */
export function PremiumHero() {
  const { tk, lang } = useCopy();

  return (
    <section aria-labelledby="home-hero-title" className="relative overflow-hidden">
      <NavyBackdrop grid />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 pb-16 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10 lg:pb-24 lg:pt-20">
        <div>
          <p className="tk-glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.26em] text-white/80 sm:text-[11px]">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--tk-cyan)] shadow-[0_0_12px_var(--tk-cyan)]" />
            {tk("home.lead.eyebrow")}
          </p>
          <h1
            id="home-hero-title"
            className="tk-gradient-text mt-6 text-balance text-[42px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[68px]"
          >
            {tk("home.lead.title")}
          </h1>
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--tk-cyan)] sm:text-[13px] sm:tracking-[0.32em]">
            {tk("home.lead.tagline")}
          </p>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/72 sm:text-[17px]">{tk("home.p.subtitle")}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/register"
              className="tk-btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tk-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--tk-navy)]"
            >
              {tk("home.p.ctaStart")} <ArrowRight size={16} aria-hidden />
            </Link>
            <a
              href="#core"
              className="tk-btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tk-cyan)]"
            >
              {tk("home.p.ctaExplore")} <ArrowDown size={16} aria-hidden />
            </a>
          </div>
          <button
            type="button"
            onClick={() => openLiveChat({ page: "/", intent: "hero_concierge", lang })}
            className="mt-4 inline-flex items-center gap-2 rounded-lg py-2 text-sm font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tk-cyan)]"
          >
            <Headset size={16} className="text-[var(--tk-cyan)]" aria-hidden /> {tk("home.hero.ctaChat")}
          </button>
        </div>

        {/* The search lives in the laptop's browser bar */}
        <HeroLiveBrowser />
      </div>
    </section>
  );
}
