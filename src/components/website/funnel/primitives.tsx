"use client";

// Shared building blocks for the homepage below the hero: one headline style,
// one section shell, one reveal, an animated number and the aurora canvas.

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

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
    <Tag ref={ref} data-seen={seen} className={`tk-rise ${className}`} style={{ ...style, transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

/** Section headline: a strong statement and a quieter continuation (theme aware). */
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
  const sizes = size === "lg" ? "text-[36px] sm:text-[54px] lg:text-[64px]" : "text-[30px] sm:text-[40px] lg:text-[46px]";
  return (
    <Tag id={id} className={`hp-display hp-ink text-balance ${sizes} ${className}`}>
      {lead}
      {rest && <span className="hp-serif hp-ink-2"> {rest}</span>}
    </Tag>
  );
}

/** Small label above a headline. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="hp-ink-2 mb-4 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em]">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--hp-cta)]" />
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
    <section id={id} aria-labelledby={labelledBy} className={`relative ${className}`} style={{ scrollMarginTop: "calc(var(--tk-header-h, 64px) + 52px)" }}>
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
