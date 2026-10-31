"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Pause, Play, Plus, X } from "lucide-react";

import { FromLine, useCopy } from "@/components/website/premium/ui";
import { CORE_CATEGORIES, type CoreCategory } from "@/lib/website/core-categories";
import { homeCopy, homeV2, homeV3 } from "@/lib/website/home-funnel";
import { SERVICE_MEDIA } from "@/lib/website/home-media";
import { useHomePlan } from "@/lib/website/home-plan";
import { Link } from "@/lib/website/nav";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";
import { MediaLoop } from "./MediaLoop";
import { Rise, TwoTone } from "./primitives";

const AUTOPLAY_MS = 5200;

const AVAIL: Record<CoreCategory["availability"], { en: string; fr: string }> = {
  live: { en: "Available now", fr: "Disponible" },
  early: { en: "Early access", fr: "Accès anticipé" },
  onRequest: { en: "On request", fr: "Sur demande" },
  planned: { en: "Planned", fr: "Prévu" },
};

/** The one line of product UI over a picture: a frosted chip, no icon. */
export function MediaChip({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[12.5px] font-semibold text-[#0B0D12] shadow-[0_8px_24px_-10px_rgb(0_0_0/0.5)] backdrop-blur ${className}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {text}
    </span>
  );
}

/** Pop-up with the full story of one service. */
function ServiceModal({ category, onClose }: { category: CoreCategory; onClose: () => void }) {
  const { tk, lang } = useCopy();
  const plan = useHomePlan();
  const closeRef = useRef<HTMLButtonElement>(null);
  const inPlan = plan.has(category.key);
  const name = tk(`cat.${category.key}.name`);
  const media = SERVICE_MEDIA[category.key];

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

  // Portal to <body> so the pop-up sits above the site header.
  return createPortal(
    <div
      className="hp hp-portal fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-6"
      data-theme={document.querySelector(".hp")?.getAttribute("data-theme") ?? "light"}
      role="dialog"
      aria-modal="true"
      aria-labelledby="svc-modal-title"
    >
      <div className="tk-fade-in absolute inset-0 bg-[#05070C]/65 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="tk-modal-in hp-bg relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-[28px] shadow-[0_40px_120px_-30px_rgb(0_0_0/0.6)] sm:rounded-[28px]">
        <button ref={closeRef} type="button" onClick={onClose} aria-label={homeV2.services.close[lang]} className="hp-btn hp-focus absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full">
          <X size={18} aria-hidden />
        </button>
        <div className="grid lg:grid-cols-2">
          <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[580px]">
            <MediaLoop photo={media.photo} alt={media.alt[lang]} videoKey={media.video} focus={media.focus} zoom={media.zoom} sizes="(min-width: 1024px) 512px, 100vw" className="absolute inset-0" />
            <MediaChip text={media.chip[lang]} className="absolute bottom-5 left-5" />
          </div>
          <div className="flex flex-col p-6 sm:p-10">
            <p className="hp-ink-2 text-[13px] font-medium">
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
            {category.chips && <p className="hp-ink-3 mt-6 text-[13px] leading-6">{category.chips.map((c) => c.label).join(" · ")}</p>}
            <div className="mt-auto pt-8">
              <FromLine category={category} className="block text-[17px] [&_span]:!text-[var(--hp-ink)]" />
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => plan.toggle(category.key)}
                  aria-pressed={inPlan}
                  className={`hp-focus inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14.5px] font-semibold ${inPlan ? "hp-ghost" : "hp-cta hp-halo"}`}
                >
                  {inPlan ? <Check size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
                  {inPlan ? homeCopy.services.added[lang] : homeCopy.services.add[lang]}
                </button>
                <Link to={category.route} className="hp-ghost hp-focus inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14.5px] font-semibold">
                  {tk("cat.common.explore", { name })} <ArrowRight size={15} aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.querySelector(".website-surface") ?? document.body,
  );
}

/**
 * The ten services as a gallery of tall picture cards. Auto-advances while in
 * view (pauses on hover, focus, drag, hidden tab and reduced motion), drags
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

  const go = useCallback(
    (i: number) => {
      const track = trackRef.current;
      const next = ((i % total) + total) % total;
      const card = track?.children[next] as HTMLElement | undefined;
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
        aria-label={homeV3.gallery.lead[lang]}
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
          const media = SERVICE_MEDIA[c.key];
          return (
            <article
              key={c.key}
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${total} · ${name}`}
              className={`group relative h-[580px] w-[82vw] max-w-[420px] shrink-0 overflow-hidden rounded-[28px] bg-black shadow-[var(--hp-shadow)] transition-[transform,opacity] duration-700 ease-[cubic-bezier(.2,.8,.2,1)] sm:w-[420px] ${
                on ? "scale-100 opacity-100" : "scale-[0.95] opacity-75 hover:opacity-100"
              }`}
            >
              <MediaLoop
                photo={media.photo}
                alt={media.alt[lang]}
                videoKey={on ? media.video : undefined}
                focus={media.focus}
                zoom={media.zoom}
                sizes="420px"
                className="absolute inset-0 transition-transform duration-[1.4s] ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-[1.04]"
              />
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0/0.45)_0%,transparent_28%,transparent_45%,rgb(0_0_0/0.85)_100%)]" />

              <button
                type="button"
                onClick={() => {
                  if (!drag.current?.moved) setOpen(c);
                }}
                className="absolute inset-0 z-[2] flex flex-col p-7 pb-[92px] text-left text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                aria-label={`${homeV2.services.open[lang]}: ${name}`}
              >
                <span className="text-[13px] font-semibold text-white/85">
                  {name} · <span className="font-normal text-white/70">{AVAIL[c.availability][lang]}</span>
                </span>
                <span className="mt-auto">
                  <MediaChip text={media.chip[lang]} className="mb-5" />
                  <span className="hp-display block text-balance text-[28px] text-white">{tk(`cat.${c.key}.headline`)}</span>
                </span>
              </button>

              <div className="absolute inset-x-0 bottom-0 z-[3] flex h-[84px] items-center justify-between gap-3 px-7 text-white">
                <FromLine category={c} className="text-[14px] [&_span]:!text-white" />
                <button
                  type="button"
                  onClick={() => plan.toggle(c.key)}
                  aria-pressed={inPlan}
                  aria-label={`${inPlan ? homeCopy.services.added[lang] : homeCopy.services.add[lang]}: ${name}`}
                  className={`inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold transition-all ${
                    inPlan ? "bg-emerald-500 text-white" : "bg-white text-[#0B0D12] hover:scale-[1.04]"
                  }`}
                >
                  {inPlan ? <Check size={16} strokeWidth={3} aria-hidden /> : <Plus size={16} strokeWidth={2.5} aria-hidden />}
                  {inPlan ? homeV3.added[lang] : homeV3.addAll[lang]}
                </button>
              </div>
            </article>
          );
        })}
      </div>

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
