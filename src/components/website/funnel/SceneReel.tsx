"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";
import { openConcierge } from "./OfferRail";
import { useSeen } from "./primitives";
import { SCENES } from "./ScrollScenes";

const ORDER = ["reviews", "web", "social", "phone", "listing", "invoice"];
const REEL = ORDER.map((k) => SCENES.find((s) => s.key === k)!).filter(Boolean);
const SCENE_MS = 5000;
const STEP_MS = 250;

const T = {
  ask: { fr: "Parlez à l'IA de TAKATAK", en: "Talk to TAKATAK's AI" },
  demo: { fr: "Démonstration · 30 s", en: "Demo · 30 s" },
} as const;

function stageAt(ms: number): string {
  if (ms < 200) return "";
  if (ms < 1400) return "0";
  if (ms < 2500) return "01";
  if (ms < 3500) return "012";
  return "0123";
}

/**
 * A 30-second reel, six scenes of five seconds, played large: a Google review
 * arrives and the AI answers it, a site goes live, posts go out, a call is
 * routed, a listing updates, an invoice is paid. A click opens the assistant.
 */
export function SceneReel() {
  const { lang: l } = useLanguage();
  const lang = l as "fr" | "en";
  const reduced = useReducedMotion();
  const { ref, seen } = useSeen<HTMLButtonElement>();
  const [t, setT] = useState(0);

  useEffect(() => {
    if (reduced || !seen) return;
    const id = window.setInterval(() => setT((v) => (v + STEP_MS) % (SCENE_MS * REEL.length)), STEP_MS);
    return () => window.clearInterval(id);
  }, [reduced, seen]);

  const index = Math.floor(t / SCENE_MS);
  const scene = REEL[index];
  const stage = reduced ? "0123" : seen ? stageAt(t % SCENE_MS) : "";
  const Body = scene.Body;

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => openConcierge({ first: scene.tag[lang] })}
      aria-label={T.ask[lang]}
      className="group absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#0A1630,#060D1F_70%)] text-left"
    >
      <span aria-hidden className="hp-tech-grid opacity-50" />
      <span className="absolute left-5 top-5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/70">{T.demo[lang]}</span>
      <span className="relative mb-4 text-[13px] font-semibold uppercase tracking-[0.18em] text-[#7FD8FF]">{scene.tag[lang]}</span>
      <span className="relative block origin-center scale-[1.08] sm:scale-[1.35] lg:scale-[1.45]">
        <figure key={scene.key} data-s={stage} className="sc tk-fade-in relative w-[300px] rounded-[18px] bg-white/[0.06] p-2 ring-1 ring-white/15">
          <div className="relative h-[196px]">
            <Body lang={lang} />
          </div>
        </figure>
      </span>
      {/* Story-style progress, one segment per scene */}
      <span className="absolute inset-x-5 bottom-16 flex gap-1.5" aria-hidden>
        {REEL.map((s, i) => (
          <span key={s.key} className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
            <span
              className="block h-full rounded-full bg-white"
              style={{ width: i < index ? "100%" : i > index ? "0%" : `${((t % SCENE_MS) / SCENE_MS) * 100}%`, transition: `width ${STEP_MS}ms linear` }}
            />
          </span>
        ))}
      </span>
      <span className="absolute bottom-5 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-[#060D1F] shadow-xl transition-transform group-hover:scale-105">
        <Sparkles size={15} aria-hidden /> {T.ask[lang]}
      </span>
    </button>
  );
}
