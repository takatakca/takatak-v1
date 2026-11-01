"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, AudioLines, Clapperboard, ImageIcon, Lock, MessageSquare, PenLine, Search } from "lucide-react";

import { money } from "@/components/website/premium/ui";
import { TAKBOT_MODES, TAKBOT_PACKS, creditsFor } from "@/lib/takbot/catalog";
import { takbotModeCopy } from "@/lib/takbot/copy";
import { homeCopy, homeV2 } from "@/lib/website/home-funnel";
import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";
import { sectionId } from "./HomeSectionNav";
import { Eyebrow, Magnetic, PointHere, Rise, Section, TwoTone, useSpotlight } from "./primitives";

/** Mode icons, shared with the /takbot studio. */
export const MODE_ICONS = {
  chat: MessageSquare,
  write: PenLine,
  research: Search,
  image: ImageIcon,
  voice: AudioLines,
  video: Clapperboard,
} as const;

type Screen = "takbot" | "dashboard";

const SCREENS: Record<Screen, { src: (lang: "en" | "fr") => string; poster: (lang: "en" | "fr") => string; to: string; ratio: string }> = {
  takbot: {
    src: (lang) => `/media/product/takbot-${lang}.mp4`,
    poster: (lang) => `/media/product/takbot-${lang}.jpg`,
    to: "/takbot",
    ratio: "aspect-[880/560]",
  },
  dashboard: {
    src: () => "/media/product/dashboard.mp4",
    poster: () => "/media/product/dashboard.jpg",
    to: "/login",
    ratio: "aspect-[1280/800]",
  },
};

