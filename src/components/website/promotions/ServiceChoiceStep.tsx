"use client";

import {
  Bot, Globe2, LayoutTemplate, Megaphone, MapPin, Palette, Server, TrendingUp, HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import { formatCAD, pricing } from "@/lib/website/pricing";

export interface OfferServiceChoice {
  key: string;
  label: { en: string; fr: string };
  outcome: { en: string; fr: string };
  from: number | null;
  next: string;
  icon: LucideIcon;
}

export const OFFER_SERVICES: OfferServiceChoice[] = [
  { key: "websites", icon: LayoutTemplate, next: "/services/websites", from: pricing.websites[0].amount,
    label: { en: "Website", fr: "Site web" }, outcome: { en: "Turn visitors into customers.", fr: "Transformez vos visiteurs en clients." } },
  { key: "domains", icon: Globe2, next: "/domain", from: pricing.domain.register.amount,
    label: { en: "Domain", fr: "Domaine" }, outcome: { en: "Secure your business name.", fr: "Réservez le nom de votre entreprise." } },
  { key: "hosting", icon: Server, next: "/hosting", from: pricing.hosting[0].amount,
    label: { en: "Hosting", fr: "Hébergement" }, outcome: { en: "Fast, managed and secure.", fr: "Rapide, géré et sécurisé." } },
  { key: "marketing", icon: Megaphone, next: "/services/marketing", from: pricing.marketing[0].amount,
    label: { en: "Marketing", fr: "Marketing" }, outcome: { en: "Reach the right buyers.", fr: "Rejoignez les bons acheteurs." } },
  { key: "branding", icon: Palette, next: "/services/logo-branding", from: pricing.branding[0].amount,
    label: { en: "Branding", fr: "Image de marque" }, outcome: { en: "Look established from day one.", fr: "Ayez l'air établi dès le départ." } },
  { key: "local", icon: MapPin, next: "/services/local-listings", from: pricing.local[0].amount,
    label: { en: "Local visibility", fr: "Visibilité locale" }, outcome: { en: "Get found nearby.", fr: "Faites-vous trouver près de chez vous." } },
  { key: "leads", icon: TrendingUp, next: "/services/lead-generation", from: pricing.leads[0].amount,
    label: { en: "Leads", fr: "Clients potentiels" }, outcome: { en: "Fill your pipeline.", fr: "Remplissez votre pipeline." } },
  { key: "automation", icon: Bot, next: "/services/automation", from: pricing.ai[0].amount,
    label: { en: "Automation", fr: "Automatisation" }, outcome: { en: "Remove manual work.", fr: "Éliminez le travail manuel." } },
  { key: "unsure", icon: HelpCircle, next: "/services", from: null,
    label: { en: "Not sure yet", fr: "Je ne sais pas encore" }, outcome: { en: "Talk to TAKATAK.", fr: "Parlez à TAKATAK." } },
];

export function ServiceChoiceStep({ onSelect }: { onSelect: (choice: OfferServiceChoice) => void }) {
  const { t, tx } = useLanguage();
  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">{t("offer.service.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("offer.service.body")}</p>
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {OFFER_SERVICES.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onSelect(s)}
              className="rounded-xl border border-border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/55"
            >
              <Icon size={16} className="text-primary" />
              <span className="mt-2 block text-sm font-semibold text-foreground">{tx(s.label)}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{tx(s.outcome)}</span>
              {s.from !== null && (
                <span className="mt-1.5 block text-[11px] font-medium text-foreground/70">
                  {formatCAD(s.from)}+
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}