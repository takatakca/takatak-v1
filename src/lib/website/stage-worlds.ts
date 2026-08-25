import { formatCAD, pricing } from "@/lib/website/pricing";
import type { Bilingual } from "@/lib/website/transformation-stages";

export type StageKey = "launch" | "grow" | "operate";

export interface StageLink {
  label: Bilingual;
  to: string;
  /** Absolute product URLs open in a new tab. */
  external?: boolean;
}

export interface StageWorld {
  key: StageKey;
  index: number;
  /** Environmental background word. */
  word: Bilingual;
  name: Bilingual;
  eyebrow: Bilingual;
  headline: Bilingual;
  support: Bilingual;
  signals: readonly Bilingual[];
  /** Number of choreography beats in the scene story. */
  beats: number;
  primary: StageLink;
  secondary: StageLink;
  /** Contextual, crawlable product links shown under the scene. */
  contextual: readonly StageLink[];
  /** Short workspace continuity caption. */
  workspace: Bilingual;
}

const money = (amount: number, suffixEn: string, suffixFr: string): Bilingual => ({
  en: `${formatCAD(amount)}${suffixEn}`,
  fr: `${formatCAD(amount)}${suffixFr}`,
});

export const STAGE_WORLDS: readonly StageWorld[] = [
  {
    key: "launch",
    index: 0,
    word: { en: "LAUNCH", fr: "LANCER" },
    name: { en: "Launch", fr: "Lancer" },
    eyebrow: { en: "Digital foundation", fr: "Fondation numérique" },
    headline: {
      en: "Build the foundation customers expect.",
      fr: "Bâtissez la fondation que vos clients attendent.",
    },
    support: {
      en: "Domain, hosting, website and professional infrastructure — connected from the beginning.",
      fr: "Domaine, hébergement, site web et infrastructure professionnelle — connectés dès le départ.",
    },
    signals: [
      {
        en: `Domain from ${formatCAD(pricing.domain.register.amount)}/year`,
        fr: `Domaine à partir de ${formatCAD(pricing.domain.register.amount)}/an`,
      },
      {
        en: `Hosting from ${formatCAD(pricing.hosting[0].amount)}/month`,
        fr: `Hébergement à partir de ${formatCAD(pricing.hosting[0].amount)}/mois`,
      },
      {
        en: `Website from ${formatCAD(pricing.websites[0].amount)}`,
        fr: `Site web à partir de ${formatCAD(pricing.websites[0].amount)}`,
      },
    ],
    beats: 6,
    primary: { label: { en: "Launch my business online", fr: "Lancer mon entreprise en ligne" }, to: "/marketplace/post-project" },
    secondary: { label: { en: "Explore domains & hosting", fr: "Explorer domaines et hébergement" }, to: "/hosting" },
    contextual: [
      { label: { en: "Domain", fr: "Domaine" }, to: "/domain" },
      { label: { en: "Hosting", fr: "Hébergement" }, to: "/hosting" },
      { label: { en: "Website", fr: "Site web" }, to: "/services/websites" },
    ],
    workspace: { en: "Setup", fr: "Configuration" },
  },
  {
    key: "grow",
    index: 1,
    word: { en: "GROW", fr: "CROÎTRE" },
    name: { en: "Grow", fr: "Croître" },
    eyebrow: { en: "Customer growth", fr: "Croissance client" },
    headline: {
      en: "Get found. Turn attention into opportunity.",
      fr: "Soyez trouvé. Transformez l'attention en occasions.",
    },
    support: {
      en: "Connect marketing, local visibility and lead generation around one customer journey.",
      fr: "Reliez marketing, visibilité locale et génération de prospects autour d'un seul parcours client.",
    },
    signals: [
      {
        en: `Marketing from ${formatCAD(pricing.marketing[0].amount)}`,
        fr: `Marketing à partir de ${formatCAD(pricing.marketing[0].amount)}`,
      },
      {
        en: `Local visibility from ${formatCAD(pricing.local[0].amount)}`,
        fr: `Visibilité locale à partir de ${formatCAD(pricing.local[0].amount)}`,
      },
      money(pricing.leads[1].amount, "/qualified lead", "/prospect qualifié"),
    ],
    beats: 6,
    primary: { label: { en: "Build my growth system", fr: "Créer mon système de croissance" }, to: "/marketplace/post-project" },
    secondary: { label: { en: "Explore QMAPS & FLEXS", fr: "Explorer QMAPS et FLEXS" }, to: "/services/local-listings" },
    contextual: [
      { label: { en: "Marketing", fr: "Marketing" }, to: "/services/marketing" },
      { label: { en: "QMAPS", fr: "QMAPS" }, to: "https://qmaps.ca/", external: true },
      { label: { en: "FLEXS", fr: "FLEXS" }, to: "https://flexs.ca/", external: true },
    ],
    workspace: { en: "Opportunities", fr: "Occasions" },
  },
  {
    key: "operate",
    index: 2,
    word: { en: "OPERATE", fr: "OPÉRER" },
    name: { en: "Operate", fr: "Opérer" },
    eyebrow: { en: "Connected operations", fr: "Opérations connectées" },
    headline: {
      en: "Connect the systems behind your business.",
      fr: "Connectez les systèmes derrière votre entreprise.",
    },
    support: {
      en: "Professional communications, automation and business tools working together.",
      fr: "Communications professionnelles, automatisation et outils d'affaires qui travaillent ensemble.",
    },
    signals: [
      money(pricing.voip[0].amount, "/month VoIP", "/mois téléphonie"),
      {
        en: `Automation from ${formatCAD(pricing.ai[0].amount)}`,
        fr: `Automatisation à partir de ${formatCAD(pricing.ai[0].amount)}`,
      },
      {
        en: `AI tools from ${formatCAD(pricing.ai[1].amount)}`,
        fr: `Outils IA à partir de ${formatCAD(pricing.ai[1].amount)}`,
      },
    ],
    beats: 6,
    primary: { label: { en: "Connect my business systems", fr: "Connecter mes systèmes d'entreprise" }, to: "/marketplace/post-project" },
    secondary: { label: { en: "Explore automation", fr: "Explorer l'automatisation" }, to: "/services/automation" },
    contextual: [
      { label: { en: "VoIP", fr: "Téléphonie" }, to: "/services/voip" },
      { label: { en: "Automation", fr: "Automatisation" }, to: "/services/automation" },
      { label: { en: "AI tools", fr: "Outils IA" }, to: "/services/ai-business-tools" },
    ],
    workspace: { en: "Operations", fr: "Opérations" },
  },
] as const;