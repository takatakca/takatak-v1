// takatak.ca newsletter: consent wording, sign-up validation and signed links.
//
// Pure module (no database, no network) so it can be tested on its own.
//
// Canada's anti-spam law (CASL) and Québec's Law 25:
// - express consent through its own checkbox, never pre-checked and never
//   bundled with account sign-up, terms or push/SMS permission;
// - the request names who is asking, a mailing address and a contact, its
//   purpose, and says consent can be withdrawn at any time;
// - every message carries the same identification and a working unsubscribe;
// - proof of consent (the exact text shown, when, where) is kept.

import { createHmac, timingSafeEqual } from "node:crypto";

import { NEWSLETTER_TOPICS, type Lang, type NewsletterTopic } from "./topics";

export { NEWSLETTER_TOPICS, TOPIC_LABELS, type Lang, type NewsletterTopic } from "./topics";

/** Bump when the wording below changes: stored with every consent as proof. */
export const CONSENT_VERSION = "2026-10-31.1";

export interface NewsletterSender {
  /** Public business name. */
  name: string;
  /** Mailing address (required by CASL in the request and in every message). */
  address: string;
  email: string;
  web: string;
}

/** The exact sentence next to the checkbox. Stored verbatim as proof. */
export function consentText(lang: Lang, sender: NewsletterSender): string {
  if (lang === "fr") {
    return (
      `J'accepte de recevoir par courriel l'infolettre de ${sender.name} (offres, conseils et nouveaux services). ` +
      `Je peux retirer mon consentement en tout temps avec le lien de désabonnement présent dans chaque courriel ` +
      `ou en écrivant à ${sender.email}. ${sender.name}, ${sender.address}, ${sender.web}.`
    );
  }
  return (
    `I agree to receive the ${sender.name} newsletter by email (offers, tips and new services). ` +
    `I can withdraw my consent at any time with the unsubscribe link in every email ` +
    `or by writing to ${sender.email}. ${sender.name}, ${sender.address}, ${sender.web}.`
  );
}

/** Identification and unsubscribe block for the bottom of every message. */
export function messageFooter(lang: Lang, sender: NewsletterSender, unsubscribeUrl: string): string {
  return lang === "fr"
    ? [
        `Vous recevez ce courriel parce que vous vous êtes abonné à l'infolettre de ${sender.name} sur ${sender.web}.`,
        `Se désabonner : ${unsubscribeUrl}`,
        `${sender.name} · ${sender.address} · ${sender.email}`,
      ].join("\n")
    : [
        `You receive this email because you subscribed to the ${sender.name} newsletter on ${sender.web}.`,
        `Unsubscribe: ${unsubscribeUrl}`,
        `${sender.name} · ${sender.address} · ${sender.email}`,
      ].join("\n");
}

const EMAIL_RE = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[a-z]{2,24}$/i;
const PAGE_RE = /^\/[\w\-./]{0,199}$/;

export interface NewsletterSignup {
  email: string;
  language: Lang;
  topics: NewsletterTopic[];
  sourcePage: string | null;
  /** The consent version the visitor saw (must match the current one). */
  consentVersion: string;
}

export type SignupValidation =
  | { ok: true; value: NewsletterSignup; honeypot: boolean }
  | { ok: false; fieldErrors: Record<string, string> };

/**
 * Whitelists the sign-up body. Consent must be the boolean `true` from the
 * visitor's own click: a missing, string or pre-filled value is refused.
 */
export function validateSignup(raw: unknown): SignupValidation {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) errors.email = "required";
  else if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = "invalid";

  if (body.consent !== true) errors.consent = "required";

  const consentVersion = typeof body.consentVersion === "string" ? body.consentVersion : "";
  if (consentVersion !== CONSENT_VERSION) errors.consentVersion = "stale";

  const language: Lang = body.language === "en" ? "en" : "fr";
  const topics = Array.isArray(body.topics)
    ? NEWSLETTER_TOPICS.filter((t) => (body.topics as unknown[]).includes(t))
    : [];
  const page = typeof body.sourcePage === "string" ? body.sourcePage.trim() : "";
  const sourcePage = PAGE_RE.test(page) ? page : null;
  const honeypot = typeof body.website === "string" && body.website.trim().length > 0;

  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    honeypot,
    value: { email, language, topics: topics.length ? topics : [...NEWSLETTER_TOPICS], sourcePage, consentVersion },
  };
}

// ── Signed links ────────────────────────────────────────────────────────────
// A link carries the subscription id and an HMAC, so confirming or
// unsubscribing needs no login and cannot be forged for someone else.

export type TokenPurpose = "confirm" | "unsubscribe";

/** A confirm link works for 14 days, and only for the sign-up it was sent for. */
export const CONFIRM_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function mac(purpose: TokenPurpose, id: string, stamp: string, secret: string): string {
  return createHmac("sha256", secret).update(`takatak-newsletter:${purpose}:${id}:${stamp}`).digest("base64url").slice(0, 32);
}

/**
 * `stamp` ties a confirm link to one consent (its givenAt). Unsubscribe links
 * carry no stamp: every unsubscribe link ever sent keeps working.
 */
