import type {
  R2FLeadRequest,
  R2FMarket,
  R2FNeedType,
  R2FPropertyType,
  R2FUrgency,
} from "./types";

const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,24}$/i;
const PHONE_RE = /^[+()0-9 .-]{7,40}$/;
const POSTAL_RE = /^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/i;
const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{8,160}$/;

const NEEDS = new Set<R2FNeedType>([
  "problem",
  "emergency",
  "project",
  "maintenance",
  "service",
]);
const MARKETS = new Set<R2FMarket>(["residential", "commercial"]);
const PROPERTIES = new Set<R2FPropertyType>([
  "house",
  "condo",
  "duplex_triplex",
  "rental_building",
  "commercial",
  "other",
]);
const URGENCIES = new Set<R2FUrgency>(["urgent", "days", "weeks", "planning"]);

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(
  value: unknown,
  max: number,
  required = false,
): string | null | undefined {
  if (value == null || value === "") {
    return required ? undefined : null;
  }
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (!cleaned || cleaned.length > max) {
    return required ? undefined : cleaned ? undefined : null;
  }
  return cleaned;
}

export type R2FValidationResult =
  | { ok: true; value: R2FLeadRequest }
  | { ok: false; fieldErrors: Record<string, string> };

export function validateR2FLeadRequest(raw: unknown): R2FValidationResult {
  const errors: Record<string, string> = {};
  const root = object(raw);
  if (!root) return { ok: false, fieldErrors: { body: "invalid" } };

  if (root.version !== 1) errors.version = "invalid";

  const requestId = text(root.requestId, 160, true);
  if (!requestId || !REQUEST_ID_RE.test(requestId)) {
    errors.requestId = "invalid";
  }

  const contactRaw = object(root.contact);
  const projectRaw = object(root.project);
  const attributionRaw = object(root.attribution) ?? {};
  const consentRaw = object(root.consent);

  if (!contactRaw) errors.contact = "required";
  if (!projectRaw) errors.project = "required";
  if (!consentRaw) errors.consent = "required";

  const firstName = text(contactRaw?.firstName, 80, true);
  const lastName = text(contactRaw?.lastName, 80, true);
  if (!firstName) errors.firstName = "required";
  if (!lastName) errors.lastName = "required";

  const emailRaw = text(contactRaw?.email, 254);
  const email = typeof emailRaw === "string" ? emailRaw.toLowerCase() : null;
  if (email && !EMAIL_RE.test(email)) errors.email = "invalid";

  const phoneRaw = text(contactRaw?.phone, 40);
  const phone = typeof phoneRaw === "string" ? phoneRaw : null;
  if (phone && !PHONE_RE.test(phone)) errors.phone = "invalid";
  if (!email && !phone) errors.contactMethod = "required";

  const preferredLanguage =
    contactRaw?.preferredLanguage === "en" ? "en" :
    contactRaw?.preferredLanguage === "fr" ? "fr" : null;
  if (!preferredLanguage) errors.preferredLanguage = "invalid";

  const needType = projectRaw?.needType as R2FNeedType;
  if (!NEEDS.has(needType)) errors.needType = "invalid";

  const serviceCategory = text(projectRaw?.serviceCategory, 120, true);
  if (!serviceCategory) errors.serviceCategory = "required";

  const serviceSubcategory = text(projectRaw?.serviceSubcategory, 120);
  const problemType = text(projectRaw?.problemType, 160);

  const market = projectRaw?.market as R2FMarket;
  if (!MARKETS.has(market)) errors.market = "invalid";

  const propertyType = projectRaw?.propertyType as R2FPropertyType;
  if (!PROPERTIES.has(propertyType)) errors.propertyType = "invalid";

  const urgency = projectRaw?.urgency as R2FUrgency;
  if (!URGENCIES.has(urgency)) errors.urgency = "invalid";

  const city = text(projectRaw?.city, 120, true);
  if (!city) errors.city = "required";

  const postalRaw = text(projectRaw?.postalCode, 12, true);
  const postalCode = postalRaw?.toUpperCase() ?? "";
  if (!POSTAL_RE.test(postalCode)) errors.postalCode = "invalid";

  const description = text(projectRaw?.description, 4000, true);
  if (!description || description.length < 4) errors.description = "required";

  let budgetCents: number | null = null;
  if (projectRaw?.budgetCents != null) {
    if (
      typeof projectRaw.budgetCents !== "number" ||
      !Number.isInteger(projectRaw.budgetCents) ||
      projectRaw.budgetCents < 0 ||
      projectRaw.budgetCents > 1_000_000_000
    ) {
      errors.budgetCents = "invalid";
    } else {
      budgetCents = projectRaw.budgetCents;
    }
  }

  if (consentRaw?.contact !== true) errors.contactConsent = "required";
  const marketing = consentRaw?.marketing === true;
  const capturedAtRaw = text(consentRaw?.capturedAt, 50);
  const capturedAt = typeof capturedAtRaw === "string" ? capturedAtRaw : null;
  if (capturedAt && Number.isNaN(Date.parse(capturedAt))) {
    errors.capturedAt = "invalid";
  }

  const attr = (key: string, max = 500) => {
    const value = text(attributionRaw[key], max);
    return typeof value === "string" ? value : null;
  };

  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  return {
    ok: true,
    value: {
      version: 1,
      requestId: requestId!,
      contact: {
        firstName: firstName!,
        lastName: lastName!,
        email,
        phone,
        preferredLanguage: preferredLanguage!,
      },
      project: {
        needType,
        serviceCategory: serviceCategory!,
        serviceSubcategory:
          typeof serviceSubcategory === "string" ? serviceSubcategory : null,
        problemType: typeof problemType === "string" ? problemType : null,
        market,
        propertyType,
        urgency,
        city: city!,
        postalCode,
        description: description!,
        budgetCents,
      },
      attribution: {
        sourcePage: attr("sourcePage", 300),
        referrer: attr("referrer"),
        channel: attr("channel", 100),
        campaign: attr("campaign", 160),
        utmSource: attr("utmSource", 160),
        utmMedium: attr("utmMedium", 160),
        utmCampaign: attr("utmCampaign", 200),
        utmTerm: attr("utmTerm", 200),
        utmContent: attr("utmContent", 200),
        gclid: attr("gclid", 300),
        fbclid: attr("fbclid", 300),
        ttclid: attr("ttclid", 300),
      },
      consent: {
        contact: true,
        marketing,
        capturedAt,
      },
    },
  };
}
