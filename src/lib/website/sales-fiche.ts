// The sales assistant fills a request form from the conversation: it asks one
// question at a time, writes each answer in the form next to the chat, asks
// for confirmation, then sends one project request (the same intake as the
// site's forms). Pure: the panel renders it and posts the payload.

type Lang = "fr" | "en";
type Bi = Record<Lang, string>;

export type FicheField = "name" | "email" | "phone" | "company";
export type FicheStep = FicheField | "confirm";
export type Fiche = Record<FicheField, string>;

export const FICHE_ORDER: FicheField[] = ["name", "company", "email", "phone"];

export const FICHE_LABELS: Record<FicheField, Bi> = {
  name: { fr: "Nom", en: "Name" },
  company: { fr: "Entreprise", en: "Business" },
  email: { fr: "Courriel", en: "Email" },
  phone: { fr: "Téléphone", en: "Phone" },
};

const QUESTIONS: Record<FicheField, Bi> = {
  name: { fr: "Parfait. Je prépare votre demande. C'est quoi votre nom ?", en: "Great. I'm preparing your request. What's your name?" },
  company: { fr: "Merci {name}. Le nom de votre entreprise ?", en: "Thanks {name}. Your business name?" },
  email: { fr: "Votre courriel, pour vous envoyer la soumission ?", en: "Your email, to send you the quote?" },
  phone: { fr: "Un numéro pour vous joindre ? (ou écrivez « passer »)", en: "A number to reach you? (or type “skip”)" },
};

export const FICHE_CONFIRM: Bi = { fr: "Voici votre fiche. Tout est bon ?", en: "Here is your form. Is everything right?" };
export const FICHE_BAD_EMAIL: Bi = { fr: "Ce courriel ne semble pas valide. Pouvez-vous le réécrire ?", en: "That email doesn't look valid. Could you type it again?" };
export const FICHE_BAD_PHONE: Bi = { fr: "Ce numéro ne semble pas valide. Réessayez, ou écrivez « passer ».", en: "That number doesn't look valid. Try again, or type “skip”." };

const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,24}$/i;
const PHONE_RE = /^[+()0-9 .-]{7,40}$/;
const SKIP = /^(passer|non|skip|no|-)$/i;

export function emptyFiche(): Fiche {
  return { name: "", company: "", email: "", phone: "" };
}

export function question(field: FicheField, fiche: Fiche, lang: Lang): string {
  return QUESTIONS[field][lang].replace("{name}", fiche.name.split(" ")[0] || "");
}

/** Takes one answer. Returns the next step, or an error message for the same step. */
export function answer(
  step: FicheField,
  raw: string,
  fiche: Fiche,
): { ok: true; fiche: Fiche; next: FicheStep } | { ok: false; error: Bi } {
  const value = raw.replace(/\s+/g, " ").trim().slice(0, step === "email" ? 254 : 120);
  let stored = value;
  if (step === "email") {
    if (!EMAIL_RE.test(value)) return { ok: false, error: FICHE_BAD_EMAIL };
    stored = value.toLowerCase();
  }
  if (step === "phone") {
    if (SKIP.test(value)) stored = "";
    else if (!PHONE_RE.test(value)) return { ok: false, error: FICHE_BAD_PHONE };
  }
  if ((step === "name" || step === "company") && !value) return { ok: false, error: { fr: "Je n'ai rien reçu, pouvez-vous réessayer ?", en: "I got nothing, could you try again?" } };
  const next = { ...fiche, [step]: stored };
  const i = FICHE_ORDER.indexOf(step);
  return { ok: true, fiche: next, next: i + 1 < FICHE_ORDER.length ? FICHE_ORDER[i + 1] : "confirm" };
}

/** The request sent to /api/public/website-requests (prices are resolved server-side, never sent). */
export function fichePayload(fiche: Fiche, input: { services: string[]; conversation: string[]; lang: Lang }) {
  const list = input.services.length ? input.services.join(", ") : input.lang === "fr" ? "à préciser" : "to be confirmed";
  return {
    kind: "project_request" as const,
    title: `${input.lang === "fr" ? "Demande de l'assistant ventes" : "Sales assistant request"} · ${list}`.slice(0, 160),
    category: "sales-assistant",
    name: fiche.name || undefined,
    company: fiche.company || undefined,
    email: fiche.email || undefined,
    phone: fiche.phone || undefined,
    message: [
      `${input.lang === "fr" ? "Services" : "Services"}: ${list}`,
      "",
      ...input.conversation.slice(-12),
    ]
      .join("\n")
      .slice(0, 3_900),
    language: input.lang,
    sourcePage: "/",
  };
}
