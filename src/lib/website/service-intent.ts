// TAKATAK homepage intent routing. Maps a free-text (typed or spoken)
// request to the best destination route on the site.

export interface IntentMatch {
  /** Destination path, may include a query string. */
  to: string;
  /** Human label describing where we are sending the user. */
  label: string;
  /** French label. */
  labelFr: string;
  /** Matched intent key (analytics). */
  intent: string;
}

interface Rule {
  intent: string;
  label: string;
  labelFr: string;
  to: string | ((q: string) => string);
  keywords: readonly string[];
}

const enc = (q: string) => `/marketplace/search?q=${encodeURIComponent(q)}`;

const rules: readonly Rule[] = [
  {
    intent: "domain",
    label: "Domain search",
    labelFr: "Recherche de domaine",
    to: "/domain",
    keywords: ["domain", "domaine", ".ca", ".com", ".net", ".org", "register name", "domain name", "buy a name", "dns", "nom de domaine", "acheter un nom"],
  },
  {
    intent: "hosting",
    label: "Hosting plans",
    labelFr: "Forfaits d'hébergement",
    to: "/hosting",
    keywords: ["hosting", "hebergement", "hébergement", "heberger", "héberger", "host my", "wordpress hosting", "server", "serveur", "cpanel", "ssl", "vps"],
  },
  {
    intent: "voip",
    label: "Business VoIP",
    labelFr: "Téléphonie VoIP d'affaires",
    to: "/services/voip",
    keywords: ["voip", "phone", "telephone", "téléphone", "calls", "call routing", "ivr", "business number", "sip", "numéro professionnel", "numero de telephone", "appels"],
  },
  {
    intent: "local_visibility",
    label: "QMAPS — Local visibility",
    labelFr: "QMAPS — Visibilité locale",
    to: "/services/local-listings",
    keywords: ["local listing", "google maps", "maps", "qmaps", "directory", "directories", "google business", "local seo", "found locally", "être trouvé", "fiche google", "annuaire", "visibilité locale", "q maps", "qmap", "google listing", "fiche entreprise", "référencement local", "referencement local", "apparaître sur les cartes", "annuaires", "cartes"],
  },
  {
    intent: "leads",
    label: "FLEXS — Lead generation",
    labelFr: "FLEXS — Génération de prospects",
    to: "/services/lead-generation",
    keywords: ["lead", "leads", "more customers", "new clients", "flexs", "prospect", "prospects", "sales pipeline", "plus de clients", "nouveaux clients", "clients potentiels", "flex", "customer opportunities", "opportunities", "génération de prospects", "generation de prospects", "trouver des clients", "occasions d'affaires", "pipeline"],
  },
  {
    intent: "social",
    label: "Social media",
    labelFr: "Médias sociaux",
    to: "/services/social-media",
    keywords: ["social media", "instagram", "facebook", "tiktok", "posts", "metricool", "content calendar", "médias sociaux", "reseaux sociaux", "réseaux sociaux", "publications"],
  },
  {
    intent: "marketing",
    label: "Marketing",
    labelFr: "Marketing",
    to: "/services/marketing",
    keywords: ["marketing", "ads", "advertising", "google ads", "meta ads", "campaign", "seo", "publicité", "publicite", "campagne", "annonces"],
  },
  {
    intent: "automation",
    label: "Automation & AI tools",
    labelFr: "Automatisation et outils IA",
    to: "/services/ai-business-tools",
    keywords: ["automation", "automate", "ai workflow", "ai tool", "ai assistant", "chatbot", "integrations", "zapier", "automatiser", "automatisation", "intelligence artificielle", "assistant ia"],
  },
  {
    intent: "mobile_app",
    label: "Mobile apps",
    labelFr: "Applications mobiles",
    to: enc("mobile app"),
    keywords: ["mobile app", "ios app", "android app", "app store", " app", "application", "appli", "application mobile"],
  },
  {
    intent: "logo",
    label: "Logo & branding",
    labelFr: "Logo et image de marque",
    to: enc("logo"),
    keywords: ["logo", "branding", "brand identity", "brand kit", "visual identity", "image de marque", "identité visuelle", "identite visuelle"],
  },
  {
    intent: "website",
    label: "Website services",
    labelFr: "Services de site web",
    to: (q) => enc(q),
    keywords: ["website", "web site", "site web", "site internet", "landing page", "web page", "online store", "ecommerce", "boutique en ligne", "shop online", "webshop", "page d'atterrissage"],
  },
];

export function resolveIntent(rawQuery: string): IntentMatch {
  const q = rawQuery.trim();
  const lower = ` ${q.toLowerCase()} `;

  for (const rule of rules) {
    if (rule.keywords.some((k) => lower.includes(k))) {
      return {
        to: typeof rule.to === "function" ? rule.to(q) : rule.to,
        label: rule.label,
        labelFr: rule.labelFr,
        intent: rule.intent,
      };
    }
  }

  return {
    to: q ? enc(q) : "/marketplace",
    label: "Marketplace search",
    labelFr: "Recherche dans le marché",
    intent: "unknown",
  };
}

export interface SearchSuggestion {
  label: string;
  query: string;
}

export const searchSuggestions: readonly SearchSuggestion[] = [
  { label: "Search domains", query: "Search a domain name" },
  { label: "Build a website", query: "I need a website for my business" },
  { label: "View hosting", query: "I need hosting for WordPress" },
  { label: "Get leads", query: "I need more local customers" },
  { label: "Create logo", query: "I need a logo" },
  { label: "Start marketing", query: "I need marketing and ads" },
];

export const searchSuggestionsFr: readonly SearchSuggestion[] = [
  { label: "Chercher un domaine", query: "Je veux acheter un nom de domaine" },
  { label: "Créer un site web", query: "J'ai besoin d'un site web pour mon entreprise" },
  { label: "Voir l'hébergement", query: "Je veux un hébergement WordPress" },
  { label: "Trouver des clients", query: "Je veux plus de clients dans ma région" },
  { label: "Créer un logo", query: "J'ai besoin d'un logo" },
  { label: "Automatiser", query: "Je veux automatiser mon entreprise" },
];

/** Language-aware label for a resolved intent. */
export function intentLabel(match: IntentMatch, lang: "en" | "fr"): string {
  return lang === "fr" ? match.labelFr : match.label;
}

/** Fire a dataLayer analytics event; never throws if analytics is absent. */
export function trackEvent(event: string, payload: Record<string, unknown> = {}): void {
  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    if (!w.dataLayer) w.dataLayer = [];
    w.dataLayer.push({ event, ...payload });
  } catch {
    /* analytics is best-effort */
  }
}
