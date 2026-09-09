"use client";

import type { ComponentType, ReactNode } from "react";
import { Link } from "@/lib/website/nav";
import { AnimatedStatus } from "@/components/website/motion/AnimatedStatus";
import { useLanguage } from "@/lib/website/use-language";
import type { HeroStep } from "./heroStory";

type Depth = "back" | "mid" | "front";

const DEPTH_CLASS: Record<Depth, string> = {
  back: "opacity-[0.88] shadow-[0_18px_46px_-28px_rgba(0,0,0,0.9)]",
  mid: "shadow-[0_34px_80px_-38px_rgba(0,0,0,0.95)]",
  front: "shadow-[0_44px_96px_-40px_rgba(0,0,0,1)]",
};

const DEPTH_SHIFT: Record<Depth, number> = { back: 4, mid: 9, front: 16 };

/**
 * Shared shell for every object in the flagship hero scene. It provides the
 * link semantics, the reached / current / selected states, the depth plane
 * treatment and the single shared pointer parallax (driven by CSS variables
 * set once on the scene root — no per-panel listeners).
 */
export function HeroObject({
  step,
  reached,
  current,
  selected,
  onEnter,
  onLeave,
  depth = "mid",
  className = "",
  showStatus = true,
  children,
}: {
  step: HeroStep;
  reached: boolean;
  current: boolean;
  selected: boolean;
  onEnter: () => void;
  onLeave: () => void;
  depth?: Depth;
  className?: string;
  showStatus?: boolean;
  children: ReactNode;
}) {
  const { tx } = useLanguage();
  const shift = DEPTH_SHIFT[depth];

  return (
    <Link
      to={step.to as never}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      aria-label={`${tx(step.label)} — ${tx(step.explain)}`}
      data-state={selected ? "selected" : reached ? "reached" : "idle"}
      style={{
        transform: `translate3d(calc(var(--tk-px, 0) * ${shift}px), calc(var(--tk-py, 0) * ${shift * 0.6}px), 0)`,
      }}
      className={`tk-hero-object group block rounded-2xl border backdrop-blur-md transition-[border-color,background-color,box-shadow] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        reached || selected
          ? "border-primary/40 bg-white/[0.14]"
          : "border-white/10 bg-white/10"
      } ${DEPTH_CLASS[depth]} ${className}`}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--primary)_55%,transparent),transparent)] opacity-70" />
      {children}
      {showStatus && (
        <span className="mt-2 flex items-center justify-between gap-2 px-3 pb-3">
          <AnimatedStatus status={reached ? step.activeStatus : step.idleStatus} pulse={current} />
          {selected && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              {tx({ en: "Open", fr: "Ouvrir" })}
            </span>
          )}
        </span>
      )}
      {selected && (
        <span className="block px-3 pb-3 text-[11px] leading-snug text-foreground/80">{tx(step.explain)}</span>
      )}
    </Link>
  );
}

/** Small caption row reused inside scene objects. */
export function ObjectHeader({
  icon: Icon,
  title,
  meta,
  active,
}: {
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  title: string;
  meta?: string;
  active: boolean;
}) {
  return (
    <span className="flex items-center gap-2 px-3 pt-3">
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors ${
          active ? "bg-primary/20 text-primary" : "bg-white/10 text-foreground/70"
        }`}
      >
        <Icon size={14} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-semibold leading-tight text-foreground">{title}</span>
        {meta && <span className="block truncate text-[10px] text-muted-foreground">{meta}</span>}
      </span>
    </span>
  );
}