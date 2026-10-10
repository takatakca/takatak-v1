// Public website request validation (domain requests, project requests,
// marketplace package orders, hosting plan requests).
//
// Pure module: no database, no network. Every field is whitelisted,
// trimmed and length-bounded; unknown fields are ignored. A hidden honeypot
// field ("website") must stay empty.

import { UPMIND_HOSTING_PLANS } from "@/lib/website/upmind-config";

export type WebsiteRequestKind = "domain_request" | "project_request" | "package_order" | "hosting_request";

/** Hosting plans a visitor can request (the plans sold through Upmind). */
export const HOSTING_PLAN_NAMES: readonly string[] = UPMIND_HOSTING_PLANS.map((plan) => plan.name);

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
  /** Identifiers only; prices are resolved server-side from the catalog. */
  order: {
    packageId: string;
    tierName: string;
    addonLabels: string[];
    promoCode: string | null;
  } | null;
  hosting: { planName: string } | null;
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
  if (
    kind !== "domain_request" &&
    kind !== "project_request" &&
    kind !== "package_order" &&
    kind !== "hosting_request"
  ) {
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
  let order: WebsiteRequestInput["order"] = null;
  let hosting: WebsiteRequestInput["hosting"] = null;

  if (kind === "domain_request") {
    const fqdn = (text(raw.domain, 253, errors, "domain") ?? "").toLowerCase();
    const tld = (text(raw.tld, 24, errors, "tld") ?? "").toLowerCase().replace(/^\./, "");
    if (!FQDN_RE.test(fqdn) || fqdn.includes("..")) errors.domain = "invalid";
    if (!TLD_RE.test(tld) || !fqdn.endsWith(`.${tld}`)) errors.tld = "invalid";
    domain = { fqdn, tld };
  } else if (kind === "hosting_request") {
    const planName = typeof raw.planName === "string" ? raw.planName.trim() : "";
    if (!HOSTING_PLAN_NAMES.includes(planName)) errors.planName = "invalid";
    hosting = { planName };
  } else if (kind === "package_order") {
    const packageId = text(raw.packageId, 120, errors, "packageId");
    if (!packageId || !/^[a-z0-9-]{1,120}$/.test(packageId)) errors.packageId = "invalid";
    const tierName = raw.tierName;
    if (tierName !== "Basic" && tierName !== "Standard" && tierName !== "Premium") errors.tierName = "invalid";
    const addonLabels: string[] = [];
    if (raw.addons !== undefined) {
      if (!Array.isArray(raw.addons) || raw.addons.length > 10) errors.addons = "invalid";
      else {
        for (const label of raw.addons) {
          if (typeof label !== "string" || !label.trim() || label.length > 120) {
            errors.addons = "invalid";
            break;
          }
          addonLabels.push(label.trim());
        }
      }
    }
    const promoRaw = text(raw.promoCode, 40, errors, "promoCode");
    const promoCode = promoRaw && /^[A-Za-z0-9]{2,40}$/.test(promoRaw) ? promoRaw.toUpperCase() : null;
    order = {
      packageId: packageId ?? "",
      tierName: typeof tierName === "string" ? tierName : "",
      addonLabels,
      promoCode,
    };
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
      order,
      hosting,
    },
  };
}

/** A request is only actionable when someone can be contacted back. */
export function hasContact(value: Pick<WebsiteRequestInput, "email" | "phone">): boolean {
  return Boolean(value.email || value.phone);
}
