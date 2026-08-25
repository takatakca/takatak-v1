import {
  Globe, Server, Monitor, Megaphone, UserPlus, PhoneCall, Workflow, LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import type { StatusKey } from "@/components/website/motion/AnimatedStatus";

export interface EcosystemNodeData {
  key: string;
  icon: LucideIcon;
  /** Position inside the 720x520 scene space. */
  x: number;
  y: number;
  label: { en: string; fr: string };
  detail: { en: string; fr: string };
  /** Short explanation shown on hover / focus / tap (max ~20 words). */
  explain: { en: string; fr: string };
  /** Status before and after this node activates in the story. */
  idleStatus: StatusKey;
  activeStatus: StatusKey;
  to: string;
}

/** The connected TAKATAK business journey, in story order. */
export const ECOSYSTEM_NODES: readonly EcosystemNodeData[] = [
  {
    key: "domain",
    icon: Globe,
    x: 115, y: 60,
    label: { en: "Domain", fr: "Domaine" },
    detail: { en: "yourbusiness.ca · .com", fr: "votreentreprise.ca · .com" },
    explain: { en: "Search and secure the .ca or .com name your business will be known by.", fr: "Trouvez et réservez le nom .ca ou .com de votre entreprise." },
    idleStatus: "checking", activeStatus: "available",
    to: "/domain",
  },
  {
    key: "hosting",
    icon: Server,
    x: 370, y: 48,
    label: { en: "Hosting", fr: "Hébergement" },
    detail: { en: "SSL · Backups · Email", fr: "SSL · Sauvegardes · Courriel" },
    explain: { en: "Managed Canadian hosting with SSL, daily backups and business email ready to go.", fr: "Hébergement géré au Canada avec SSL, sauvegardes et courriel d'affaires." },
    idleStatus: "connecting", activeStatus: "secured",
    to: "/hosting",
  },
  {
    key: "website",
    icon: Monitor,
    x: 596, y: 92,
    label: { en: "Website", fr: "Site web" },
    detail: { en: "Desktop · Mobile · Contact form", fr: "Bureau · Mobile · Formulaire" },
    explain: { en: "A designed, mobile-ready site reviewed by our team before it goes live.", fr: "Un site conçu et adapté au mobile, révisé par notre équipe avant la mise en ligne." },
    idleStatus: "building", activeStatus: "live",
    to: "/services/websites",
  },
  {
    key: "marketing",
    icon: Megaphone,
    x: 596, y: 250,
    label: { en: "Marketing", fr: "Marketing" },
    detail: { en: "Campaigns · Local reach", fr: "Campagnes · Visibilité" },
    explain: { en: "Campaigns and local visibility that bring the right people to your new site.", fr: "Campagnes et visibilité locale qui amènent les bonnes personnes vers votre site." },
    idleStatus: "connecting", activeStatus: "campaignActive",
    to: "/services/marketing",
  },
  {
    key: "lead",
    icon: UserPlus,
    x: 375, y: 235,
    label: { en: "Customer inquiry", fr: "Demande client" },
    detail: { en: "Source: website form", fr: "Source : formulaire du site" },
    explain: { en: "Every inquiry lands in one place with its source, ready to follow up.", fr: "Chaque demande arrive au même endroit, avec sa source, prête pour le suivi." },
    idleStatus: "connecting", activeStatus: "newOpportunity",
    to: "/services/lead-generation",
  },
  {
    key: "voip",
    icon: PhoneCall,
    x: 118, y: 268,
    label: { en: "Business phone", fr: "Téléphonie" },
    detail: { en: "Smart routing · Voicemail text", fr: "Routage · Messagerie texte" },
    explain: { en: "Calls route to the right person, with voicemail turned into readable text.", fr: "Les appels sont acheminés à la bonne personne, avec messagerie transcrite." },
    idleStatus: "connecting", activeStatus: "callRouted",
    to: "/services/voip",
  },
  {
    key: "automation",
    icon: Workflow,
    x: 200, y: 440,
    label: { en: "Automation", fr: "Automatisation" },
    detail: { en: "Trigger → steps → notification", fr: "Déclencheur → étapes → alerte" },
    explain: { en: "Repetitive steps run on their own and notify your team when they finish.", fr: "Les étapes répétitives s'exécutent seules et avertissent votre équipe." },
    idleStatus: "connecting", activeStatus: "workflowCompleted",
    to: "/services/automation",
  },
  {
    key: "workspace",
    icon: LayoutDashboard,
    x: 520, y: 445,
    label: { en: "TAKATAK workspace", fr: "Espace TAKATAK" },
    detail: { en: "Progress · Approvals", fr: "Progrès · Approbations" },
    explain: { en: "One secure workspace for progress, approvals and bilingual support.", fr: "Un espace sécurisé pour le progrès, les approbations et le soutien bilingue." },
    idleStatus: "awaitingApproval", activeStatus: "approved",
    to: "/register",
  },
];
