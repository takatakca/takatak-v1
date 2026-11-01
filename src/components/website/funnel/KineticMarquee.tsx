"use client";

import { useEffect, useRef } from "react";

import { useCopy } from "@/components/website/premium/ui";
import { CORE_CATEGORIES } from "@/lib/website/core-categories";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";

/**
 * Two rows of oversized service names sliding in opposite directions, filled
 * and outlined in turn. The rows lean with how fast the page scrolls, then
 * settle. Decorative: hidden from screen readers, still with reduced motion.
 */
export function KineticMarquee() {
  const { tk } = useCopy();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const names = CORE_CATEGORIES.map((c) => tk(`cat.${c.key}.name`));

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    let last = window.scrollY;
    let skew = 0;
    let frame = 0;
    const tick = () => {
      const y = window.scrollY;
      const v = y - last;
      last = y;
      skew += (Math.max(-12, Math.min(12, v * 0.35)) - skew) * 0.12;
      el.style.setProperty("--skew", `${skew.toFixed(2)}deg`);
      frame = requestAnimationFrame(tick);
    };
    let running = false;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) {
        running = true;
        last = window.scrollY;
        frame = requestAnimationFrame(tick);
      } else if (!e.isIntersecting && running) {
        running = false;
        cancelAnimationFrame(frame);
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [reduced]);

  const row = (offset: number) =>
    [...names, ...names].map((n, i) => (
      <span key={`${n}-${i}`} className={`hp-marquee-item ${(i + offset) % 2 ? "hp-outline" : "hp-ink"}`}>
        {n}
        <span aria-hidden className="inline-block h-[0.22em] w-[0.22em] rounded-full bg-[var(--hp-cta)]" />
      </span>
    ));

  return (
    <div ref={ref} aria-hidden className="hp-bg hp-marquee hp-display py-10 text-[56px] leading-[1.05] sm:py-16 sm:text-[96px] lg:text-[128px]">
      <div className="hp-marquee-track">{row(0)}</div>
      <div className="hp-marquee-track mt-2" data-reverse="true">
        {row(1)}
      </div>
    </div>
  );
}