/** The real app in a browser frame: recordings of takatak.ca, two tabs, click to open it. */
function ProductViewer() {
  const { lang } = useLanguage();
  const reduced = useReducedMotion();
  const [screen, setScreen] = useState<Screen>("takbot");
  const video = useRef<HTMLVideoElement>(null);
  const t = homeV2.takbot;
  const s = SCREENS[screen];

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.load();
    if (!reduced) v.play().catch(() => undefined);
  }, [screen, lang, reduced]);

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-[22px] bg-[#0B1220] shadow-[0_50px_120px_-40px_rgb(0_0_0/0.9)] ring-1 ring-white/10">
        {/* Browser bar */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-3 w-3 rounded-full bg-white/15" />
            <span className="h-3 w-3 rounded-full bg-white/15" />
            <span className="h-3 w-3 rounded-full bg-white/15" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-[13.5px] text-white/60">
            <Lock size={12} aria-hidden /> <span className="truncate">{t.url[screen]}</span>
          </span>
          <div role="tablist" aria-label="TAKATAK" className="flex gap-1 rounded-full bg-white/[0.06] p-1">
            {(["takbot", "dashboard"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={screen === k}
                onClick={() => setScreen(k)}
                className={`rounded-full px-3 py-1 text-[13.5px] font-semibold transition-colors ${screen === k ? "bg-white text-[#060D1F]" : "text-white/65 hover:text-white"}`}
              >
                {t.tabs[k][lang]}
              </button>
            ))}
          </div>
        </div>
        {/* The recording; the whole screen opens the real page. */}
        <Link to={s.to} className={`group relative block ${s.ratio} bg-white`} aria-label={t.open[screen][lang]}>
          <video
            ref={video}
            key={`${screen}-${lang}`}
            className="tk-fade-in absolute inset-0 h-full w-full object-cover object-top"
            poster={s.poster(lang)}
            autoPlay={!reduced}
            muted
            loop
            playsInline
            preload="metadata"
          >
            <source src={s.src(lang)} type="video/mp4" />
          </video>
          <span className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/45 via-transparent to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-[#060D1F]">
              {t.open[screen][lang]} <ArrowRight size={15} aria-hidden />
            </span>
          </span>
        </Link>
      </div>
      <p className="mt-3 text-[13.5px] text-white/45">{t.real[lang]}</p>
    </div>
  );
}

/** Homepage chapter for TAK bot: the real product, real credit costs and real pack prices. */
export function TakbotSection() {
  const { lang } = useLanguage();
  const spot = useSpotlight<HTMLDivElement>();
  const t = homeV2.takbot;
  const perCredit = TAKBOT_PACKS.map((p) => p.priceCad / p.credits);
  const best = perCredit.indexOf(Math.min(...perCredit));
  return (
    // Always a dark chapter, in both themes.
    <div className="hp" data-theme="dark" {...spot}>
      <Section id={sectionId("takbot")} labelledBy="home-takbot-title" className="tk-grain overflow-hidden bg-[#030812] py-20 sm:py-28">
        <div aria-hidden className="hp-tech-grid" />
        <div aria-hidden className="hp-spot-layer" />
        <div className="relative mx-auto max-w-7xl px-4">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
            <Rise>
              <Eyebrow>{t.eyebrow[lang]}</Eyebrow>
              <TwoTone id="home-takbot-title" lead={t.lead[lang]} rest={t.rest[lang]} size="md" />
              <p className="mt-6 max-w-lg text-[16.5px] leading-8 text-white/65">{t.body[lang]}</p>

              <p className="mt-9 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-white/40">{t.perRequest[lang]}</p>
              <ul className="mt-3 grid max-w-lg grid-cols-2 gap-x-6 border-t border-white/10 sm:grid-cols-3">
                {TAKBOT_MODES.map((m) => (
                  <li key={m.key} className="border-b border-white/10">
                    <Link to={`/takbot?mode=${m.key}`} className="group flex items-center gap-2.5 py-3 text-[14.5px] text-white/80 hover:text-white">
                      {takbotModeCopy[m.key].name[lang]}
                      <span className="ml-auto text-[13px] tabular-nums text-white/45 group-hover:text-white/70">{creditsFor(m)}</span>
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="relative mt-9 flex flex-wrap items-center gap-3">
                <PointHere label={lang === "fr" ? "Essayez-le" : "Try it"} flip color="#29C3FF" className="left-[230px] -top-9 hidden sm:flex" />
                <Magnetic>
                  <Link to="/takbot" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-semibold text-[#060D1F] transition-transform hover:scale-[1.03]">
                    {homeCopy.takbot.cta[lang]} <ArrowRight size={16} aria-hidden />
                  </Link>
                </Magnetic>
              </div>
            </Rise>
            <Rise delay={120}>
              <ProductViewer />
            </Rise>
          </div>

          {/* Real pack prices from the catalog. */}
          <Rise className="mt-16">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-white/40">{t.packs[lang]}</p>
            <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {TAKBOT_PACKS.map((p, i) => (
                <li key={p.key} className={`hp-glow relative flex flex-col rounded-[20px] p-5 ring-1 ${i === best ? "bg-white/[0.07] ring-[#29C3FF]/50" : "bg-white/[0.03] ring-white/10"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-semibold text-white">{p.label}</p>
                    {i === best && <span className="rounded-full bg-[#29C3FF]/15 px-2 py-0.5 text-[10.5px] font-semibold text-[#7FD8FF]">{t.best[lang]}</span>}
                  </div>
                  <p className="mt-3 text-[13px] text-white/55">
                    {p.credits.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")} {t.credits[lang]}
                  </p>
                  <p className="hp-display mt-1 text-[30px] leading-none text-white">{money(lang, p.priceCad)}</p>
                  <p className="mt-1.5 text-[13px] tabular-nums text-white/40">
                    {money(lang, Math.round(perCredit[i] * 1000) / 1000)} {t.perCredit[lang]}
                  </p>
                  <Link to="/takbot#credits" className="mt-4 inline-flex items-center gap-1.5 self-start rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold text-white hover:bg-white/20">
                    {t.buy[lang]} <ArrowRight size={14} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Rise>
        </div>
      </Section>
    </div>
  );
}
