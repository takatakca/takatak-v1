// French names and prices for the marketplace packages, so French pages never
// show "Online ads setup" or "$249". The package catalog keeps its English
// fields (API parity); this file adds the visitor-facing French words.

import type { MarketplacePackageDetail } from "@/lib/website/marketplace-packages";

type Lang = "fr" | "en";

/** French title of every package in MARKETPLACE_PACKAGES (checked by scripts/concierge-tests.ts). */
export const PACKAGE_TITLE_FR: Record<string, string> = {
  "website-starter": "Site web d'entreprise, forfait de départ",
  "website-restaurant": "Site web de restaurant",
  "landing-page": "Page d'atterrissage qui convertit",
  "ecommerce-shopify": "Boutique en ligne clé en main",
  "booking-website": "Site de réservations et de rendez-vous",
  "website-redesign": "Refonte et accélération de site web",
  "app-ui-prototype": "Prototype d'interface d'appli mobile",
  "customer-app": "Appli mobile pour vos clients",
  "business-dashboard-app": "Appli tableau de bord d'entreprise",
  "marketplace-app": "Appli de place de marché",
  "logo-design": "Logo professionnel",
  "brand-identity-kit": "Trousse d'image de marque",
  "business-card-design": "Cartes d'affaires",
  "social-brand-kit": "Trousse de marque pour les réseaux sociaux",
  "online-ads-setup": "Mise en place de publicité en ligne",
  "google-ads-campaign": "Campagne Google Ads",
  "meta-ads": "Publicité Facebook et Instagram",
  "email-marketing-setup": "Mise en place du marketing par courriel",
  "social-content-pack": "Forfait de contenu pour les réseaux sociaux",
  "monthly-posting": "Publications mensuelles sur les réseaux sociaux",
  "reels-video-plan": "Plan de contenu Reels et Shorts",
  "profile-optimization": "Optimisation des profils sociaux",
  "local-seo-setup": "Référencement local",
  "qmaps-listing-setup": "Fiche locale QMAPS",
  "gbp-optimization": "Optimisation de votre fiche Google",
  "citation-package": "Inscriptions dans les annuaires locaux",
  "flexs-lead-campaign": "Campagne de prospects FLEXS",
  "lead-funnel": "Tunnel de prospects",
  "contact-form-automation": "Formulaire de contact automatisé",
  "crm-lead-routing": "Répartition des prospects dans le CRM",
  "data-entry": "Saisie et nettoyage de données",
  "spreadsheet-cleanup": "Nettoyage de tableurs et formules",
  "product-upload": "Ajout de produits en boutique en ligne",
  "menu-data-entry": "Saisie de menu de restaurant",
  "menu-design": "Conception de menu de restaurant",
  "flyer-design": "Conception de dépliant",
  "poster-design": "Conception d'affiche",
  "digital-ad-banner": "Bannières publicitaires numériques",
  "ai-chatbot-setup": "Mise en place d'un agent conversationnel IA",
  "automation-setup": "Automatisation d'entreprise",
  "workflow-automation": "Automatisation des processus internes",
  "ai-intake-form": "Formulaire d'accueil IA",
  "voip-business-phone": "Téléphonie d'affaires",
  "voip-call-routing": "Acheminement d'appels et menu vocal",
  "voip-sms-voice-workflow": "Flux textos et appels",
  "website-copywriting": "Rédaction de site web",
};

export function packageTitle(p: Pick<MarketplacePackageDetail, "id" | "title">, lang: Lang): string {
  return lang === "fr" ? (PACKAGE_TITLE_FR[p.id] ?? p.title) : p.title;
}

/** "249 $" in French (Québec style, non-breaking space), "$249" in English. */
export function formatCad(cents: number, lang: Lang): string {
  const n = Math.round(cents / 100).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 0 });
  return lang === "fr" ? `${n} $` : `$${n}`;
}

/** "dès 249 $" / "from $249", from the cheapest tier. */
export function startingPrice(p: Pick<MarketplacePackageDetail, "tiers">, lang: Lang): string {
  const cents = Math.min(...p.tiers.map((t) => t.priceCents));
  return `${lang === "fr" ? "dès" : "from"} ${formatCad(cents, lang)}`;
}

/** "Livré en 2 jours" / "2-day delivery", from the fastest tier. */
export function fastestDelivery(p: Pick<MarketplacePackageDetail, "tiers">, lang: Lang): string {
  const d = Math.min(...p.tiers.map((t) => t.deliveryDays));
  if (lang === "fr") return d <= 1 ? "Livré en 1 jour" : `Livré en ${d} jours`;
  return d <= 1 ? "1-day delivery" : `${d}-day delivery`;
}
