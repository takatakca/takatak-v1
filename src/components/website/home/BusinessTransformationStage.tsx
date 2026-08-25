"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MotionViewport } from "@/components/website/motion/MotionViewport";
import { SectionTransition } from "@/components/website/motion/SectionTransition";
import { Reveal } from "@/components/website/motion/Reveal";
import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";
import { STAGE_WORLDS, type StageKey } from "@/lib/website/stage-worlds";
import { StageBackdrop } from "./stage/StageBackdrop";
import { StageControls } from "./stage/StageControls";
import { StageInformation } from "./stage/StageInformation";
import { LaunchScene } from "./stage/LaunchScene";
import { GrowScene } from "./stage/GrowScene";
import { OperateScene } from "./stage/OperateScene";

/** Beat cadence, in ms. */
const BEAT_MS = 850;
/** Calm period after a stage story completes, before autoplay advances. */
const REST_MS = 3200;

/**
 * Pass 4 — Launch / Grow / Operate flagship transformation stage.
 * One cinematic environment that visibly transforms with the selected stage.
 */
export function BusinessTransformationStage() {
  const { tx } = useLanguage();

  return (
    <section
      className="brand-dark relative overflow-hidden border-y border-border"
      aria-label={tx({ en: "Business transformation stages", fr: "Étapes de transformation d'entreprise" })}
    >
      <SectionTransition direction="to-dark" className="absolute inset-x-0 top-0" />
      <MotionViewport className="relative">{(active) => <Stage active={active} />}</MotionViewport>
      <SectionTransition direction="to-light" className="absolute inset-x-0 bottom-0" />
    </section>
  );
}

function Stage({ active }: { active: boolean }) {
  const { tx } = useLanguage();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const touchX = useRef<number | null>(null);
  const world = STAGE_WORLDS[index]!;
  const total = world.beats;
  // Rests at the full sequence so static and reduced-motion renders are complete.
  const [beat, setBeat] = useState(total);

  const go = useCallback((next: number) => {
    setIndex((next + STAGE_WORLDS.length) % STAGE_WORLDS.length);
  }, []);

  const playing = active && !held && !reduced;

  useEffect(() => {
    setBeat(playing ? 0 : STAGE_WORLDS[index]!.beats);
  }, [index, playing]);

  useEffect(() => {
    if (!playing) return;
    if (beat >= total) {
      const id = window.setTimeout(() => go(index + 1), REST_MS);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setBeat((b) => b + 1), BEAT_MS);
    return () => window.clearTimeout(id);
  }, [playing, beat, total, index, go]);

  const select = (key: StageKey) => {
    setHeld(true);
    setIndex(STAGE_WORLDS.findIndex((w) => w.key === key));
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        const end = e.changedTouches[0]?.clientX;
        if (start == null || end == null) return;
        if (Math.abs(end - start) > 48) go(index + (end < start ? 1 : -1));
      }}
    >
      <StageBackdrop stage={world.key} />

      <div className="relative mx-auto max-w-7xl px-4 py-16 md:py-24">
        <Reveal className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
              {tx({ en: "One system, three stages.", fr: "Un système, trois étapes." })}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {tx({
                en: "Launch the foundation, grow demand, then operate everything from one workspace.",
                fr: "Lancez la fondation, développez la demande, puis opérez le tout depuis un seul espace.",
              })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={tx({ en: "Previous stage", fr: "Étape précédente" })}
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 bg-white/5 text-foreground/80 hover:bg-white/10"
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label={tx({ en: "Next stage", fr: "Étape suivante" })}
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 bg-white/5 text-foreground/80 hover:bg-white/10"
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </Reveal>

        <div className="mt-8">
          <StageControls current={world.key} onSelect={select} />
        </div>

        <div
          id="tk-stage-panel"
          role="tabpanel"
          aria-labelledby={`tk-stage-tab-${world.key}`}
          aria-live="polite"
          className="mt-8 grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12"
        >
          <div className="relative">
            {world.key === "launch" && <LaunchScene key="launch" beat={beat} animated={playing} />}
            {world.key === "grow" && <GrowScene key="grow" beat={beat} />}
            {world.key === "operate" && <OperateScene key="operate" beat={beat} />}
            {/* Shared workspace continuity marker across all three worlds. */}
            <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {tx({ en: "TAKATAK workspace", fr: "Espace TAKATAK" })} · {tx(world.workspace)}
            </p>
          </div>

          <StageInformation world={world} />
        </div>
      </div>
    </div>
  );
}