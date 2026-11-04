// The plan a visitor builds on takatak.ca (homepage plan builder, order
// funnel) used to stay in the browser after sign-up. On the first dashboard
// visit it is sent once, through the public intake, as a Lead in the TAKATAK
// agency inbox, tied to the signed-in account (the server takes the email
// from the session). Pure: the dashboard component sends it and remembers it.

import { CORE_CATEGORIES, type CategoryKey } from "./core-categories";

type Lang = "en" | "fr";

export const PLAN_SENT_KEY = "takatak:plan-sent";

const NAMES: Record<CategoryKey, Record<Lang, string>> = {
  website: { fr: "Site web", en: "Website" },
  domains: { fr: "Domaines", en: "Domains" },
  hosting: { fr: "Hébergement", en: "Hosting" },
  marketing: { fr: "Marketing et publicité", en: "Marketing & ads" },
  social: { fr: "Médias sociaux", en: "Social media" },
  local: { fr: "Fiches locales", en: "Local listings" },
  reviews: { fr: "Avis et réputation", en: "Reviews & reputation" },
  ai: { fr: "AI Studio", en: "AI Studio" },
  billing: { fr: "Facturation", en: "Billing & invoicing" },
  voip: { fr: "Téléphonie d'affaires", en: "Business phone" },
};

export function serviceNames(keys: readonly CategoryKey[], lang: Lang): string[] {
  return CORE_CATEGORIES.filter((c) => keys.includes(c.key)).map((c) => NAMES[c.key][lang]);
}

/** Same plan + same code = same signature: it is sent once, not on every visit. */
export function planSignature(keys: readonly CategoryKey[], promo: string | null): string {
  return `${[...new Set(keys)].sort().join(",")}|${promo ?? ""}`;
}

const CODE_RE = /^[A-Z0-9]{2,40}$/;

/** The project request sent to /api/public/website-requests (no prices: the team quotes from the catalog). */
export function planHandoffPayload(keys: readonly CategoryKey[], promo: string | null, lang: Lang) {
  const names = serviceNames(keys, lang);
  const code = promo && CODE_RE.test(promo) ? promo : null;
  return {
    kind: "project_request" as const,
    title: `${lang === "fr" ? "Forfait choisi sur takatak.ca" : "Plan picked on takatak.ca"} · ${names.join(", ")}`.slice(0, 160),
    category: "homepage-plan",
    message: [
      `${lang === "fr" ? "Services" : "Services"}: ${names.join(", ")}`,
      ...(code ? [`${lang === "fr" ? "Code promo" : "Promo code"}: ${code}`] : []),
      lang === "fr"
        ? "Compte créé sur takatak.ca après avoir bâti ce forfait."
        : "Account created on takatak.ca after building this plan.",
    ].join("\n"),
    language: lang,
    sourcePage: "/register",
  };
}
