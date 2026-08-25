"use client";

import { useEffect, useState } from "react";
import { ECOSYSTEM_NODES } from "./ecosystemNodes";
import { EcosystemNode } from "./EcosystemNode";
import { EcosystemConnection } from "./EcosystemConnection";
import { MotionViewport } from "@/components/website/motion/MotionViewport";
import { motion } from "@/lib/website/motion-config";
import { useLanguage } from "@/lib/website/use-language";

const TOTAL = ECOSYSTEM_NODES.length;

/**
 * The signature TAKATAK scene: one connected business journey from domain to
 * managed workspace. The animation explains the workflow — it is never live
 * customer or provider data.
 */
export function BusinessSystemScene({ explore = false }: { explore?: boolean }) {
  return (
    <MotionViewport className="relative w-full">
      {(active) => <Scene active={active && !explore} />}
    </MotionViewport>
  );
}

function Scene({ active }: { active: boolean }) {
  const { tx } = useLanguage();
  // `step` = how many nodes have activated. It rests at TOTAL so static and
  // reduced-motion renders always show the complete connected system.
  const [step, setStep] = useState(TOTAL);
  const [selected, setSelected] = useState<string | null>(null);
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

  return (
    <div className="relative">
      <p className="sr-only">
        {tx({
          en: "Illustration of the TAKATAK workflow: domain, hosting, website, marketing, customer inquiries, business phone, automation and your managed workspace, connected in one system.",
          fr: "Illustration du parcours TAKATAK : domaine, hébergement, site web, marketing, demandes clients, téléphonie, automatisation et votre espace géré, connectés en un seul système.",
        })}
      </p>

      {/* Desktop / tablet: positioned connected scene */}
      <div className="relative hidden aspect-[720/520] w-full md:block">
        <EcosystemConnection nodes={ECOSYSTEM_NODES} step={step} animated={active} />
        {ECOSYSTEM_NODES.map((n, i) => (
          <div
            key={n.key}
            className="absolute"
            style={{ left: `${(n.x / 720) * 100}%`, top: `${(n.y / 520) * 100}%` }}
          >
            <EcosystemNode
              node={n}
              reached={step > i}
              current={step === i + 1}
              selected={selected === n.key}
              onEnter={() => setSelected(n.key)}
              onLeave={() => setSelected(null)}
            />
          </div>
        ))}
      </div>

      {/* Mobile: simplified vertical flow, tap or focus to explain */}
      <ul className="relative space-y-2.5 md:hidden">
        {ECOSYSTEM_NODES.map((n, i) => (
          <li key={n.key}>
            <EcosystemNode
              node={n}
              positioned={false}
              reached={step > i}
              current={step === i + 1}
              selected={selected === n.key}
              onEnter={() => setSelected(n.key)}
              onLeave={() => setSelected(null)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
