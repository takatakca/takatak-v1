"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import { MotionViewport } from "@/components/website/motion/MotionViewport";
import { FlowLine } from "@/components/website/motion/FlowLine";
import { motion } from "@/lib/website/motion-config";
import { useLanguage } from "@/lib/website/use-language";
import { HERO_STEPS, type HeroStepKey } from "./heroStory";
import {
  FoundationPanel,
  HostingPanel,
  WebsitePanel,
  VisibilityPanel,
  OpportunityPanel,
  CallPanel,
  AutomationPanel,
  WorkspacePanel,
  type PanelProps,
} from "./HeroPanels";

const TOTAL = HERO_STEPS.length;

type Placement = { left: number; top: number; width: number; z: number };

/** Desktop composition, in percentages of the scene box. */
const PLACEMENT: Record<HeroStepKey, Placement> = {
  domain: { left: 0, top: 0, width: 38, z: 10 },
  hosting: { left: 1, top: 31, width: 32, z: 10 },
  website: { left: 42, top: 0, width: 58, z: 20 },
  qmaps: { left: 66, top: 43, width: 34, z: 20 },
  workspace: { left: 3, top: 52, width: 59, z: 25 },
  flexs: { left: 67, top: 74, width: 33, z: 30 },
  voip: { left: 0, top: 82, width: 37, z: 30 },
  automation: { left: 39, top: 84, width: 30, z: 30 },
};

/** Node centres used by the connection layer (same percentage space). */
const CENTRE: Record<HeroStepKey, { x: number; y: number }> = {
  domain: { x: 19, y: 10 },
  hosting: { x: 16, y: 38 },
  website: { x: 71, y: 21 },
  qmaps: { x: 83, y: 57 },
  flexs: { x: 84, y: 82 },
  voip: { x: 18, y: 90 },
  automation: { x: 54, y: 91 },
  workspace: { x: 32, y: 66 },
};

const ORDER: HeroStepKey[] = ["domain", "hosting", "website", "qmaps", "flexs", "voip", "automation", "workspace"];

const PANELS: Record<HeroStepKey, (p: PanelProps) => ReactElement> = {
  domain: FoundationPanel,
  hosting: HostingPanel,
  website: WebsitePanel,
  qmaps: VisibilityPanel,
  flexs: OpportunityPanel,
  voip: CallPanel,
  automation: AutomationPanel,
  workspace: WorkspacePanel,
};

/**
 * The flagship TAKATAK hero scene: one art-directed digital environment where
 * the customer journey runs from domain and hosting through the website,
 * QMAPS visibility, FLEXS opportunities, business phone and automation into
 * the managed workspace. Everything shown is a demonstration.
 */
export function HeroFlagshipScene({ explore = false }: { explore?: boolean }) {
  return (
    <MotionViewport className="relative w-full">
      {(active) => <Scene active={active && !explore} explore={explore} />}
    </MotionViewport>
  );
}

function Scene({ active, explore }: { active: boolean; explore: boolean }) {
  const { tx } = useLanguage();
  const sceneRef = useRef<HTMLDivElement>(null);
  // `step` = how many objects have activated. Rests at TOTAL so static and
  // reduced-motion renders always show the complete connected system.
  const [step, setStep] = useState(TOTAL);
  const [selected, setSelected] = useState<HeroStepKey | null>(null);
  const paused = selected !== null;

  useEffect(() => {
    if (!active) {
      setStep(TOTAL);
      return;
    }
    if (paused) return;
    const delay = step >= TOTAL ? motion.story.step + motion.story.restPause : motion.story.step;
    const id = window.setTimeout(() => setStep((s) => (s >= TOTAL ? 1 : s + 1)), delay);
    return () => window.clearTimeout(id);
  }, [active, paused, step]);

  /** One shared pointer calculation drives parallax for the whole scene. */
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const el = sceneRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--tk-px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty("--tk-py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  }

  function resetPointer() {
    sceneRef.current?.style.setProperty("--tk-px", "0");
    sceneRef.current?.style.setProperty("--tk-py", "0");
  }

  const panelProps = (key: HeroStepKey, index: number, compact = false): PanelProps => {
    const stepData = HERO_STEPS[index]!;
    return {
      step: stepData,
      reached: step > index,
      current: step === index + 1,
      selected: selected === key,
      onEnter: () => setSelected(key),
      onLeave: () => setSelected(null),
      progress: step,
      compact,
    };
  };

  return (
    <div>
      <p className="sr-only">
        {tx({
          en: "Illustration of the TAKATAK system: domain and hosting, website, QMAPS local visibility, FLEXS opportunities, business phone, automation and your managed workspace, connected in one environment.",
          fr: "Illustration du système TAKATAK : domaine et hébergement, site web, visibilité locale QMAPS, occasions FLEXS, téléphonie d'affaires, automatisation et votre espace géré, connectés dans un seul environnement.",
        })}
      </p>

      {/* Desktop / tablet: art-directed environment */}
      <div
        ref={sceneRef}
        onPointerMove={onPointerMove}
        onPointerLeave={resetPointer}
        className="tk-hero-scene relative hidden aspect-[760/680] w-full md:block lg:aspect-[760/640]"
      >
        {/* ambient light behind the anchor */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-[6%] top-[38%] h-[46%] w-[62%] rounded-[40px] blur-3xl"
          style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--primary) 22%, transparent), transparent)" }}
        />

        {/* connection layer */}
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full text-foreground"
        >
          {ORDER.slice(0, -1).map((key, i) => (
            <FlowLine
              key={`${key}-link`}
              from={CENTRE[key]!}
              to={CENTRE[ORDER[i + 1]!]!}
              active={step > i}
              animated={active && step === i + 1}
            />
          ))}
        </svg>

        {ORDER.map((key, i) => {
          const Panel = PANELS[key];
          const place = PLACEMENT[key];
          return (
            <div
              key={key}
              className="absolute"
              style={{
                left: `${place.left}%`,
                top: `${place.top}%`,
                width: `${place.width}%`,
                zIndex: selected === key ? 40 : place.z,
              }}
            >
              <Panel {...panelProps(key, i)} />
            </div>
          );
        })}

        {explore && (
          <span className="pointer-events-none absolute bottom-1 right-1 rounded-full border border-white/12 bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-foreground/80">
            {tx({ en: "Explore mode — select any service", fr: "Mode exploration — choisissez un service" })}
          </span>
        )}
      </div>

      {/* Mobile: recomposed vertical environment */}
      <ul className="space-y-2.5 md:hidden">
        {ORDER.map((key, i) => {
          const Panel = PANELS[key];
          return (
            <li key={key}>
              <Panel {...panelProps(key, i, true)} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}