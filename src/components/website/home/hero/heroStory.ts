import type { StatusKey } from "@/components/website/motion/AnimatedStatus";

export type HeroStepKey =
  | "domain"
  | "hosting"
  | "website"
  | "qmaps"
  | "flexs"
  | "voip"
  | "automation"
  | "workspace";

export interface HeroStep {
  key: HeroStepKey;
  /** Where the node links to. */
  to: string;
  label: { en: string; fr: string };
  explain: { en: string; fr: string };
  idleStatus: StatusKey;
  activeStatus: StatusKey;
}

/**
 * The choreographed TAKATAK hero story. The eye travels foundation →
 * website → visibility → opportunity → communications → automation →
 * workspace. Every state is a demonstration, never live provider data.
 */
export const HERO_STEPS: readonly HeroStep[] = [
  {
    key: "domain",
    to: "/domain",
    label: { en: "Domain", fr: "Domaine" },
    explain: {
      en: "Secure the .ca or .com name your business will be known by.",
      fr: "Réservez le nom .ca ou .com de votre entreprise.",
    },
    idleStatus: "checking",
    activeStatus: "available",
  },
  {
    key: "hosting",
    to: "/hosting",
    label: { en: "Hosting", fr: "Hébergement" },
    explain: {
      en: "Managed Canadian hosting with DNS, SSL and daily backups.",
      fr: "Hébergement géré au Canada avec DNS, SSL et sauvegardes.",
    },
    idleStatus: "connecting",
    activeStatus: "secured",
  },
  {
    key: "website",
    to: "/services/websites",
    label: { en: "Website", fr: "Site web" },
    explain: {
      en: "Designed, mobile-ready and reviewed by our team before launch.",
      fr: "Conçu, adapté au mobile et révisé par notre équipe avant le lancement.",
    },
    idleStatus: "building",
    activeStatus: "live",
  },
  {
    key: "qmaps",
    to: "/services/local-listings",
    label: { en: "QMAPS visibility", fr: "Visibilité QMAPS" },
    explain: {
      en: "Your business appears where nearby customers are already searching.",
      fr: "Votre entreprise apparaît là où les clients de la région cherchent déjà.",
    },
    idleStatus: "connecting",
    activeStatus: "campaignActive",
  },
  {
    key: "flexs",
    to: "/services/lead-generation",
    label: { en: "FLEXS opportunity", fr: "Occasion FLEXS" },
    explain: {
      en: "Every inquiry lands in one pipeline with its source and next step.",
      fr: "Chaque demande arrive dans un pipeline unique, avec sa source et sa suite.",
    },
    idleStatus: "connecting",
    activeStatus: "newOpportunity",
  },
  {
    key: "voip",
    to: "/services/voip",
    label: { en: "Business phone", fr: "Téléphonie d'affaires" },
    explain: {
      en: "Calls route to the right person, voicemail arrives as readable text.",
      fr: "Les appels sont acheminés à la bonne personne, la messagerie devient du texte.",
    },
    idleStatus: "connecting",
    activeStatus: "callRouted",
  },
  {
    key: "automation",
    to: "/services/automation",
    label: { en: "Automation", fr: "Automatisation" },
    explain: {
      en: "Trigger, condition, action — repetitive work runs on its own.",
      fr: "Déclencheur, condition, action — le travail répétitif s'exécute seul.",
    },
    idleStatus: "connecting",
    activeStatus: "workflowCompleted",
  },
  {
    key: "workspace",
    to: "/register",
    label: { en: "TAKATAK workspace", fr: "Espace TAKATAK" },
    explain: {
      en: "One secure workspace for progress, approvals and bilingual support.",
      fr: "Un espace sécurisé pour le progrès, les approbations et le soutien bilingue.",
    },
    idleStatus: "awaitingApproval",
    activeStatus: "approved",
  },
];

export const HERO_STEP_INDEX: Record<HeroStepKey, number> = HERO_STEPS.reduce(
  (acc, s, i) => ({ ...acc, [s.key]: i }),
  {} as Record<HeroStepKey, number>,
);