export function signToken(purpose: TokenPurpose, id: string, secret: string, stamp = ""): string {
  return `${b64url(id)}.${b64url(stamp)}.${mac(purpose, id, stamp, secret)}`;
}

/** The subscription id and stamp, or null when the link was altered. */
export function verifyToken(token: unknown, purpose: TokenPurpose, secret: string): { id: string; stamp: string } | null {
  if (typeof token !== "string" || token.length > 300) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[2]) return null;
  let id: string;
  let stamp: string;
  try {
    id = Buffer.from(parts[0], "base64url").toString("utf8");
    stamp = Buffer.from(parts[1], "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!/^[0-9a-f-]{36}$/i.test(id) || stamp.length > 40) return null;
  const expected = Buffer.from(mac(purpose, id, stamp, secret));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { id, stamp };
}

// ── Subscription state, stored with the record ──────────────────────────────

export type SubscriptionStatus = "pending" | "confirmed" | "unsubscribed";

export interface ConsentProof {
  version: string;
  /** Exact text shown next to the checkbox. */
  text: string;
  language: Lang;
  givenAt: string;
  sourcePage: string | null;
  /** Hashed caller address (never the raw IP). */
  sourceHash: string;
  method: "web_form_checkbox";
}

export interface NewsletterState {
  status: SubscriptionStatus;
  topics: NewsletterTopic[];
  /** Every consent given, oldest first (a re-subscription adds one). */
  consents: ConsentProof[];
  confirmedAt: string | null;
  unsubscribedAt: string | null;
}

export function readState(metadata: unknown): NewsletterState | null {
  const meta = (metadata && typeof metadata === "object" ? metadata : {}) as Record<string, unknown>;
  const n = meta.newsletter as Partial<NewsletterState> | undefined;
  if (!n || typeof n !== "object" || !n.status) return null;
  return {
    status: n.status,
    topics: Array.isArray(n.topics) ? n.topics : [],
    consents: Array.isArray(n.consents) ? n.consents : [],
    confirmedAt: n.confirmedAt ?? null,
    unsubscribedAt: n.unsubscribedAt ?? null,
  };
}

/** New consent on a new or existing record. A confirmed subscriber stays confirmed. */
export function withConsent(prev: NewsletterState | null, proof: ConsentProof, topics: NewsletterTopic[]): NewsletterState {
  const keepConfirmed = prev?.status === "confirmed";
  return {
    status: keepConfirmed ? "confirmed" : "pending",
    // A confirmed subscriber only ever gains topics here: anyone can submit an
    // address, so a new sign-up never removes what the person confirmed.
    topics: keepConfirmed ? Array.from(new Set([...(prev?.topics ?? []), ...topics])) : topics,
    consents: [...(prev?.consents ?? []), proof].slice(-20),
    confirmedAt: keepConfirmed ? prev?.confirmedAt ?? null : null,
    unsubscribedAt: null,
  };
}

/** Whether a confirm link stamped `stamp` may confirm this state now. */
export function confirmLinkValid(state: NewsletterState, stamp: string, now: Date): boolean {
  const last = state.consents.at(-1)?.givenAt;
  if (!last || stamp !== last) return false;
  return now.getTime() - Date.parse(last) <= CONFIRM_TTL_MS;
}

export function confirmed(prev: NewsletterState, now: Date): NewsletterState {
  if (prev.status !== "pending") return prev;
  return { ...prev, status: "confirmed", confirmedAt: now.toISOString() };
}

/** Withdrawal takes effect at once; the consent history stays as proof. */
export function unsubscribed(prev: NewsletterState, now: Date): NewsletterState {
  if (prev.status === "unsubscribed") return prev;
  return { ...prev, status: "unsubscribed", unsubscribedAt: now.toISOString() };
}

/** Only confirmed subscribers may be sent the newsletter. */
export function maySend(state: NewsletterState | null): boolean {
  return state?.status === "confirmed";
}

export function confirmationEmail(
  lang: Lang,
  sender: NewsletterSender,
  confirmUrl: string,
  unsubscribeUrl: string,
): { subject: string; text: string } {
  const body =
    lang === "fr"
      ? [
          "Bonjour,",
          "",
          `Merci de votre inscription à l'infolettre de ${sender.name}.`,
          "Pour la confirmer, ouvrez ce lien puis cliquez sur « Confirmer » :",
          confirmUrl,
          "",
          "Si ce n'est pas vous, ignorez ce courriel : vous ne recevrez rien d'autre.",
        ]
      : [
          "Hello,",
          "",
          `Thank you for subscribing to the ${sender.name} newsletter.`,
          "To confirm, open this link and click “Confirm”:",
          confirmUrl,
          "",
          "If this was not you, ignore this email: you will receive nothing else.",
        ];
  return {
    subject: lang === "fr" ? `Confirmez votre inscription · ${sender.name}` : `Confirm your subscription · ${sender.name}`,
    text: [...body, "", "—", messageFooter(lang, sender, unsubscribeUrl)].join("\n"),
  };
}
