"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Pause, Play, Plus, X } from "lucide-react";

import { ScaledMock } from "@/components/website/premium/ScaledMock";
import { FromLine, accentStyle, useCopy } from "@/components/website/premium/ui";
import { CORE_CATEGORIES, type CoreCategory } from "@/lib/website/core-categories";
import { homeCopy, homeV2, homeV3 } from "@/lib/website/home-funnel";
import { useHomePlan } from "@/lib/website/home-plan";
import { Link } from "@/lib/website/nav";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";
import { Rise, TwoTone } from "./primitives";

const AUTOPLAY_MS = 5200;

const AVAIL: Record<CoreCategory["availability"], { en: string; fr: string; dot: string }> = {
  live: { en: "Available now", fr: "Disponible", dot: "bg-emerald-400" },
  early: { en: "Early access", fr: "Accès anticipé", dot: "bg-sky-300" },
  onRequest: { en: "On request", fr: "Sur demande", dot: "bg-slate-400" },
  planned: { en: "Planned", fr: "Prévu", dot: "bg-amber-300" },
};

/** A coded website preview for the "website" card (the other services have product mock-ups). */
function SiteMock() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[14px] bg-[#F7F4EE] text-[#1B1A17]">
      <div className="flex items-center gap-1.5 border-b border-black/5 bg-white/70 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-black/15" />
        <span className="h-2 w-2 rounded-full bg-black/10" />
        <span className="h-2 w-2 rounded-full bg-black/10" />
        <span className="mx-auto rounded-full bg-black/[0.05] px-3 py-0.5 text-[10px] text-black/50">maisonlumiere.ca</span>
      </div>
      <div className="flex items-center justify-between px-5 py-3 text-[10px] font-medium uppercase tracking-[0.18em] text-black/60">
        <span className="font-serif text-[14px] normal-case tracking-normal text-black">Maison Lumière</span>
        <span className="flex gap-4">
          <span>Menu</span>
          <span>Réserver</span>
          <span>Contact</span>
        </span>
      </div>
      <div className="relative mx-4 flex-1 overflow-hidden rounded-xl bg-[radial-gradient(120%_90%_at_80%_20%,#E9C48A,#B5703C_45%,#3A2316)] p-5 text-white">
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/75">Montréal · Plateau</p>
        <p className="mt-2 max-w-[70%] font-serif text-[26px] leading-[1.05]">Une table, une lumière, un soir.</p>
        <span className="mt-4 inline-block rounded-full bg-white px-4 py-1.5 text-[11px] font-semibold text-[#3A2316]">Réserver une table</span>
        <span aria-hidden className="absolute -bottom-8 -right-6 h-32 w-32 rounded-full bg-white/15 blur-xl" />
      </div>
      <div className="grid grid-cols-3 gap-2 p-4">
        {["#D9B38C", "#9C5B3B", "#5E6B4B"].map((c) => (
          <span key={c} className="h-12 rounded-lg" style={{ background: `linear-gradient(135deg, ${c}, ${c}AA)` }} />
        ))}
      </div>
    </div>
  );
}

function CardVisual({ category }: { category: CoreCategory }) {
  const mock = category.views.find((v) => v.mock)?.mock;
  return (
    <div className="relative h-full w-full">
      {mock ? <ScaledMock kind={mock} /> : <div className="absolute inset-0 p-3"><SiteMock /></div>}
    </div>
  );
}

