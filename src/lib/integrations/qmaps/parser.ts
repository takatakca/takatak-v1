// QMAPS event contract v1 (QMAPS is the source of truth for its businesses
// and reviews). Strict whitelist: only the fields below are read; payloads
// carrying credentials or reviewer identity are rejected.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FORBIDDEN_KEYS = new Set([
  "password", "passwordhash", "otp", "otpcode", "session", "sessiontoken",
  "accesstoken", "refreshtoken", "authorization", "cookie", "servicerolekey",
  "stripesecretkey", "clientsecret", "cardnumber", "cvc", "cvv",
  // Reviewer identity stays inside QMAPS.
  "userid", "reviewerid", "reviewemail", "revieweremail", "reviewerphone",
  "owneruserid",
]);

export type QmapsBusiness = {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  avgRating: number;
  reviewsCount: number;
  isActive: boolean;
  isClaimed: boolean;
};

export type QmapsReview = {
  id: string;
  businessId: string;
  rating: number;
  body: string | null;
  reviewerDisplayName: string | null;
  createdAt: string;
};

type Envelope = {
  eventId: string;
  sourceApplication: "QMAPS";
  occurredAt: string;
};

export type QmapsEvent =
  | (Envelope & { eventType: "BUSINESS_UPSERTED"; business: QmapsBusiness })
  | (Envelope & { eventType: "REVIEW_UPSERTED"; review: QmapsReview })
  | (Envelope & { eventType: "REVIEW_DELETED"; review: { id: string; businessId: string } });

export type QmapsParseResult =
  | { valid: true; event: QmapsEvent }
  | { valid: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function containsForbiddenField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenField);
  if (!isObject(value)) return false;
  return Object.entries(value).some(
    ([key, nested]) =>
      FORBIDDEN_KEYS.has(key.toLowerCase().replace(/[^a-z0-9]/g, "")) ||
      containsForbiddenField(nested),
  );
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= max ? trimmed : undefined;
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && !Number.isNaN(Date.parse(value));
}

function parseBusiness(raw: unknown): QmapsBusiness | null {
  if (!isObject(raw) || typeof raw.id !== "string" || !UUID_RE.test(raw.id)) return null;
  const name = optionalText(raw.name, 200);
  if (!name) return null;
  const fields = {
    category: optionalText(raw.category, 120),
    phone: optionalText(raw.phone, 40),
    website: optionalText(raw.website, 500),
    address: optionalText(raw.address, 300),
    city: optionalText(raw.city, 120),
    region: optionalText(raw.region, 120),
    postalCode: optionalText(raw.postalCode, 20),
    country: optionalText(raw.country, 60),
  };
  if (Object.values(fields).some((value) => value === undefined)) return null;
  const avgRating = raw.avgRating;
  const reviewsCount = raw.reviewsCount;
  if (
    typeof avgRating !== "number" || !Number.isFinite(avgRating) ||
    avgRating < 0 || avgRating > 5 ||
    !Number.isSafeInteger(reviewsCount) || (reviewsCount as number) < 0 ||
    typeof raw.isActive !== "boolean" || typeof raw.isClaimed !== "boolean"
  ) {
    return null;
  }
  return {
    id: raw.id.toLowerCase(),
    name,
    ...(fields as { [K in keyof typeof fields]: string | null }),
    avgRating: Math.round(avgRating * 100) / 100,
    reviewsCount: reviewsCount as number,
    isActive: raw.isActive,
    isClaimed: raw.isClaimed,
  };
}

function parseReview(raw: unknown): QmapsReview | null {
  if (
    !isObject(raw) ||
    typeof raw.id !== "string" || !UUID_RE.test(raw.id) ||
    typeof raw.businessId !== "string" || !UUID_RE.test(raw.businessId) ||
    !Number.isInteger(raw.rating) || (raw.rating as number) < 1 || (raw.rating as number) > 5 ||
    !isDate(raw.createdAt)
  ) {
    return null;
  }
  const body = optionalText(raw.body, 5000);
  const reviewerDisplayName = optionalText(raw.reviewerDisplayName, 80);
  if (body === undefined || reviewerDisplayName === undefined) return null;
  return {
    id: raw.id.toLowerCase(),
    businessId: raw.businessId.toLowerCase(),
    rating: raw.rating as number,
    body,
    reviewerDisplayName,
    createdAt: raw.createdAt,
  };
}

export function parseQmapsEvent(rawBody: string): QmapsParseResult {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { valid: false, error: "Invalid JSON body." };
  }
  if (!isObject(body)) return { valid: false, error: "Body must be a JSON object." };
  if (containsForbiddenField(body)) {
    return { valid: false, error: "Payload contains a forbidden field." };
  }
  if (
    typeof body.eventId !== "string" || !UUID_RE.test(body.eventId) ||
    body.sourceApplication !== "QMAPS" ||
    body.schemaVersion !== 1 ||
    !isDate(body.occurredAt)
  ) {
    return { valid: false, error: "Required event fields are invalid." };
  }
  const envelope: Envelope = {
    eventId: body.eventId.toLowerCase(),
    sourceApplication: "QMAPS",
    occurredAt: body.occurredAt as string,
  };

  switch (body.eventType) {
    case "BUSINESS_UPSERTED": {
      const business = parseBusiness(body.business);
      return business
        ? { valid: true, event: { ...envelope, eventType: "BUSINESS_UPSERTED", business } }
        : { valid: false, error: "Business payload is invalid." };
    }
    case "REVIEW_UPSERTED": {
      const review = parseReview(body.review);
      return review
        ? { valid: true, event: { ...envelope, eventType: "REVIEW_UPSERTED", review } }
        : { valid: false, error: "Review payload is invalid." };
    }
    case "REVIEW_DELETED": {
      const raw = body.review;
      if (
        isObject(raw) &&
        typeof raw.id === "string" && UUID_RE.test(raw.id) &&
        typeof raw.businessId === "string" && UUID_RE.test(raw.businessId)
      ) {
        return {
          valid: true,
          event: {
            ...envelope,
            eventType: "REVIEW_DELETED",
            review: { id: raw.id.toLowerCase(), businessId: raw.businessId.toLowerCase() },
          },
        };
      }
      return { valid: false, error: "Review payload is invalid." };
    }
    default:
      return { valid: false, error: "Unsupported event type." };
  }
}
