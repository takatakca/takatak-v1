import { Globe, Server, Layout, Mail, Megaphone, Share2, MapPin, Target, PhoneCall, Workflow, Bot, ClipboardList } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { pricing } from "@/lib/website/pricing";
import type { StatusKey } from "@/components/website/motion/AnimatedStatus";

export interface Bilingual {
  en: string;
  fr: string;
}

export interface StageService {
  icon: LucideIcon;
  label: Bilingual;
  to: string;
}

export interface StageBeat {
  label: Bilingual;
  status: StatusKey;
}

export interface TransformationStage {
  key: "launch" | "grow" | "operate";
  kicker: Bilingual;
  headline: Bilingual;
  outcome: Bilingual;
  /** Starting-price signal, in CAD units. */
  amount: number;
  cadence: "one-time" | "monthly" | "yearly";
  services: readonly StageService[];
  beats: readonly StageBeat[];
  primary: { label: Bilingual; to: string };
  secondary: { label: Bilingual; to: string };
}

/**
 * The three TAKATAK business stages. All copy is bilingual and every price
 * signal comes from the centralized pricing module.
 */
export const TRANSFORMATION_STAGES: readonly TransformationStage[] = [
  {
    key: "launch",
    kicker: { en: "Stage 01 — Launch", fr: "Étape 01 — Lancer" },
    headline: { en: "Build the professional foundation customers expect.", fr: "Bâtissez la fondation professionnelle que vos clients attendent." },
    outcome: {
      en: "Domain, hosting, website and business email connected as one managed setup.",
      fr: "Domaine, hébergement, site web et courriel d'affaires connectés en une seule configuration gérée.",
    },
    amount: pricing.websites[0].amount,
    cadence: "one-time",
    services: [
      { icon: Globe, label: { en: "Domain", fr: "Domaine" }, to: "/domain" },
      { icon: Server, label: { en: "Hosting", fr: "Hébergement" }, to: "/hosting" },
      { icon: Layout, label: { en: "Website", fr: "Site web" }, to: "/services/websites" },
      { icon: Mail, label: { en: "Business email", fr: "Courriel d'affaires" }, to: "/services/hosting" },
    ],
    beats: [
      { label: { en: "Business name entered", fr: "Nom d'entreprise saisi" }, status: "checking" },
      { label: { en: "Domain selected", fr: "Domaine sélectionné" }, status: "available" },
      { label: { en: "Hosting activated", fr: "Hébergement activé" }, status: "connecting" },
      { label: { en: "SSL and email ready", fr: "SSL et courriel prêts" }, status: "secured" },
      { label: { en: "Website pages assembled", fr: "Pages du site assemblées" }, status: "building" },
      { label: { en: "Website live", fr: "Site en ligne" }, status: "live" },
    ],
    primary: { label: { en: "Launch my digital foundation", fr: "Lancer ma fondation numérique" }, to: "/marketplace/post-project" },
    secondary: { label: { en: "Explore domains and hosting", fr: "Explorer les domaines et l'hébergement" }, to: "/hosting" },
  },
  {
    key: "grow",
    kicker: { en: "Stage 02 — Grow", fr: "Étape 02 — Croître" },
    headline: { en: "Turn visibility into real customer opportunities.", fr: "Transformez la visibilité en véritables occasions d'affaires." },
    outcome: {
      en: "Marketing, social, local visibility and lead capture working from one plan.",
      fr: "Marketing, réseaux sociaux, visibilité locale et captation de prospects réunis dans un seul plan.",
    },
    amount: pricing.marketing[0].amount,
    cadence: "one-time",
    services: [
      { icon: Megaphone, label: { en: "Marketing", fr: "Marketing" }, to: "/services/marketing" },
      { icon: Share2, label: { en: "Social media", fr: "Réseaux sociaux" }, to: "/services/social-media" },
      { icon: MapPin, label: { en: "Local visibility", fr: "Visibilité locale" }, to: "/services/local-listings" },
      { icon: Target, label: { en: "Lead generation", fr: "Génération de prospects" }, to: "/services/lead-generation" },
    ],
    beats: [
      { label: { en: "Campaign prepared", fr: "Campagne préparée" }, status: "building" },
      { label: { en: "Content scheduled", fr: "Contenu planifié" }, status: "campaignActive" },
      { label: { en: "Local listings active", fr: "Fiches locales actives" }, status: "live" },
      { label: { en: "Visitor reaches your form", fr: "Un visiteur atteint votre formulaire" }, status: "connecting" },
      { label: { en: "New opportunity", fr: "Nouvelle occasion" }, status: "newOpportunity" },
    ],
    primary: { label: { en: "Build my growth system", fr: "Créer mon système de croissance" }, to: "/marketplace/post-project" },
    secondary: { label: { en: "Explore marketing services", fr: "Explorer les services marketing" }, to: "/services/marketing" },
  },
  {
    key: "operate",
    kicker: { en: "Stage 03 — Operate", fr: "Étape 03 — Opérer" },
    headline: { en: "Connect the systems that keep your business moving.", fr: "Connectez les systèmes qui font avancer votre entreprise." },
    outcome: {
      en: "Calls, workflows, AI tools and administration handled inside one workspace.",
      fr: "Appels, automatisations, outils IA et administration réunis dans un seul espace de travail.",
    },
    amount: pricing.voip[0].amount,
    cadence: "monthly",
    services: [
      { icon: PhoneCall, label: { en: "Business phone", fr: "Téléphonie d'affaires" }, to: "/services/voip" },
      { icon: Workflow, label: { en: "Automation", fr: "Automatisation" }, to: "/services/automation" },
      { icon: Bot, label: { en: "AI business tools", fr: "Outils IA d'affaires" }, to: "/services/ai-business-tools" },
      { icon: ClipboardList, label: { en: "Administration", fr: "Administration" }, to: "/services/data-admin" },
    ],
    beats: [
      { label: { en: "Customer call received", fr: "Appel client reçu" }, status: "connecting" },
      { label: { en: "Call routed to the right person", fr: "Appel acheminé à la bonne personne" }, status: "callRouted" },
      { label: { en: "Workflow triggered", fr: "Automatisation déclenchée" }, status: "building" },
      { label: { en: "Repetitive task completed", fr: "Tâche répétitive terminée" }, status: "workflowCompleted" },
      { label: { en: "Workspace updated", fr: "Espace de travail mis à jour" }, status: "approved" },
    ],
    primary: { label: { en: "Connect my business systems", fr: "Connecter mes systèmes d'entreprise" }, to: "/marketplace/post-project" },
    secondary: { label: { en: "Explore automation", fr: "Explorer l'automatisation" }, to: "/services/automation" },
  },
] as const;