/** Marketplace browse groups powering the header category rail.
 *  Each group resolves to REAL packages in the local catalog, either by
 *  category slug or by explicit package id. No dead destinations. */
import {
  MARKETPLACE_PACKAGES,
  type MarketplacePackageDetail,
} from "@/lib/website/marketplace-packages";

export interface MarketplaceGroup {
  slug: string;
  label: { en: string; fr: string };
  blurb: { en: string; fr: string };
  /** Category slugs included in this group. */
  categories: string[];
  /** Explicit package ids (curated groups such as Trending). */
  packageIds?: string[];
  /** Related TAKATAK service page for the "explore" action. */
  serviceTo: string;
}

export const MARKETPLACE_GROUPS: MarketplaceGroup[] = [
  {
    slug: "trending",
    label: { en: "Trending", fr: "Tendances" },
    blurb: { en: "Featured by TAKATAK — popular starting points.", fr: "Choisis par TAKATAK — points de départ populaires." },
    categories: [],
    packageIds: [
      "website-starter", "logo-design", "menu-design", "local-seo-setup",
      "social-content-pack", "lead-funnel", "automation-setup", "brand-identity-kit",
    ],
    serviceTo: "/services",
  },
  {
    slug: "graphics-design",
    label: { en: "Graphics & Design", fr: "Graphisme et design" },
    blurb: { en: "Logos, brand kits, menus and print design.", fr: "Logos, image de marque, menus et imprimés." },
    categories: ["logo_design", "branding", "business_card_design", "menu_design", "flyer_design"],
    serviceTo: "/services/logo-branding",
  },
  {
    slug: "programming-tech",
    label: { en: "Programming & Tech", fr: "Programmation et tech" },
    blurb: { en: "Websites, ecommerce, apps and technical setup.", fr: "Sites web, boutiques, applis et configuration technique." },
    categories: ["website_design", "ecommerce_setup", "mobile_app_design", "automation_setup"],
    serviceTo: "/services/websites",
  },
  {
    slug: "digital-marketing",
    label: { en: "Digital Marketing", fr: "Marketing numérique" },
    blurb: { en: "Ads, social, leads and local visibility.", fr: "Publicité, réseaux sociaux, prospects et visibilité locale." },
    categories: ["online_advertising", "social_media_content", "seo_local_visibility"],
    serviceTo: "/services/marketing",
  },
  {
    slug: "writing-translation",
    label: { en: "Writing & Translation", fr: "Rédaction et traduction" },
    blurb: { en: "Business copy and bilingual content.", fr: "Textes d'affaires et contenu bilingue." },
    categories: ["content_writing"],
    serviceTo: "/services/marketplace",
  },
  {
    slug: "video-animation",
    label: { en: "Video & Animation", fr: "Vidéo et animation" },
    blurb: { en: "Short-form video, reels and animated ad creative.", fr: "Vidéo courte, reels et créatifs animés." },
    categories: [],
    packageIds: ["reels-video-plan", "social-content-pack", "monthly-posting", "digital-ad-banner"],
    serviceTo: "/services/social-media",
  },
  {
    slug: "business",
    label: { en: "Business", fr: "Affaires" },
    blurb: { en: "Phone systems, admin support and business workflows.", fr: "Téléphonie, soutien administratif et processus d'affaires." },
    categories: [],
    packageIds: [
      "voip-business-phone", "voip-call-routing", "voip-sms-voice-workflow",
      "crm-lead-routing", "workflow-automation", "data-entry",
    ],
    serviceTo: "/services/voip",
  },
  {
    slug: "ai-services",
    label: { en: "AI Services", fr: "Services IA" },
    blurb: { en: "Assistants, AI intake and workflow automation.", fr: "Assistants, formulaires IA et automatisation." },
    categories: ["ai_tool_setup", "automation_setup"],
    serviceTo: "/services/ai-business-tools",
  },
  {
    slug: "local-visibility",
    label: { en: "Local Visibility", fr: "Visibilité locale" },
    blurb: { en: "QMAPS listings, maps, citations and local SEO.", fr: "Fiches QMAPS, cartes, citations et référencement local." },
    categories: ["seo_local_visibility"],
    serviceTo: "/services/local-listings",
  },
  {
    slug: "data-admin",
    label: { en: "Data & Administration", fr: "Données et administration" },
    blurb: { en: "Data entry, spreadsheet cleanup and admin workflows.", fr: "Saisie de données, nettoyage de tableurs et administration." },
    categories: ["data_entry"],
    serviceTo: "/services/data-admin",
  },
];

export function getMarketplaceGroup(slug: string): MarketplaceGroup | undefined {
  return MARKETPLACE_GROUPS.find((g) => g.slug === slug);
}

/** Resolve the real packages behind a group, curated order first. */
export function groupPackages(slug: string): MarketplacePackageDetail[] {
  const group = getMarketplaceGroup(slug);
  if (!group) return [];
  const byId = group.packageIds
    ? group.packageIds
        .map((id) => MARKETPLACE_PACKAGES.find((p) => p.id === id))
        .filter((p): p is MarketplacePackageDetail => Boolean(p))
    : [];
  const byCategory = MARKETPLACE_PACKAGES.filter((p) => group.categories.includes(p.category));
  const seen = new Set<string>();
  return [...byId, ...byCategory].filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}
