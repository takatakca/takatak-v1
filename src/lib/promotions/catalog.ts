// Server catalog for public TAKATAK promotion codes.
// Amounts are computed here. The browser may preview a code only after this
// catalog accepts it, and checkout repeats the same quote.

import { seasonalAround } from "./seasons";

export type KnownPromo = {
  code: string;
  percentOff: number;
  /**
   * Optional end of a time-limited campaign (ISO 8601 with offset). After it,
   * the code stops existing everywhere (preview, claim, checkout), so the
   * countdown shown on the site is always true.
   */
  endsAt?: string;
  /** Optional start (ISO 8601 with offset): before it, the code does not exist yet. */
  startsAt?: string;
  /** Landing-page headline for a campaign (/offres/<code>), e.g. { fr: "Black Friday", en: "Black Friday" }. */
  title?: { fr: string; en: string };
};

export type LiveCampaign = KnownPromo & { endsAt: string };

// To run a time-limited campaign, add it here with its end date, e.g.
//   BF2026: { code: "BF2026", percentOff: 15, endsAt: "2026-11-27T23:59:59-05:00",
//             title: { fr: "Black Friday", en: "Black Friday" } },
// The homepage shows a live countdown to `endsAt` (GET /api/promotions/active),
// and /offres/<code> becomes the campaign's landing page until `endsAt`.
// Seasonal campaigns (Black Friday, Boxing Day, Fête des Mères…) are added
// automatically every year by ./seasons.ts, at 5, 7 or 10 %.
const KNOWN: Record<string, KnownPromo> = {
  FIRST10: { code: "FIRST10", percentOff: 10 },
};

/** Owner's rule: paying a monthly service 12 months in advance is always 15 % off. */
export const ANNUAL_PREPAY_PERCENT = 15;

/** A year of a monthly price, paid in advance, in whole cents. */
export function annualPrepayQuote(monthlyCents: number): { fullCents: number; discountCents: number; totalCents: number; percentOff: number } {
  const monthly = Number.isInteger(monthlyCents) && monthlyCents >= 0 ? monthlyCents : 0;
  const fullCents = monthly * 12;
  const discountCents = Math.round(fullCents * (ANNUAL_PREPAY_PERCENT / 100));
  return { fullCents, discountCents, totalCents: fullCents - discountCents, percentOff: ANNUAL_PREPAY_PERCENT };
}

export function isPromoLive(promo: KnownPromo, now: Date = new Date()): boolean {
  if (promo.startsAt) {
    const start = Date.parse(promo.startsAt);
    if (!Number.isFinite(start) || now.getTime() < start) return false;
  }
  if (!promo.endsAt) return true;
  const end = Date.parse(promo.endsAt);
  return Number.isFinite(end) && now.getTime() < end;
}

/** Every promotion that can exist around this date: the fixed ones and the seasonal calendar. */
function allPromos(now: Date): KnownPromo[] {
  return [
    ...Object.values(KNOWN),
    ...seasonalAround(now).map((c) => ({ code: c.code, percentOff: c.percentOff, startsAt: c.startsAt, endsAt: c.endsAt, title: c.title })),
  ];
}

export function normalizePromoCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,40}$/.test(code)) return null;
  return code;
}

export function lookupPromo(code: string | null, now: Date = new Date()): KnownPromo | null {
  if (!code) return null;
  const promo = allPromos(now).find((p) => p.code === code);
  return promo && isPromoLive(promo, now) ? promo : null;
}

export function listAvailablePromos(now: Date = new Date()): KnownPromo[] {
  return allPromos(now).filter((promo) => isPromoLive(promo, now));
}

/** Time-limited campaigns still running, soonest end first (public: no account data). */
export function listActiveCampaigns(now: Date = new Date()): LiveCampaign[] {
  return allPromos(now)
    .filter((promo): promo is LiveCampaign => Boolean(promo.endsAt) && isPromoLive(promo, now))
    .sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt));
}

/** Whole cents. Matches the marketplace preview (`Math.round(subtotal * 0.1)`). */
export function quotePromo(
  subtotalCents: number,
  code: string | null,
): {
  code: string | null;
  percentOff: number;
  discountCents: number;
  totalCents: number;
} {
  const safeSubtotal =
    Number.isInteger(subtotalCents) && subtotalCents >= 0 ? subtotalCents : 0;
  const known = lookupPromo(normalizePromoCode(code));
  if (!known) {
    return {
      code: null,
      percentOff: 0,
      discountCents: 0,
      totalCents: safeSubtotal,
    };
  }
  const discountCents = Math.round(safeSubtotal * (known.percentOff / 100));
  return {
    code: known.code,
    percentOff: known.percentOff,
    discountCents,
    totalCents: Math.max(0, safeSubtotal - discountCents),
  };
}

export function isValidSubtotalCents(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 100_000_000
  );
}
