// Public website request validation (domain requests, project requests).
//
// Pure module: no database, no network. Every field is whitelisted,
// trimmed and length-bounded; unknown fields are ignored. A hidden honeypot
// field ("website") must stay empty.

export type WebsiteRequestKind = "domain_request" | "project_request";

export interface WebsiteRequestInput {
  kind: WebsiteRequestKind;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  language: "en" | "fr";
  sourcePage: string | null;
  domain: { fqdn: string; tld: string } | null;
  project: {
    title: string;
    category: string | null;
    budgetCents: number | null;
    timeline: string | null;
  } | null;
}

export type WebsiteRequestValidation =
  | { ok: true; value: WebsiteRequestInput; honeypot: boolean }
  | { ok: false; fieldErrors: Record<string, string> };

const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,24}$/i;
const PHONE_RE = /^[+()0-9 .-]{7,40}$/;
const FQDN_RE = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const TLD_RE = /^[a-z]{2,24}$/;
const SLUG_RE = /^[a-z0-9_-]{1,80}$/;
const MAX_BUDGET_DOLLARS = 10_000_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Trim, collapse control characters and bound a free-text value. */
function text(
  value: unknown,
  max: number,
  errors: Record<string, string>,
  field: string,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    errors[field] = "invalid";
    return null;
  }
  const cleaned = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (!cleaned) return null;
  if (cleaned.length > max) {
    errors[field] = "too_long";
    return null;
  }
  return cleaned;
}

export function validateWebsiteRequest(raw: unknown): WebsiteRequestValidation {
  const errors: Record<string, string> = {};
  if (!isObject(raw)) return { ok: false, fieldErrors: { body: "invalid" } };

  const kind = raw.kind;
  if (kind !== "domain_request" && kind !== "project_request") {
    return { ok: false, fieldErrors: { kind: "invalid" } };
  }

  const honeypot = typeof raw.website === "string" && raw.website.trim() !== "";

  const name = text(raw.name, 120, errors, "name");
  const company = text(raw.company, 160, errors, "company");
  const message = text(raw.message, 4000, errors, "message");

  const emailRaw = text(raw.email, 254, errors, "email");
  const email = emailRaw ? emailRaw.toLowerCase() : null;
  if (email && !EMAIL_RE.test(email)) errors.email = "invalid";

  const phone = text(raw.phone, 40, errors, "phone");
  if (phone && !PHONE_RE.test(phone)) errors.phone = "invalid";

  const language = raw.language === "fr" ? "fr" : "en";

  let sourcePage = text(raw.sourcePage, 200, errors, "sourcePage");
  if (sourcePage && (!sourcePage.startsWith("/") || sourcePage.startsWith("//"))) {
    sourcePage = null;
  }

  let domain: WebsiteRequestInput["domain"] = null;
  let project: WebsiteRequestInput["project"] = null;

  if (kind === "domain_request") {
    const fqdn = (text(raw.domain, 253, errors, "domain") ?? "").toLowerCase();
    const tld = (text(raw.tld, 24, errors, "tld") ?? "").toLowerCase().replace(/^\./, "");
    if (!FQDN_RE.test(fqdn) || fqdn.includes("..")) errors.domain = "invalid";
    if (!TLD_RE.test(tld) || !fqdn.endsWith(`.${tld}`)) errors.tld = "invalid";
    domain = { fqdn, tld };
  } else {
    const title = text(raw.title, 160, errors, "title");
    if (!title) errors.title = errors.title ?? "required";
    const categoryRaw = text(raw.category, 80, errors, "category");
    const category = categoryRaw && SLUG_RE.test(categoryRaw) ? categoryRaw : null;
    const timelineRaw = text(raw.timeline, 80, errors, "timeline");
    const timeline = timelineRaw && SLUG_RE.test(timelineRaw) ? timelineRaw : null;

    let budgetCents: number | null = null;
    const budgetRaw = text(raw.budget, 12, errors, "budget");
    if (budgetRaw) {
      const dollars = Number(budgetRaw.replace(/[\s,$]/g, ""));
      if (!Number.isFinite(dollars) || dollars < 0 || dollars > MAX_BUDGET_DOLLARS) {
        errors.budget = "invalid";
      } else {
        budgetCents = Math.round(dollars * 100);
      }
    }
    project = { title: title ?? "", category, budgetCents, timeline };
  }

  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };

  return {
    ok: true,
    honeypot,
    value: {
      kind,
      name,
      email,
      phone,
      company,
      message,
      language,
      sourcePage,
      domain,
      project,
    },
  };
}

/** A request is only actionable when someone can be contacted back. */
export function hasContact(value: Pick<WebsiteRequestInput, "email" | "phone">): boolean {
  return Boolean(value.email || value.phone);
}