/** Pop-up with the full story of one service. */
function ServiceModal({ category, onClose }: { category: CoreCategory; onClose: () => void }) {
  const { tk, lang } = useCopy();
  const plan = useHomePlan();
  const closeRef = useRef<HTMLButtonElement>(null);
  const inPlan = plan.has(category.key);
  const name = tk(`cat.${category.key}.name`);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="svc-modal-title">
      <div className="tk-fade-in absolute inset-0 bg-[#05070C]/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        style={accentStyle(category)}
        className="tk-modal-in hp-bg relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-[28px] shadow-[0_40px_120px_-30px_rgb(0_0_0/0.6)] sm:rounded-[28px]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={homeV2.services.close[lang]}
          className="hp-btn hp-focus absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full"
        >
          <X size={18} aria-hidden />
        </button>
        <div className="grid lg:grid-cols-2">
          <div
            className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[560px]"
            style={{ background: "linear-gradient(160deg, color-mix(in oklab, var(--tk-accent) 22%, var(--hp-alt)), var(--hp-alt) 60%)" }}
          >
            <div className="absolute inset-6 sm:inset-10">
              <CardVisual category={category} />
            </div>
          </div>
          <div className="flex flex-col p-6 sm:p-10">
            <p className="hp-ink-2 flex items-center gap-2 text-[13px] font-medium">
              <span className={`h-1.5 w-1.5 rounded-full ${AVAIL[category.availability].dot}`} aria-hidden />
              {name} · {AVAIL[category.availability][lang]}
            </p>
            <h3 id="svc-modal-title" className="hp-display hp-ink mt-4 text-balance text-[30px] sm:text-[40px]">
              {tk(`cat.${category.key}.headline`)}
            </h3>
            <p className="hp-ink-2 mt-4 text-[16px] leading-7">{tk(`cat.${category.key}.promise`)}</p>
            <ul className="hp-line mt-6 grid gap-3 border-t pt-6">
              {(["h1", "h2", "h3"] as const).map((h) => (
                <li key={h} className="hp-ink flex gap-3 text-[15px]">
                  <Check size={17} className="hp-accent mt-0.5 shrink-0" strokeWidth={2.5} aria-hidden />
                  {tk(`cat.${category.key}.${h}`)}
                </li>
              ))}
            </ul>
            {category.chips && (
              <p className="hp-ink-3 mt-6 text-[13px] leading-6">{category.chips.map((c) => c.label).join(" · ")}</p>
            )}
            <div className="mt-auto pt-8">
              <FromLine category={category} className="hp-ink block text-[17px] [&_span]:!text-[var(--hp-ink)] [&_.font-bold]:!text-[var(--hp-ink)]" />
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => plan.toggle(category.key)}
                  aria-pressed={inPlan}
                  className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14.5px] font-semibold transition-all ${
                    inPlan ? "hp-ghost" : "hp-cta"
                  }`}
                >
                  {inPlan ? <Check size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
                  {inPlan ? homeCopy.services.added[lang] : homeCopy.services.add[lang]}
                </button>
                <Link to={category.route} className="hp-ghost inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14.5px] font-semibold">
                  {tk("cat.common.explore", { name })} <ArrowRight size={15} aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The ten services as a horizontal gallery of tall cards. Auto-advances while
 * in view (pauses on hover, focus, drag, hidden tab and reduced motion), drags
 * with the mouse, swipes on touch, and opens a detail pop-up on click.
 */
export function ServiceGallery() {
  const { tk, lang } = useCopy();
  const plan = useHomePlan();
  const reduced = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hold, setHold] = useState(false);
  const [inView, setInView] = useState(false);
  const [open, setOpen] = useState<CoreCategory | null>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const total = CORE_CATEGORIES.length;

  const cardAt = (i: number) => trackRef.current?.children[i] as HTMLElement | undefined;

  const go = useCallback(
    (i: number) => {
      const track = trackRef.current;
      const next = ((i % total) + total) % total;
      const card = cardAt(next);
      if (!track || !card) return;
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      track.scrollTo({ left: card.offsetLeft - pad, behavior: reduced ? "auto" : "smooth" });
    },
    [total, reduced],
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      let best = 0;
      let dist = Infinity;
      Array.from(track.children).forEach((c, i) => {
        const d = Math.abs((c as HTMLElement).offsetLeft - pad - track.scrollLeft);
        if (d < dist) {
          dist = d;
          best = i;
        }
      });
      setActive(best);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.4 }) : null;
    io?.observe(track);
    return () => {
      track.removeEventListener("scroll", onScroll);
      io?.disconnect();
    };
  }, []);

  const running = playing && !hold && inView && !reduced && !open;
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => go(active + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [running, active, go]);

  // Mouse drag (touch uses native scrolling).
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !trackRef.current) return;
    drag.current = { x: e.clientX, left: trackRef.current.scrollLeft, moved: false };
    trackRef.current.style.scrollSnapType = "none";
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !trackRef.current) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 4) d.moved = true;
    trackRef.current.scrollLeft = d.left - dx;
  };
  const endDrag = () => {
    const d = drag.current;
    if (!d || !trackRef.current) return;
    trackRef.current.style.scrollSnapType = "";
    setTimeout(() => {
      if (drag.current === d) drag.current = null;
    }, 0);
    go(active);
  };

  return (
    <section aria-labelledby="home-services-title" className="hp-alt overflow-hidden py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <Rise className="max-w-3xl">
            <TwoTone id="home-services-title" size="md" lead={homeV3.gallery.lead[lang]} rest={homeV3.gallery.rest[lang]} />
          </Rise>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? homeCopy.services.pause[lang] : homeCopy.services.play[lang]}
              className="hp-ghost hp-focus grid h-12 w-12 place-items-center rounded-full"
            >
              {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            </button>
            <button type="button" onClick={() => go(active - 1)} aria-label={homeCopy.services.prev[lang]} className="hp-ghost hp-focus grid h-12 w-12 place-items-center rounded-full">
              <ChevronLeft size={20} aria-hidden />
            </button>
            <button type="button" onClick={() => go(active + 1)} aria-label={homeCopy.services.next[lang]} className="hp-btn hp-focus grid h-12 w-12 place-items-center rounded-full">
              <ChevronRight size={20} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={homeV2.services.lead[lang]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={() => {
          if (drag.current) endDrag();
          setHold(false);
        }}
        onMouseEnter={() => setHold(true)}
        onFocusCapture={() => setHold(true)}
        onBlurCapture={() => setHold(false)}
        className="tk-gallery mt-12 flex gap-5 overflow-x-auto px-[max(16px,calc((100vw-1280px)/2+16px))] pb-6"
      >
        {CORE_CATEGORIES.map((c, i) => {
          const on = i === active;
          const inPlan = plan.has(c.key);
          const name = tk(`cat.${c.key}.name`);
          return (
            <article
              key={c.key}
              style={accentStyle(c)}
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${total} · ${name}`}
              className={`group hp-raised relative flex h-[560px] w-[82vw] max-w-[400px] shrink-0 flex-col overflow-hidden rounded-[28px] transition-[transform,opacity] duration-700 ease-[cubic-bezier(.2,.8,.2,1)] sm:w-[400px] ${
                on ? "scale-100 opacity-100" : "scale-[0.95] opacity-70 hover:opacity-100"
              }`}
            >
              <div
                aria-hidden
                className="absolute inset-0 rounded-[30px]"
                style={{ background: "linear-gradient(180deg, color-mix(in oklab, var(--tk-accent) 12%, var(--hp-raised)), var(--hp-raised) 46%)" }}
              />
              <button
                type="button"
                onClick={() => {
                  if (!drag.current?.moved) setOpen(c);
                }}
                className="relative z-[2] flex flex-1 flex-col p-7 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--hp-accent)]"
                aria-label={`${homeV2.services.open[lang]}: ${name}`}
              >
                <span className="hp-ink-2 flex items-center gap-2 text-[13px] font-medium">
                  <span className={`h-1.5 w-1.5 rounded-full ${AVAIL[c.availability].dot}`} aria-hidden />
                  {name}
                </span>
                <span className="hp-display hp-ink mt-3 block text-balance text-[27px]">
                  {tk(`cat.${c.key}.headline`)}
                </span>
                <span className="relative mt-6 block flex-1 overflow-hidden rounded-[18px] shadow-[0_20px_40px_-24px_rgb(6_13_31/0.6)] transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-translate-y-1 group-hover:scale-[1.03]">
                  <CardVisual category={c} />
                </span>
              </button>
              <div className="relative z-[2] flex items-center justify-between gap-3 px-7 pb-6">
                <FromLine category={c} className="hp-ink-2 text-[14px] [&_.font-bold]:!text-[var(--hp-ink)] [&_span]:!text-[var(--hp-ink-2)]" />
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => plan.toggle(c.key)}
                    aria-pressed={inPlan}
                    aria-label={`${inPlan ? homeCopy.services.added[lang] : homeCopy.services.add[lang]}: ${name}`}
                    className={`grid h-11 w-11 place-items-center rounded-full transition-all ${
                      inPlan ? "bg-emerald-500 text-white" : "hp-cta hover:rotate-90"
                    }`}
                  >
                    {inPlan ? <Check size={18} strokeWidth={3} aria-hidden /> : <Plus size={18} strokeWidth={2.5} aria-hidden />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(c)}
                    aria-label={`${homeV2.services.open[lang]}: ${name}`}
                    className="hp-ghost grid h-11 w-11 place-items-center rounded-full"
                  >
                    <ArrowUpRight size={18} aria-hidden />
                  </button>
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {/* Progress */}
      <div className="mx-auto mt-4 flex max-w-7xl items-center gap-4 px-4">
        <div className="flex flex-1 gap-1.5">
          {CORE_CATEGORIES.map((c, i) => (
            <button
              key={c.key}
              type="button"
              onClick={() => go(i)}
              aria-label={tk(`cat.${c.key}.name`)}
              aria-current={i === active ? "true" : undefined}
              className="relative h-1 flex-1 overflow-hidden rounded-full bg-[var(--hp-line)]"
            >
              {i < active && <span className="absolute inset-0 bg-[var(--hp-ink-3)]" />}
              {i === active && (
                <span
                  key={`${active}-${running}`}
                  className={`absolute inset-0 origin-left bg-[var(--hp-ink)] ${running ? "tk-progress" : ""}`}
                  style={{ animationDuration: `${AUTOPLAY_MS}ms` }}
                />
              )}
            </button>
          ))}
        </div>
        <span className="hp-ink-3 hidden text-[12px] sm:inline">{homeV2.services.drag[lang]}</span>
      </div>

      {open && <ServiceModal category={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
