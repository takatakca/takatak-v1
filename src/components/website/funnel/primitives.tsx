"use client";

// Shared building blocks for the homepage below the hero: one headline style,
// one section shell, one reveal, an animated number and the aurora canvas.

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { useReducedMotion } from "@/lib/website/use-reduced-motion";

/** True once the element has entered the viewport (stays true). */
export function useSeen<T extends Element>(rootMargin = "0px 0px -12% 0px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return { ref, seen };
}

/** Rises and unmasks once in view. */
export function Rise({
  children,
  delay = 0,
  className = "",
  style,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "li";
}) {
  const { ref, seen } = useSeen<HTMLDivElement & HTMLLIElement>();
  const Tag = as;
  return (
    <Tag
      ref={ref}
      data-seen={seen}
      className={`tk-rise ${className}`}
      style={{ ...style, transitionDelay: `${delay}ms`, "--bd": `${380 + delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

/** Types `text` one character at a time once `active` (instant with reduced motion). */
function useTyped(text: string, active: boolean, speed = 26) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setN(text.length);
      return;
    }
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) window.clearInterval(t);
    }, speed);
    return () => window.clearInterval(t);
  }, [active, text, reduced, speed]);
  return n;
}

/**
 * Section headline. The statement types itself with a blue caret, as if the
 * page were being coded live; then the quieter continuation rises word by word.
 * Screen readers get the whole sentence at once.
 */
export function TwoTone({
  id,
  lead,
  rest,
  className = "",
  as: Tag = "h2",
  size = "lg",
}: {
  id?: string;
  lead: string;
  rest?: string;
  className?: string;
  as?: "h1" | "h2" | "h3";
  size?: "lg" | "md";
}) {
  const sizes = size === "lg" ? "text-[38px] sm:text-[58px] lg:text-[68px]" : "text-[32px] sm:text-[42px] lg:text-[50px]";
  const { ref, seen } = useSeen<HTMLHeadingElement>("0px 0px -8% 0px");
  const n = useTyped(lead, seen);
  const typed = n >= lead.length;
  return (
    <Tag
      ref={ref}
      id={id}
      data-seen={seen}
      data-typed={typed}
      aria-label={rest ? `${lead} ${rest}` : lead}
      className={`hp-display hp-ink hp-kin text-balance ${sizes} ${className}`}
    >
      <span aria-hidden>
        <span>{lead.slice(0, n)}</span>
        <span className={`hp-caret ${typed ? "hp-caret-done" : ""}`} />
        <span className="opacity-0">{lead.slice(n)}</span>
        {rest && (
          <span className="hp-serif hp-ink-2">
            {" "}
            <KineticWords words={rest.split(" ")} start={0} />
          </span>
        )}
      </span>
    </Tag>
  );
}

/** Words that rise out of a mask one after the other when the heading is seen. */
function KineticWords({ words, start }: { words: string[]; start: number }) {
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={`${w}-${i}`}>
          <span className="hp-w">
            <span style={{ "--i": start + i } as CSSProperties}>{w}</span>
          </span>
          {/* The space sits between the masks: inside an inline-block it would collapse. */}
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}

/**
 * A picture that opens like a curtain (clip-path) and settles from a slight
 * zoom when it enters the screen. Children fill it (next/image with fill).
 */
export function RevealMedia({
  children,
  className = "",
  delay = 0,
  radius = 32,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  radius?: number;
}) {
  const { ref, seen } = useSeen<HTMLDivElement>("0px 0px -10% 0px");
  return (
    <div ref={ref} data-seen={seen} className={`hp-curtain ${className}`} style={{ "--d": `${delay}ms`, "--r": `${radius}px` } as CSSProperties}>
      <div className="hp-curtain-in absolute inset-0">{children}</div>
    </div>
  );
}

/**
 * Pulls its child a few pixels towards the pointer (mouse only, never with
 * reduced motion), then springs back: the call to action feels alive.
 */
export function Magnetic({ children, strength = 0.28, className = "" }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const move = (e: ReactPointerEvent<HTMLSpanElement>) => {
    const el = ref.current;
    if (!el || reduced || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) * strength;
    const y = (e.clientY - (r.top + r.height / 2)) * strength * 1.3;
    el.style.transform = `translate3d(${Math.max(-10, Math.min(10, x)).toFixed(1)}px, ${Math.max(-8, Math.min(8, y)).toFixed(1)}px, 0)`;
  };
  const leave = () => {
    if (ref.current) ref.current.style.transform = "";
  };
  return (
    <span ref={ref} onPointerMove={move} onPointerLeave={leave} className={`hp-magnetic inline-flex ${className}`}>
      {children}
    </span>
  );
}

/**
 * A soft light that follows the pointer over a section (sets --mx / --my for
 * the .hp-spot CSS). Mouse only; nothing with reduced motion.
 */
export function useSpotlight<T extends HTMLElement>() {
  const reduced = useReducedMotion();
  return {
    onPointerMove: (e: ReactPointerEvent<T>) => {
      if (reduced || e.pointerType !== "mouse") return;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    },
  };
}

/** 0 → 1 as the page scrolls past an element (for progress lines). */
export function useScrollProgress(targetId: string) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const el = document.getElementById(targetId);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      setP(total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0);
    };
    const on = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(frame);
    };
  }, [targetId]);
  return p;
}

/** Small label above a headline, styled like a line of code: // SECTION. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="hp-code-eyebrow mb-4 flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[0.16em] hp-ink-2">
      <span aria-hidden className="text-[var(--hp-cta)]">{"//"}</span>
      {children}
    </p>
  );
}

/** Counts to a value when first seen. */
export function Ticker({ value, format, className = "" }: { value: number; format: (n: number) => string; className?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 650);
      const eased = 1 - Math.pow(1 - p, 4);
      setShown(a + (value - a) * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return <span className={`tabular-nums ${className}`}>{format(shown)}</span>;
}

/**
 * Slow-moving light on navy, drawn on a small canvas and scaled up (cheap on
 * the GPU). Pauses off screen and with reduced motion.
 */
const AURORA_DEFAULT: readonly string[] = ["#1F8BFF", "#29C3FF", "#3B4CFF"];

export function Aurora({ className = "", colors = AURORA_DEFAULT }: { className?: string; colors?: readonly string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const W = 160;
    const H = 100;
    canvas.width = W;
    canvas.height = H;
    let frame = 0;
    let visible = true;
    const blobs = colors.map((c, i) => ({ c, a: i * 2.1, s: 0.0016 + i * 0.0004, r: 46 + i * 10 }));
    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      for (const b of blobs) {
        const x = W / 2 + Math.cos(t * b.s + b.a) * W * 0.32;
        const y = H / 2 + Math.sin(t * b.s * 1.3 + b.a) * H * 0.3;
        const g = ctx.createRadialGradient(x, y, 0, x, y, b.r);
        g.addColorStop(0, `${b.c}88`);
        g.addColorStop(1, `${b.c}00`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
    };
    const loop = (t: number) => {
      if (visible) draw(t);
      frame = requestAnimationFrame(loop);
    };
    draw(2000);
    if (!reduced) frame = requestAnimationFrame(loop);
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => (visible = e.isIntersecting)) : null;
    io?.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      io?.disconnect();
    };
  }, [colors, reduced]);
  return <canvas ref={ref} aria-hidden className={`pointer-events-none h-full w-full blur-2xl ${className}`} />;
}

/** Shared section wrapper with the scroll offset for the sticky menus. */
export function Section({
  id,
  labelledBy,
  className = "",
  children,
}: {
  id: string;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`hp-live relative ${className}`} style={{ scrollMarginTop: "calc(var(--tk-header-h, 64px) + 52px)" }}>
      {children}
    </section>
  );
}

/**
 * A gentle 3D tilt that follows the pointer (mouse only; never with reduced
 * motion). Spread the returned props on the element to tilt.
 */
export function useTilt<T extends HTMLElement>(max = 5) {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();
  const onPointerMove = (e: ReactPointerEvent<T>) => {
    const el = ref.current;
    if (!el || reduced || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1000px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
  };
  const onPointerLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };
  return { ref, onPointerMove, onPointerLeave, className: "hp-tilt" };
}

export type Origin = { left: number; top: number; width: number; height: number } | null;

/** The rect of the clicked element, to zoom a pop-up out of it. */
export function originOf(el: Element | null): Origin {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/**
 * Pop-ups that grow out of the picture that was clicked, and shrink back into
 * it on close (FLIP with the Web Animations API). Without an origin, or with
 * reduced motion, they simply appear and close at once.
 */
export function useZoomFrom<T extends HTMLElement>(origin: Origin) {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();
  const closing = useRef(false);

  const frames = (el: T) => {
    if (!origin) return null;
    const to = el.getBoundingClientRect();
    if (!to.width || !to.height) return null;
    const s = Math.max(0.08, Math.min(origin.width / to.width, origin.height / to.height));
    const dx = origin.left + origin.width / 2 - (to.left + to.width / 2);
    const dy = origin.top + origin.height / 2 - (to.top + to.height / 2);
    return [
      { transform: `perspective(1400px) translate3d(${dx}px, ${dy}px, -120px) scale(${s}) rotateX(14deg)`, opacity: 0.35, filter: "blur(2px)" },
      { transform: `perspective(1400px) translate3d(0, -8px, 40px) scale(1.02) rotateX(-2deg)`, opacity: 1, filter: "blur(0)", offset: 0.75 },
      { transform: "none", opacity: 1, filter: "blur(0)" },
    ];
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !origin || reduced || typeof el.animate !== "function") return;
    const k = frames(el);
    if (k) el.animate(k, { duration: 640, easing: "cubic-bezier(0.2, 0.85, 0.2, 1)" });
    // Measured once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = (done: () => void) => {
    const el = ref.current;
    if (closing.current) return;
    if (!el || !origin || reduced || typeof el.animate !== "function") return done();
    const k = frames(el);
    if (!k) return done();
    closing.current = true;
    const anim = el.animate([...k].reverse(), { duration: 360, easing: "cubic-bezier(0.55, 0, 0.7, 0.2)", fill: "forwards" });
    anim.onfinish = () => done();
  };

  return [ref, close, Boolean(origin) && !reduced] as const;
}

/**
 * One pointer listener for the whole page: cards with .hp-glow get a light
 * that follows the mouse along their border (sets --gx / --gy on the card).
 */
export function GlowPointer() {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      frame = 0;
      const e = last;
      if (!e) return;
      const card = (e.target as Element | null)?.closest?.(".hp-glow") as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--gx", `${e.clientX - r.left}px`);
      card.style.setProperty("--gy", `${e.clientY - r.top}px`);
    };
    const on = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      last = e;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    document.addEventListener("pointermove", on, { passive: true });
    return () => {
      document.removeEventListener("pointermove", on);
      cancelAnimationFrame(frame);
    };
  }, [reduced]);
  return null;
}

/**
 * A hand-drawn arrow that draws itself towards a button with a short label
 * ("Click here"), then bobs. Place it inside a relative wrapper around the button.
 */
export function PointHere({
  label,
  className = "-left-2 -top-14",
  flip = false,
  color = "var(--hp-cta)",
}: {
  label: string;
  className?: string;
  /** Points down-left instead of down-right (label on the right of the button). */
  flip?: boolean;
  color?: string;
}) {
  const { ref, seen } = useSeen<HTMLSpanElement>("0px 0px -15% 0px");
  return (
    <span ref={ref} data-seen={seen} aria-hidden className={`hp-point ${flip ? "flex-row-reverse" : ""} ${className}`}>
      <span className="hp-point-label hp-serif whitespace-nowrap text-[22px] leading-none" style={{ color }}>
        {label}
      </span>
      <svg width="64" height="54" viewBox="0 0 64 54" fill="none" className={`mt-2 ${flip ? "-scale-x-100" : ""}`}>
        <path d="M4 6 C 26 6, 46 14, 52 40" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <path d="M42 34 L 52 44 L 60 31" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
