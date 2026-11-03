// TAKATAK's on-page concierge: reads what the visitor typed or said, and
// answers with services from the real catalog only (no generated prices, no
// invented promises). Pure: the panel renders the reply and runs the actions.

import { CORE_CATEGORIES, type CategoryKey } from "./core-categories";
import { BUSINESS_TYPES } from "./home-funnel";

export type Lang = "en" | "fr";

const SERVICE_WORDS: Record<CategoryKey, readonly string[]> = {
  website: ["site", "web", "website", "page", "vitrine", "wordpress", "boutique en ligne", "online store"],
  domains: ["domaine", "domain", ".ca", ".com", "nom de domaine", "url", "adresse web"],
  hosting: ["hebergement", "heberger", "hosting", "host", "serveur", "server", "ssl", "cpanel"],
  marketing: ["pub", "publicite", "ads", "marketing", "google ads", "facebook ads", "campagne", "campaign", "plus de clients", "more customers", "clients"],
  social: ["reseaux", "reseau", "social", "instagram", "facebook", "tiktok", "publication", "posts", "youtube"],
  local: ["google maps", "maps", "fiche", "local", "referencement local", "trouve", "found", "listing", "carte"],
  reviews: ["avis", "review", "reviews", "etoiles", "stars", "reputation"],
  ai: ["ia", "intelligence artificielle", "artificial intelligence", "ai tools", "automatisation", "automation", "chatbot", "tak bot", "takbot"],
  billing: ["facture", "facturation", "invoice", "invoicing", "tps", "tvq", "gst", "qst", "se faire payer", "get paid"],
  voip: ["telephone", "phone", "appel", "calls", "voip", "ligne", "standard"],
};

const BUSINESS_WORDS: Record<string, readonly string[]> = {
  restaurant: ["restaurant", "resto", "cafe", "bistro", "pizzeria", "bar", "traiteur", "food"],
  shop: ["boutique", "magasin", "shop", "store", "commerce", "ecommerce", "vendre en ligne", "sell online"],
  services: ["plombier", "electricien", "renovation", "contracteur", "contractor", "salon", "clinique", "garage", "metier", "trade", "services"],
  startup: ["startup", "createur", "creator", "jeune entreprise", "influenceur", "agence"],
};

const INTENT_WORDS = {
  price: ["prix", "combien", "cout", "tarif", "price", "cost", "how much"],
  order: ["commander", "acheter", "finaliser", "inscrire", "order", "buy", "checkout", "sign up", "start"],
  promo: ["rabais", "promo", "code", "special", "reduction", "discount", "deal", "offre", "offer"],
  human: ["humain", "personne", "appeler", "human", "person", "agent", "call me", "parler a"],
  support: ["probleme", "panne", "fonctionne pas", "marche pas", "bogue", "bug", "erreur", "remboursement", "refund", "broken", "not working", "problem", "plainte", "complaint"],
} as const;

export function normalize(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/** Short words must match a whole word ("ia", "pub"); longer ones may start a word ("site" in "sites"). */
const has = (t: string, words: readonly string[]) => words.some((w) => (w.length < 4 ? t.includes(` ${w} `) : t.includes(` ${w}`)));

export interface Understanding {
  services: CategoryKey[];
  business: string | null;
  intents: Array<keyof typeof INTENT_WORDS>;
}

export function understand(text: string): Understanding {
  const t = normalize(text);
  const services = CORE_CATEGORIES.map((c) => c.key).filter((k) => has(t, SERVICE_WORDS[k]));
  const business = Object.keys(BUSINESS_WORDS).find((b) => has(t, BUSINESS_WORDS[b])) ?? null;
  const intents = (Object.keys(INTENT_WORDS) as Array<keyof typeof INTENT_WORDS>).filter((i) => has(t, INTENT_WORDS[i]));
  return { services, business, intents };
}

/** Typing suggestions: services whose words start with or contain what was typed. */
export function suggest(text: string, limit = 4): CategoryKey[] {
  const t = normalize(text).trim();
  if (t.length < 2) return [];
  const scored = CORE_CATEGORIES.map((c) => {
    const words = SERVICE_WORDS[c.key];
    const score = words.some((w) => w.trim().startsWith(t)) ? 2 : words.some((w) => w.includes(t) || t.includes(w.trim())) ? 1 : 0;
    return { key: c.key, score };
  }).filter((s) => s.score > 0);
  const fromUnderstanding = understand(text).services.map((key) => ({ key, score: 3 }));
  const merged = new Map<CategoryKey, number>();
  for (const s of [...fromUnderstanding, ...scored]) merged.set(s.key, Math.max(merged.get(s.key) ?? 0, s.score));
  return [...merged.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k]) => k);
}

export type ReplyAction = "show_services" | "offer_welcome" | "finalize" | "human" | "ask_goal" | "support";

export interface ReplyLink {
  to: string;
  label: Record<Lang, string>;
}

export interface Reply {
  text: Record<Lang, string>;
  services: CategoryKey[];
  actions: ReplyAction[];
  /** Pages outside the nine core services (marketplace work such as a logo). */
  links?: ReplyLink[];
}

