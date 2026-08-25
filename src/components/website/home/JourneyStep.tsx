"use client";

import type { LucideIcon } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import type { Bilingual } from "@/lib/website/transformation-stages";

export interface JourneyStepData {
  n: string;
  icon: LucideIcon;
  title: Bilingual;
  desc: Bilingual;
  trust: Bilingual;
}

export function JourneyStep({
  step,
  reached,
  active,
  onSelect,
}: {
  step: JourneyStepData;
  reached: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const { tx } = useLanguage();
  const Icon = step.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      onFocus={onSelect}
      aria-pressed={active}
      className={`group h-full w-full rounded-2xl border p-4 text-left transition-all duration-300 ${
        active
          ? "border-primary/50 bg-primary/[0.06] shadow-[var(--shadow-card)]"
          : "border-border bg-card hover:border-primary/30"
      }`}
    >
      <span
        className={`grid h-10 w-10 place-items-center rounded-xl border transition-colors ${
          reached ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground"
        }`}
      >
        <Icon size={17} aria-hidden />
      </span>
      <p className="mt-3 text-[11px] font-semibold tracking-widest text-muted-foreground">{step.n}</p>
      <h3 className="mt-0.5 text-sm font-semibold text-foreground">{tx(step.title)}</h3>
      <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">{tx(step.desc)}</p>
      <p
        className={`mt-3 text-[11px] font-semibold uppercase tracking-wider transition-opacity ${
          active ? "text-primary opacity-100" : "text-muted-foreground opacity-70"
        }`}
      >
        {tx(step.trust)}
      </p>
    </button>
  );
}