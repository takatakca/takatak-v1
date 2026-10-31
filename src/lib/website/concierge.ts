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

export type ReplyAction = "show_services" | "offer_welcome" | "finalize" | "human" | "ask_goal";

export interface Reply {
  text: Record<Lang, string>;
  services: CategoryKey[];
  actions: ReplyAction[];
}

/**
 * One concierge turn. `offered` says whether the welcome offer was already
 * shown in this conversation (it is shown once, never pushed twice).
 */
export function respond(input: string, offered: boolean): Reply {
  const u = understand(input);
  if (u.intents.includes("human")) {
    return {
      text: { fr: "Bien sûr. Une personne de notre équipe peut prendre le relais dans le clavardage.", en: "Of course. Someone from our team can take over in the chat." },
      services: [],
      actions: ["human"],
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
  return { text: lead, services: services.slice(0, 4), actions };
}
