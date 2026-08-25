"use client";

import { useEffect, useState } from "react";
import { Link } from "@/lib/website/nav";
import { ArrowRight, ClipboardList, FileText, FolderKanban, Wrench, Eye, ShieldCheck, Headset } from "lucide-react";
import { MotionViewport } from "@/components/website/motion/MotionViewport";
import { Reveal } from "@/components/website/motion/Reveal";
import { useLanguage } from "@/lib/website/use-language";
import { JourneyStep, type JourneyStepData } from "./JourneyStep";

const STEPS: readonly JourneyStepData[] = [
  { n: "01", icon: ClipboardList, title: { en: "Request", fr: "Demande" }, desc: { en: "Tell us what your business needs.", fr: "Dites-nous ce dont votre entreprise a besoin." }, trust: { en: "Guided service selection", fr: "Sélection de service guidée" } },
  { n: "02", icon: FileText, title: { en: "Scope", fr: "Portée" }, desc: { en: "You approve the plan before anything starts.", fr: "Vous approuvez le plan avant tout démarrage." }, trust: { en: "Clear price and deliverables", fr: "Prix et livrables clairs" } },
  { n: "03", icon: FolderKanban, title: { en: "Workspace", fr: "Espace de travail" }, desc: { en: "Everything happens in one private space.", fr: "Tout se déroule dans un espace privé." }, trust: { en: "Secure project tracking", fr: "Suivi de projet sécurisé" } },
  { n: "04", icon: Wrench, title: { en: "Build", fr: "Réalisation" }, desc: { en: "Vetted specialists do the work.", fr: "Des spécialistes vérifiés exécutent le travail." }, trust: { en: "Managed TAKATAK delivery", fr: "Livraison encadrée par TAKATAK" } },
  { n: "05", icon: Eye, title: { en: "Review", fr: "Révision" }, desc: { en: "We check quality before you see it.", fr: "Nous vérifions la qualité avant vous." }, trust: { en: "Human review", fr: "Révision humaine" } },
  { n: "06", icon: ShieldCheck, title: { en: "Approval", fr: "Approbation" }, desc: { en: "Nothing closes until you accept it.", fr: "Rien ne se termine sans votre accord." }, trust: { en: "Customer approval first", fr: "Approbation du client d'abord" } },
  { n: "07", icon: Headset, title: { en: "Support", fr: "Soutien" }, desc: { en: "We stay available after delivery.", fr: "Nous restons disponibles après la livraison." }, trust: { en: "Bilingual assistance", fr: "Assistance bilingue" } },
];

/** One premium section combining the managed process and the trust promises. */
export function ManagedDeliveryJourney() {
  return (
    <section className="relative border-b border-border bg-background">
      <MotionViewport>{(active) => <Timeline active={active} />}</MotionViewport>
    </section>
  );
}

function Timeline({ active }: { active: boolean }) {
  const { tx } = useLanguage();
  const [reached, setReached] = useState(STEPS.length);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!active) {
      setReached(STEPS.length);
      return;
    }
    setReached(0);
  }, [active]);

  useEffect(() => {
    if (!active || reached >= STEPS.length) return;
    const id = window.setTimeout(() => setReached((r) => r + 1), 320);
    return () => window.clearTimeout(id);
  }, [active, reached]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 md:py-24">
      <Reveal className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {tx({ en: "Managed delivery", fr: "Livraison encadrée" })}
        </p>
        <h2 className="mt-3 text-3xl font-bold leading-tight text-foreground md:text-4xl">
          {tx({ en: "How every TAKATAK project runs.", fr: "Comment se déroule chaque projet TAKATAK." })}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {tx({
            en: "One managed path from request to support — reviewed by people, approved by you.",
            fr: "Un parcours géré de la demande au soutien — révisé par des humains, approuvé par vous.",
          })}
        </p>
      </Reveal>

      <div className="relative mt-10">
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-9 hidden h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent transition-all duration-700 lg:block"
          style={{ width: `${(reached / STEPS.length) * 100}%` }}
        />
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.n} className="h-full">
              <JourneyStep
                step={s}
                reached={reached > i}
                active={selected === i}
                onSelect={() => setSelected(i)}
              />
            </li>
          ))}
          <li className="flex h-full flex-col justify-center rounded-2xl border border-dashed border-border bg-secondary/40 p-5">
            <p className="text-sm font-semibold text-foreground">
              {tx({ en: "Ready when you are.", fr: "Prêt quand vous l'êtes." })}
            </p>
            <Link
              to="/marketplace/post-project"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              {tx({ en: "Start a project", fr: "Démarrer un projet" })} <ArrowRight size={14} aria-hidden />
            </Link>
          </li>
        </ol>
      </div>
    </div>
  );
}