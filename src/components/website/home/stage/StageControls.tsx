"use client";

import { useLanguage } from "@/lib/website/use-language";
import { STAGE_WORLDS, type StageKey } from "@/lib/website/stage-worlds";

/**
 * Business-progress controller: three connected stage markers rather than
 * ordinary tabs. Keyboard: arrow keys move between stages.
 */
export function StageControls({
  current,
  onSelect,
}: {
  current: StageKey;
  onSelect: (key: StageKey) => void;
}) {
  const { tx } = useLanguage();
  const activeIndex = STAGE_WORLDS.findIndex((w) => w.key === current);

  return (
    <div
      role="tablist"
      aria-label={tx({ en: "Business stages", fr: "Étapes d'affaires" })}
      aria-orientation="horizontal"
      className="relative grid grid-cols-3 gap-2 md:gap-0"
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-[16%] top-1/2 hidden h-px -translate-y-1/2 bg-white/12 md:block" />
      <span
        aria-hidden
        className="pointer-events-none absolute left-[16%] top-1/2 hidden h-px -translate-y-1/2 bg-primary/70 transition-all duration-500 md:block"
        style={{ width: `${(activeIndex / 2) * 68}%` }}
      />
      {STAGE_WORLDS.map((w, i) => {
        const selected = w.key === current;
        const past = i < activeIndex;
        return (
          <button
            key={w.key}
            type="button"
            role="tab"
            id={`tk-stage-tab-${w.key}`}
            aria-selected={selected}
            aria-controls="tk-stage-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(w.key)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const next = (i + (e.key === "ArrowRight" ? 1 : -1) + STAGE_WORLDS.length) % STAGE_WORLDS.length;
              onSelect(STAGE_WORLDS[next]!.key);
              document.getElementById(`tk-stage-tab-${STAGE_WORLDS[next]!.key}`)?.focus();
            }}
            className={`relative z-10 flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 transition-all duration-300 md:gap-3 md:px-5 ${
              selected
                ? "border-primary/50 bg-primary/12 shadow-[0_24px_60px_-38px_rgba(0,0,0,0.9)]"
                : past
                  ? "border-white/12 bg-white/[0.05] opacity-80"
                  : "border-dashed border-white/15 bg-transparent opacity-70"
            }`}
          >
            <span
              className={`font-black leading-none tabular-nums transition-all ${
                selected ? "text-2xl text-primary md:text-3xl" : "text-base text-muted-foreground md:text-lg"
              }`}
            >
              0{i + 1}
            </span>
            <span
              className={`truncate text-[11px] font-semibold uppercase tracking-[0.16em] md:text-xs ${
                selected ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {tx(w.name)}
            </span>
          </button>
        );
      })}
    </div>
  );
}