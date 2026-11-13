"use client";

import { Banknote, BadgeCheck, Headphones, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/lib/website/use-language";

const ITEMS = [
  {
    icon: ShieldCheck,
    t: { fr: "Paiement protégé", en: "Protected payment" },
    d: { fr: "Le paiement est retenu par TAKATAK et versé à votre approbation.", en: "Payment is held by TAKATAK and released on approval." },
  },
  {
    icon: BadgeCheck,
    t: { fr: "Talents vérifiés", en: "Vetted talent" },
    d: { fr: "Chaque pigiste est évalué par Groupe TAKATAK avant de se joindre.", en: "Every freelancer is screened by Groupe TAKATAK before joining." },
  },
  {
    icon: Headphones,
    t: { fr: "Soutien humain", en: "Human support" },
    d: { fr: "De vraies personnes prêtes à aider quand un projet en a besoin.", en: "Real people on standby when a project needs a hand." },
  },
  {
    icon: Banknote,
    t: { fr: "Prix clairs", en: "Transparent pricing" },
    d: { fr: "Des prix fixes et un contenu clair, sans frais cachés.", en: "Fixed prices and clear scope — no hidden fees." },
  },
];

export function TrustBlock() {
  const { lang } = useLanguage();
  return (
    <section className="brand-dark relative overflow-hidden rounded-2xl border border-white/10 p-6 md:p-8">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--brand-accent-cyan), var(--brand-accent-violet), transparent)" }}
      />
      <div className="relative grid grid-cols-2 gap-6 md:grid-cols-4">
        {ITEMS.map((i) => {
          const Icon = i.icon;
          return (
            <div key={i.t.en}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-primary">
                <Icon size={18} aria-hidden />
              </div>
              <div className="mt-3 font-semibold text-foreground">{i.t[lang]}</div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{i.d[lang]}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
