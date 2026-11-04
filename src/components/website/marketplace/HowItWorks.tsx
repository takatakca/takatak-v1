"use client";

import { FileSignature, MessageSquare, Search, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/lib/website/use-language";

const STEPS = [
  {
    n: "01",
    icon: Search,
    t: { fr: "Choisissez un service ou demandez un projet sur mesure", en: "Choose a service or request a custom build" },
    d: {
      fr: "Partez d’un forfait TAKATAK prêt à commander, ou décrivez le résultat exact dont votre entreprise a besoin.",
      en: "Start with a ready-made TAKATAK package or describe the exact business result you need.",
    },
  },
  {
    n: "02",
    icon: FileSignature,
    t: { fr: "Confirmez le contenu, l’échéancier et le budget", en: "Confirm scope, timeline, and budget" },
    d: {
      fr: "On transforme votre demande en un plan clair : livrables, étapes, prix et points d’approbation.",
      en: "We turn your request into a clear project brief with deliverables, milestones, pricing, and approval checkpoints.",
    },
  },
  {
    n: "03",
    icon: MessageSquare,
    t: { fr: "Suivez le travail dans votre tableau de bord", en: "Track the work from your dashboard" },
    d: {
      fr: "Fichiers, messages, étapes, révisions et livraisons restent rangés dans un seul espace sécurisé.",
      en: "Your files, messages, milestones, revisions, and delivery updates stay organized in one secure workspace.",
    },
  },
  {
    n: "04",
    icon: ShieldCheck,
    t: { fr: "Révisez, approuvez, c’est terminé", en: "Review, approve, and complete" },
    d: {
      fr: "TAKATAK gère le contrôle de qualité, la revue de la livraison et les règles de paiement avant de fermer le projet.",
      en: "TAKATAK manages quality control, delivery review, and payment release rules before the project is closed.",
    },
  },
];

const COPY = {
  title: { fr: "Comment TAKATAK livre votre projet", en: "How TAKATAK delivers your project" },
  lead: {
    fr: "Une façon de livrer pensée pour les propriétaires d’entreprise : un travail fiable, une communication claire, un résultat professionnel.",
    en: "A structured delivery process built for business owners who need reliable execution, clear communication, and professional results.",
  },
} as const;

export function HowItWorks() {
  const { lang } = useLanguage();
  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground md:text-3xl">{COPY.title[lang]}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{COPY.lead[lang]}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.n} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="font-mono text-xs text-muted-foreground">{s.n}</div>
                <Icon size={18} className="text-primary" aria-hidden />
              </div>
              <h3 className="mt-4 font-semibold text-foreground">{s.t[lang]}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.d[lang]}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
