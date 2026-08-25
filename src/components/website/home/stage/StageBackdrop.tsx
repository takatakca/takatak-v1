"use client";

import { useLanguage } from "@/lib/website/use-language";
import { STAGE_WORLDS, type StageKey } from "@/lib/website/stage-worlds";

/**
 * One controlled lighting + environment system for the three transformation
 * worlds. Only the palette, geometry and environmental word change — the
 * brand character stays constant.
 */
export function StageBackdrop({ stage }: { stage: StageKey }) {
  const { tx } = useLanguage();
  const world = STAGE_WORLDS.find((w) => w.key === stage)!;

  const lighting: Record<StageKey, string> = {
    launch:
      "radial-gradient(900px 480px at 18% 8%, color-mix(in oklab, var(--primary) 20%, transparent), transparent 70%), radial-gradient(700px 420px at 85% 90%, color-mix(in oklab, var(--brand-dark-2) 90%, transparent), transparent 72%)",
    grow:
      "radial-gradient(900px 480px at 70% 5%, color-mix(in oklab, var(--brand-accent-cyan, var(--primary)) 22%, transparent), transparent 70%), radial-gradient(760px 460px at 12% 85%, color-mix(in oklab, var(--primary) 20%, transparent), transparent 72%)",
    operate:
      "radial-gradient(1000px 520px at 50% 100%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 70%), radial-gradient(680px 400px at 10% 0%, color-mix(in oklab, var(--brand-dark-2) 95%, transparent), transparent 75%)",
  };

  const geometry: Record<StageKey, { image: string; size: string }> = {
    launch: {
      image:
        "linear-gradient(var(--brand-dark-border) 1px, transparent 1px), linear-gradient(90deg, var(--brand-dark-border) 1px, transparent 1px)",
      size: "56px 56px",
    },
    grow: {
      image:
        "linear-gradient(var(--brand-dark-border) 1px, transparent 1px), linear-gradient(90deg, var(--brand-dark-border) 1px, transparent 1px), linear-gradient(45deg, var(--brand-dark-border) 1px, transparent 1px)",
      size: "84px 84px, 84px 84px, 168px 168px",
    },
    operate: {
      image:
        "linear-gradient(var(--brand-dark-border) 1px, transparent 1px), linear-gradient(90deg, var(--brand-dark-border) 1px, transparent 1px)",
      size: "34px 34px",
    },
  };

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        key={`light-${stage}`}
        className="absolute inset-0 transition-opacity duration-700"
        style={{ background: lighting[stage] }}
      />
      <div
        key={`grid-${stage}`}
        className="tk-grid-drift absolute inset-0 opacity-[0.14] transition-opacity duration-700"
        style={{
          backgroundImage: geometry[stage].image,
          backgroundSize: geometry[stage].size,
          maskImage: "radial-gradient(ellipse at 45% 35%, black 30%, transparent 88%)",
        }}
      />
      {/* Environmental typography — depth, never a competing headline. */}
      <span
        key={`word-${stage}`}
        className="tk-stage-word absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap text-[22vw] font-black leading-none tracking-tighter md:text-[15vw]"
      >
        {tx(world.word)}
      </span>
    </div>
  );
}