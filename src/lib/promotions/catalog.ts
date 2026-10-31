// Server catalog for public TAKATAK promotion codes.
// Amounts are computed here. The browser may preview a code only after this
// catalog accepts it, and checkout repeats the same quote.

export type KnownPromo = {
  code: string;
  percentOff: number;
  /**
   * Optional end of a time-limited campaign (ISO 8601 with offset). After it,
   * the code stops existing everywhere (preview, claim, checkout), so the
   * countdown shown on the site is always true.
   */
  endsAt?: string;
};

// To run a time-limited campaign, add it here with its end date, e.g.
//   FALL5: { code: "FALL5", percentOff: 5, endsAt: "2026-11-15T23:59:59-05:00" },
// The homepage shows a live countdown to `endsAt` (GET /api/promotions/active).
const KNOWN: Record<string, KnownPromo> = {
  FIRST10: { code: "FIRST10", percentOff: 10 },
};

export function isPromoLive(promo: KnownPromo, now: Date = new Date()): boolean {
  if (!promo.endsAt) return true;
  const end = Date.parse(promo.endsAt);
  return Number.isFinite(end) && now.getTime() < end;
}

export function normalizePromoCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,40}$/.test(code)) return null;
  return code;
}

export function lookupPromo(code: string | null, now: Date = new Date()): KnownPromo | null {
  if (!code) return null;
  const promo = KNOWN[code];
  return promo && isPromoLive(promo, now) ? promo : null;
}

export function listAvailablePromos(now: Date = new Date()): KnownPromo[] {
  return Object.values(KNOWN).filter((promo) => isPromoLive(promo, now));
}

/** Time-limited campaigns still running, soonest end first (public: no account data). */
export function listActiveCampaigns(now: Date = new Date()): Array<Required<KnownPromo>> {
  return Object.values(KNOWN)
    .filter((promo): promo is Required<KnownPromo> => Boolean(promo.endsAt) && isPromoLive(promo, now))
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
