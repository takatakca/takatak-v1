// Reputation — pure input validation (no I/O; safe for QA scripts).

export const REVIEW_CHANNELS = ["link", "qr", "sms", "whatsapp", "email"] as const;
export type ReviewChannelKey = (typeof REVIEW_CHANNELS)[number];

export const FEEDBACK_STATUSES = ["new", "acknowledged", "resolved"] as const;
export type FeedbackStatusKey = (typeof FEEDBACK_STATUSES)[number];

export const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;
export const PUBLIC_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;

const EMAIL_PATTERN = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[A-Za-z]{2,24}$/;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\u0000/g, "").trim() : "";
}

function optionalText(value: unknown, max: number): string | null {
  const v = text(value).replace(/\s+/g, " ");
  return v ? v.slice(0, max) : null;
}

export function googleReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

export function isSafeFacebookReviewUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      /^(www\.|m\.)?facebook\.com$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

export interface ReviewProfileInput {
  name: string;
  googlePlaceId: string | null;
  facebookReviewUrl: string | null;
  thankYouMessage: string | null;
  businessBrandId: string | null;
}

export function parseReviewProfileInput(raw: Record<string, unknown>): Parsed<ReviewProfileInput> {
  const name = optionalText(raw.name, 80);
  if (!name || name.length < 2) return { ok: false, error: "Enter the business name customers know." };

  const placeId = optionalText(raw.googlePlaceId, 200);
  if (placeId && !PLACE_ID_PATTERN.test(placeId)) {
    return { ok: false, error: "That Google Place ID does not look right. It usually starts with “ChIJ”." };
  }

  const facebook = optionalText(raw.facebookReviewUrl, 300);
  if (facebook && !isSafeFacebookReviewUrl(facebook)) {
    return { ok: false, error: "The Facebook review link must be an https://facebook.com address." };
  }

  if (!placeId && !facebook) {
    return { ok: false, error: "Add a Google Place ID or a Facebook review link so customers have somewhere to post." };
  }

  const brand = optionalText(raw.businessBrandId, 64);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (brand && !uuid.test(brand)) return { ok: false, error: "Invalid brand." };

  return {
    ok: true,
    value: {
      name,
      googlePlaceId: placeId,
      facebookReviewUrl: facebook,
      thankYouMessage: optionalText(raw.thankYouMessage, 280),
      businessBrandId: brand,
    },
  };
}

export interface PublicRatingInput {
  rating: number;
  feedback: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  followUpConsent: boolean;
}

export function parsePublicRatingInput(raw: Record<string, unknown>): Parsed<PublicRatingInput> {
  const rating = Number(text(raw.rating));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Choose a rating from 1 to 5 stars." };
  }

  const feedbackRaw = text(raw.feedback);
  const feedback = feedbackRaw ? feedbackRaw.slice(0, 2000) : null;

  const contactEmail = optionalText(raw.contactEmail, 254);
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
    return { ok: false, error: "That email address does not look right." };
  }

  const phoneRaw = optionalText(raw.contactPhone, 32);
  const phoneDigits = phoneRaw ? phoneRaw.replace(/\D/g, "") : "";
  if (phoneRaw && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
    return { ok: false, error: "Enter a phone number with 10 to 15 digits." };
  }

  const consent = raw.followUpConsent === "on" || raw.followUpConsent === "true" || raw.followUpConsent === true;
  const hasContact = Boolean(contactEmail || phoneDigits);

  return {
    ok: true,
    value: {
      rating,
      feedback,
      contactName: optionalText(raw.contactName, 80),
      // Contact details are only kept when the customer explicitly asks to be contacted.
      contactEmail: consent ? contactEmail : null,
      contactPhone: consent && phoneDigits ? `+${phoneDigits}` : null,
      followUpConsent: consent && hasContact,
    },
  };
}

export function parseReviewChannel(value: unknown): ReviewChannelKey {
  const v = text(value);
  return (REVIEW_CHANNELS as readonly string[]).includes(v) ? (v as ReviewChannelKey) : "link";
}

export function parseFeedbackStatus(value: unknown): FeedbackStatusKey | null {
  const v = text(value);
  return (FEEDBACK_STATUSES as readonly string[]).includes(v) ? (v as FeedbackStatusKey) : null;
}

export function slugBase(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base.length >= 2 ? base : "review";
}