/** The six starting points under TAK-TAK's bar in the hero; each one opens the assistant with its question. */
export const HERO_CHIPS: readonly { key: string; label: Record<Lang, string>; ask: Record<Lang, string> }[] = [
  { key: "domains", label: { fr: "Chercher un domaine", en: "Search domains" }, ask: { fr: "Je cherche un nom de domaine .ca", en: "I want a .ca domain name" } },
  { key: "website", label: { fr: "Créer un site web", en: "Build a website" }, ask: { fr: "J’ai besoin d’un site web pour mon entreprise", en: "I need a website for my business" } },
  { key: "hosting", label: { fr: "Voir l’hébergement", en: "View hosting" }, ask: { fr: "J’ai besoin d’hébergement avec SSL", en: "I need hosting with SSL" } },
  { key: "leads", label: { fr: "Trouver des clients", en: "Get leads" }, ask: { fr: "Je veux plus de clients et être trouvé sur Google Maps", en: "I want more customers and to get found on Google Maps" } },
  { key: "logo", label: { fr: "Créer un logo", en: "Create logo" }, ask: { fr: "J’ai besoin d’un logo", en: "I need a logo" } },
  { key: "marketing", label: { fr: "Lancer le marketing", en: "Start marketing" }, ask: { fr: "Je veux du marketing et de la publicité", en: "I need marketing and ads" } },
];

/** Work sold in the marketplace, not as a core service: the reply points to its real page. */
const MARKETPLACE_ASKS: { words: readonly string[]; link: ReplyLink }[] = [
  {
    words: ["logo", "branding", "image de marque", "identite visuelle", "visual identity", "brand kit"],
    link: { to: "/marketplace/gigs/logo-design", label: { fr: "Voir les forfaits logo", en: "See logo packages" } },
  },
];

/**
 * One concierge turn. `offered` says whether the welcome offer was already
 * shown in this conversation (it is shown once, never pushed twice).
 */
export function respond(input: string, offered: boolean): Reply {
  const u = understand(input);
  // A sales assistant: problems with an existing service go to the support team.
  if (u.intents.includes("support")) {
    return {
      text: {
        fr: "Je suis l’assistant ventes : je vous parle des services, des prix et je prépare votre commande. Pour un problème avec un service que vous avez déjà (téléphone, site, facture), notre équipe de soutien s’en occupe.",
        en: "I’m the sales assistant: I cover services, prices and your order. For a problem with a service you already have (phone, website, invoice), our support team takes care of it.",
      },
      services: [],
      actions: ["support"],
    };
  }
  if (u.intents.includes("human")) {
    return {
      text: { fr: "Bien sûr. Une personne de notre équipe peut prendre le relais dans le clavardage.", en: "Of course. Someone from our team can take over in the chat." },
      services: [],
      actions: ["human"],
    };
  }
  const links = MARKETPLACE_ASKS.filter((m) => has(normalize(input), m.words)).map((m) => m.link);
  if (links.length && !u.services.length) {
    return {
      text: {
        fr: "Les logos sont faits par des designers vérifiés dans notre marketplace. Les forfaits et les vrais prix sont ici :",
        en: "Logos are made by vetted designers in our marketplace. The packages and real prices are here:",
      },
      services: [],
      actions: ["human"],
      links,
    };
  }
  let services = u.services;
  let lead: Record<Lang, string>;
  if (!services.length && u.business) {
    services = [...(BUSINESS_TYPES.find((b) => b.key === u.business)?.base ?? [])];
    const label = BUSINESS_TYPES.find((b) => b.key === u.business)?.label ?? { fr: "votre entreprise", en: "your business" };
    lead = {
      fr: `Pour ${label.fr.toLowerCase()}, voici ce qu’on recommande pour commencer :`,
      en: `For a ${label.en.toLowerCase()}, here is what we recommend to start:`,
    };
  } else if (services.length) {
    lead = { fr: "Voici ce qui correspond à votre demande :", en: "Here is what matches your request:" };
  } else if (u.intents.includes("promo")) {
    lead = { fr: "Voici l’offre en cours pour les nouveaux clients :", en: "Here is the current offer for new clients:" };
  } else if (u.intents.includes("order")) {
    return {
      text: { fr: "Parfait. On passe à la commande : vous choisissez vos forfaits étape par étape.", en: "Great. Let’s order: you pick your tiers step by step." },
      services: [],
      actions: ["finalize"],
    };
  } else {
    return {
      text: {
        fr: "Dites-moi ce que vous voulez faire : un site web, être trouvé sur Google, plus de clients, être payé plus vite…",
        en: "Tell me what you want to do: a website, get found on Google, more customers, get paid faster…",
      },
      services: [],
      actions: ["ask_goal"],
    };
  }
  const actions: ReplyAction[] = [];
  if (services.length) actions.push("show_services");
  if (!offered || u.intents.includes("promo")) actions.push("offer_welcome");
  actions.push("finalize");
  return { text: lead, services: services.slice(0, 4), actions, ...(links.length ? { links } : {}) };
}
