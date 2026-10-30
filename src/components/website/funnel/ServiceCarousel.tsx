"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Image from "next/image";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Pause, Play, Plus } from "lucide-react";

import { ScaledMock } from "@/components/website/premium/ScaledMock";
import { AvailabilityBadge, CategoryIcon, FromLine, Kicker, accentStyle, useCopy } from "@/components/website/premium/ui";
import { CORE_CATEGORIES } from "@/lib/website/core-categories";
import { fill, homeCopy } from "@/lib/website/home-funnel";
import { useHomePlan } from "@/lib/website/home-plan";
import { Link } from "@/lib/website/nav";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";
import { sectionId } from "./HomeSectionNav";

const AUTOPLAY_MS = 6500;

/**
 * The ten services as one stage: the active slide zooms in, neighbours fall
 * back. Auto-plays (paused on hover, focus, hidden tab or reduced motion),
 * swipes on touch, and answers the arrow keys.
 */
export function ServiceCarousel() {
  const { tk, lang } = useCopy();
  const plan = useHomePlan();
  const reduced = useReducedMotion();
  const total = CORE_CATEGORIES.length;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hover, setHover] = useState(false);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; id: number } | null>(null);

  const go = useCallback((i: number) => setIndex(((i % total) + total) % total), [total]);
  const running = playing && !hover && inView && !reduced;

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => go(index + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [running, index, go]);

  useEffect(() => {
    const tabs = tabsRef.current;
    const tab = tabs?.querySelector<HTMLElement>(`[data-i="${index}"]`);
    if (tabs && tab) tabs.scrollTo({ left: tab.offsetLeft - tabs.clientWidth / 2 + tab.clientWidth / 2, behavior: "smooth" });
  }, [index]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === "ArrowLeft") go(index - 1);
    else return;
    e.preventDefault();
  };
  const onPointerDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, id: e.pointerId };
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = drag.current;
    drag.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
  };

  const c = CORE_CATEGORIES[index];
  const view = c.views[0];
  const inPlan = plan.has(c.key);
  const name = tk(`cat.${c.key}.name`);

  return (
    <section
      ref={rootRef}
      id={sectionId("services")}
      aria-roledescription="carousel"
      aria-labelledby="home-services-title"
      className="relative overflow-hidden py-16 sm:py-24"
      style={{ ...accentStyle(c), scrollMarginTop: "calc(var(--tk-header-h, 64px) + 60px)" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setHover(true)}
      onBlurCapture={() => setHover(false)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-10 h-[620px] w-[620px] rounded-full opacity-40 blur-3xl transition-[background] duration-700"
        style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--tk-accent) 45%, transparent), transparent)" }}
      />
      <div className="relative mx-auto max-w-7xl px-4">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <Kicker>{homeCopy.services.kicker[lang]}</Kicker>
            <h2 id="home-services-title" className="mt-4 text-balance text-3xl font-extrabold leading-[1.08] tracking-[-0.025em] text-white sm:text-[44px]">
              {homeCopy.services.title[lang]}
            </h2>
            <p className="mt-4 text-base leading-7 text-white/68">{homeCopy.services.subtitle[lang]}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? homeCopy.services.pause[lang] : homeCopy.services.play[lang]}
              className="tk-btn-ghost grid h-11 w-11 place-items-center rounded-full"
            >
              {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            </button>
            <button type="button" onClick={() => go(index - 1)} aria-label={homeCopy.services.prev[lang]} className="tk-btn-ghost grid h-11 w-11 place-items-center rounded-full">
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label={homeCopy.services.next[lang]} className="tk-btn-primary grid h-11 w-11 place-items-center rounded-full">
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
        </div>

        {/* Service tabs: a jump menu for the slides */}
        <div ref={tabsRef} role="tablist" aria-label={homeCopy.services.kicker[lang]} className="tk-no-scrollbar mt-8 flex gap-1.5 overflow-x-auto pb-1">
          {CORE_CATEGORIES.map((cat, i) => {
            const Icon = cat.icon;
            const on = i === index;
            return (
              <button
                key={cat.key}
                type="button"
                role="tab"
                data-i={i}
                aria-selected={on}
                aria-controls="home-services-stage"
                onClick={() => go(i)}
                style={accentStyle(cat)}
                className={`relative inline-flex shrink-0 items-center gap-2 overflow-hidden rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold transition-all ${
                  on ? "border-[color-mix(in_oklab,var(--tk-accent)_60%,transparent)] bg-[color-mix(in_oklab,var(--tk-accent)_16%,transparent)] text-white" : "border-white/10 text-white/60 hover:border-white/20 hover:text-white"
                }`}
              >
                <Icon size={15} className="tk-accent-text" aria-hidden />
                {tk(`cat.${cat.key}.name`)}
                {plan.has(cat.key) && <Check size={13} className="text-emerald-300" aria-hidden />}
                {on && (
                  <span
                    aria-hidden
                    key={`${index}-${running}`}
                    className={`absolute inset-x-0 bottom-0 h-[2px] origin-left bg-[var(--tk-accent)] ${running ? "tk-progress" : ""}`}
                    style={{ animationDuration: `${AUTOPLAY_MS}ms` }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div
          id="home-services-stage"
          role="group"
          aria-roledescription="slide"
          aria-label={fill(homeCopy.services.slide[lang], { n: index + 1, total })}
          tabIndex={0}
          onKeyDown={onKey}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          className="relative mt-6 touch-pan-y select-none focus-visible:outline-none"
        >
          <div aria-live={running ? "off" : "polite"} className="sr-only">
            {name}
          </div>
          <div key={c.key} className="tk-slide-in grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="order-2 lg:order-1 lg:col-span-5">
              <div className="flex flex-wrap items-center gap-3">
                <CategoryIcon category={c} />
                <div>
                  <p className="tk-accent-text text-[11px] font-semibold uppercase tracking-[0.22em]">
                    {c.index !== null ? tk("cat.common.number", { n: c.index }) : tk("cat.common.start")}
                  </p>
                  <p className="text-lg font-bold text-white">{name}</p>
                </div>
                <AvailabilityBadge availability={c.availability} className="sm:ml-auto" />
              </div>
              <h3 className="mt-6 text-balance text-[28px] font-extrabold leading-[1.1] tracking-[-0.025em] text-white sm:text-[36px]">
                {tk(`cat.${c.key}.headline`)}
              </h3>
              <p className="mt-4 text-[15px] leading-7 text-white/70">{tk(`cat.${c.key}.promise`)}</p>
              <ul className="mt-5 grid gap-2">
                {(["h1", "h2", "h3"] as const).map((h) => (
                  <li key={h} className="flex items-start gap-3 text-[15px] text-white/88">
                    <span aria-hidden className="tk-accent-soft mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full">
                      <Check size={12} className="tk-accent-text" strokeWidth={3} />
                    </span>
                    {tk(`cat.${c.key}.${h}`)}
                  </li>
                ))}
              </ul>
              <FromLine category={c} className="mt-6 block text-[15px]" />
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => plan.toggle(c.key)}
                  aria-pressed={inPlan}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all ${
                    inPlan ? "border border-emerald-400/40 bg-emerald-400/10 text-emerald-100" : "tk-btn-primary"
                  }`}
                >
                  {inPlan ? <Check size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
                  {inPlan ? homeCopy.services.added[lang] : homeCopy.services.add[lang]}
                </button>
                <Link to={c.route} className="tk-btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold">
                  {tk("cat.common.explore", { name })} <ArrowRight size={15} aria-hidden />
                </Link>
              </div>
            </div>

            <div className="order-1 lg:order-2 lg:col-span-7">
              <div className="relative">
                <div aria-hidden className="tk-accent-glow pointer-events-none absolute -inset-8 opacity-60" />
                {/* Peeking neighbours give the stage depth */}
                <div aria-hidden className="pointer-events-none absolute inset-y-8 -left-6 right-10 hidden rotate-[-3deg] rounded-[26px] border border-white/10 bg-white/[0.03] lg:block" />
                <div className="tk-glass relative rounded-[26px] p-2.5">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-[19px] bg-[#081430]">
                    {view.image ? (
                      <div className="tk-kenburns absolute inset-0">
                        <Image src={view.image.src} alt={tk(`cat.${c.key}.alt.${view.id}`)} fill sizes="(min-width: 1024px) 700px, 100vw" className="object-cover" />
                      </div>
                    ) : (
                      view.mock && <ScaledMock kind={view.mock} />
                    )}
                    <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_60%,rgb(6_13_31/0.6)),linear-gradient(120deg,color-mix(in_oklab,var(--tk-accent)_20%,transparent),transparent_45%)]" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur">
                        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                      </span>
                      <span className="rounded-full bg-black/45 px-3 py-1 text-[11px] text-white/80 backdrop-blur">{tk(`cat.${c.key}.cap.${view.id}`)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
