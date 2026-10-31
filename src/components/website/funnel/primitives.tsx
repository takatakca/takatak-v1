"use client";

// Shared building blocks for the homepage below the hero: one headline style,
// one section shell, one reveal, an animated number and the aurora canvas.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

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
export function Rise({ children, delay = 0, className = "", style }: { children: ReactNode; delay?: number; className?: string; style?: CSSProperties }) {
  const { ref, seen } = useSeen<HTMLDivElement>();
  return (
    <div ref={ref} data-seen={seen} className={`tk-rise ${className}`} style={{ ...style, transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Section headline: a bright statement and a quiet continuation. */
export function TwoTone({
  id,
  lead,
  rest,
  className = "",
  as: Tag = "h2",
  dark = true,
}: {
  id?: string;
  lead: string;
  rest?: string;
  className?: string;
  as?: "h1" | "h2" | "h3";
  dark?: boolean;
}) {
  return (
    <Tag
      id={id}
      className={`text-balance font-[family-name:var(--font-website-display)] text-[34px] font-bold leading-[1.04] tracking-[-0.035em] sm:text-[52px] lg:text-[60px] ${
        dark ? "text-white" : "text-[#060D1F]"
      } ${className}`}
    >
      {lead}
      {rest && <span className={dark ? "text-white/40" : "text-[#060D1F]/40"}> {rest}</span>}
    </Tag>
  );
}

/** Small label above a headline. */
export function Eyebrow({ children, dark = true }: { children: ReactNode; dark?: boolean }) {
  return (
    <p className={`mb-5 flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.22em] ${dark ? "text-[#7CC4FF]" : "text-[#1565D8]"}`}>
      <span aria-hidden className={`h-px w-8 ${dark ? "bg-[#7CC4FF]/60" : "bg-[#1565D8]/60"}`} />
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
