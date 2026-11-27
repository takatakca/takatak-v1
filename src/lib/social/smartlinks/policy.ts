// SmartLinks: one public page per brand with buttons to the brand's links
// (link in bio), counted per day. Pure rules shared by the API, the public page
// and the tests: slugs, button links, limits and statuses. No I/O here.

export const SMARTLINK_LIMITS = {
  title: 80,
  bio: 240,
  label: 60,
  url: 2048,
  buttons: 20,
  slugMin: 3,
  slugMax: 40,
} as const;

export type SmartLinkStatus = "draft" | "published";

export const SMARTLINK_STATUSES: readonly SmartLinkStatus[] = ["draft", "published"];

/** Words that would collide with site routes or look official. */
const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "auth", "dashboard", "help", "login", "logout", "new", "oauth",
  "register", "settings", "signup", "support", "takatak", "www",
]);

/** Lower-case letters, digits and single dashes; 3–40 characters. */
export function normalizeSmartLinkSlug(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const slug = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug.length < SMARTLINK_LIMITS.slugMin || slug.length > SMARTLINK_LIMITS.slugMax) return null;
  if (RESERVED_SLUGS.has(slug)) return null;
  return slug;
}

/** Only absolute http(s) links; never javascript:, data: or links with credentials. */
export function normalizeSmartLinkUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > SMARTLINK_LIMITS.url) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".")) return null;
  return url.toString();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanText(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export interface SmartLinkButtonInput {
  /** Existing button id when editing, so its click history is kept. */
  id: string | null;
  label: string;
  url: string;
}

export interface SmartLinkInput {
  slug: string;
  title: string;
  bio: string;
  buttons: SmartLinkButtonInput[];
}

export type SmartLinkValidation =
  | { ok: true; value: SmartLinkInput }
  | { ok: false; field: "slug" | "title" | "bio" | "buttons"; message: string; messageFr: string };

/** Checks a full SmartLink from the editor. Buttons keep the order they were sent in. */
export function validateSmartLinkInput(raw: unknown): SmartLinkValidation {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const slug = normalizeSmartLinkSlug(body.slug);
  if (!slug) {
    return {
      ok: false,
      field: "slug",
      message: "Choose an address of 3 to 40 letters, digits or dashes.",
      messageFr: "Choisissez une adresse de 3 à 40 lettres, chiffres ou tirets.",
    };
  }
  const title = cleanText(body.title, SMARTLINK_LIMITS.title);
  if (!title) {
    return { ok: false, field: "title", message: "Add a title.", messageFr: "Ajoutez un titre." };
  }
  const bio = cleanText(body.bio, SMARTLINK_LIMITS.bio);
  const rawButtons = Array.isArray(body.buttons) ? body.buttons : [];
  if (rawButtons.length > SMARTLINK_LIMITS.buttons) {
    return {
      ok: false,
      field: "buttons",
      message: `At most ${SMARTLINK_LIMITS.buttons} buttons.`,
      messageFr: `Au plus ${SMARTLINK_LIMITS.buttons} boutons.`,
    };
  }
  const buttons: SmartLinkButtonInput[] = [];
  for (const item of rawButtons) {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const label = cleanText(row.label, SMARTLINK_LIMITS.label);
    const url = normalizeSmartLinkUrl(row.url);
    if (!label || !url) {
      return {
        ok: false,
        field: "buttons",
        message: "Each button needs a label and a full link starting with https://.",
        messageFr: "Chaque bouton doit avoir un libellé et un lien complet qui commence par https://.",
      };
    }
    const id = typeof row.id === "string" && UUID.test(row.id) ? row.id : null;
    buttons.push({ id, label, url });
  }
  return { ok: true, value: { slug, title, bio, buttons } };
}

export function isSmartLinkStatus(value: unknown): value is SmartLinkStatus {
  return value === "draft" || value === "published";
}

/** A page can be published only with at least one button. */
export function canPublishSmartLink(buttonCount: number): boolean {
  return buttonCount > 0;
}

/** Calendar day (UTC) used for the daily counters. */
export function smartLinkStatDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Key of a counter row: the page itself, or one button. */
export function smartLinkStatKey(buttonId: string | null): string {
  return buttonId ? `button:${buttonId}` : "page";
}
