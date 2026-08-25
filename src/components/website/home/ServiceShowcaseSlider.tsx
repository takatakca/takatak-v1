"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/lib/website/nav";
import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { pricing, formatCAD, cadenceKeys, type Cadence } from "@/lib/website/pricing";
import { useLanguage } from "@/lib/website/use-language";
import type { TranslationKey } from "@/lib/website/i18n";

interface Slide {
  key: string;
  amount: number;
  cadence: Cadence;
  to: string;
  image: string;
}

const SLIDES: readonly Slide[] = [
  { key: "websites",   amount: pricing.websites[0].amount,  cadence: "one-time", to: "/services/websites",           image: "/marketplace/visuals/website.jpg" },
  { key: "infra",      amount: pricing.hosting[0].amount,   cadence: "monthly",  to: "/hosting",                     image: "/marketplace/visuals/seo.jpg" },
  { key: "branding",   amount: pricing.branding[0].amount,  cadence: "one-time", to: "/marketplace/category/logo_design", image: "/marketplace/visuals/logo.jpg" },
  { key: "marketing",  amount: pricing.marketing[0].amount, cadence: "one-time", to: "/services/marketing",          image: "/marketplace/visuals/social.jpg" },
  { key: "local",      amount: pricing.local[0].amount,     cadence: "one-time", to: "/services/local-listings",     image: "/marketplace/visuals/data.jpg" },
  { key: "leads",      amount: pricing.leads[0].amount,     cadence: "one-time", to: "/services/lead-generation",    image: "/marketplace/visuals/branding.jpg" },
  { key: "voip",       amount: pricing.voip[0].amount,      cadence: "monthly",  to: "/services/voip",               image: "/marketplace/visuals/mobile.jpg" },
  { key: "automation", amount: pricing.ai[0].amount,        cadence: "one-time", to: "/services/ai-business-tools",  image: "/marketplace/visuals/automation.jpg" },
];

export function ServiceShowcaseSlider() {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  const go = useCallback((next: number) => setIndex((next + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    if (!playing) return;
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, [playing]);

  const slide = SLIDES[index]!;
  const slideTitle = t(`slide.${slide.key}.title` as TranslationKey);

  return (
    <section
      className="border-b border-border bg-background"
      aria-roledescription="carousel"
      aria-label={t("home.slider.title")}
      onMouseEnter={() => setPlaying(false)}
      onMouseLeave={() => setPlaying(true)}
    >
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <h2 className="min-w-0 text-2xl font-bold text-foreground md:text-3xl">{t("home.slider.title")}</h2>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? t("home.slider.pause") : t("home.slider.play")} className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground">
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button type="button" onClick={() => go(index - 1)} aria-label={t("home.slider.prev")} className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label={t("home.slider.next")} className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          tabIndex={0}
          role="group"
          aria-label={`${slideTitle} — ${index + 1}/${SLIDES.length}`}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
            if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
          }}
          onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
          onTouchEnd={(e) => {
            const start = touchX.current;
            const end = e.changedTouches[0]?.clientX;
            if (start != null && end != null && Math.abs(end - start) > 45) go(index + (end < start ? 1 : -1));
            touchX.current = null;
          }}
          className="mt-7 overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)] outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
            <div className="order-2 flex flex-col justify-center gap-4 p-6 md:p-10 lg:order-1">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <BadgeCheck size={11} /> {t("home.slider.managed")}
              </span>
              <h3 key={slide.key} className="animate-fade-in text-2xl font-bold text-foreground md:text-3xl">{slideTitle}</h3>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">{t(`slide.${slide.key}.benefit` as TranslationKey)}</p>
              <p className="text-lg font-bold text-foreground">
                {t("price.from")} {formatCAD(slide.amount)}
                <span className="text-xs font-medium text-muted-foreground">{t(cadenceKeys[slide.cadence] as TranslationKey)} CAD</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {t(`slide.${slide.key}.chips` as TranslationKey).split(",").map((c) => (
                  <span key={c} className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">{c}</span>
                ))}
              </div>
              <Link to={slide.to as never} className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                {t(`slide.${slide.key}.cta` as TranslationKey)} <ArrowRight size={14} />
              </Link>
            </div>
            <div className="order-1 relative min-h-[220px] overflow-hidden border-b border-border lg:order-2 lg:border-b-0 lg:border-l">
              <img
                key={slide.image}
                src={slide.image}
                alt={t("home.slider.sample", { label: slideTitle })}
                loading="lazy"
                className="animate-fade-in h-full w-full object-cover"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => go(i)}
              aria-label={t("home.slider.show", { label: t(`slide.${s.key}.title` as TranslationKey) })}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-8 bg-primary" : "w-4 bg-border hover:bg-muted-foreground/50"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}