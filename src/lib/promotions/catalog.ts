// Server catalog for public TAKATAK promotion codes.
// Amounts are computed here. The browser may preview a code only after this
// catalog accepts it, and checkout repeats the same quote.

export type KnownPromo = {
  code: string;
  percentOff: number;
};

const KNOWN: Record<string, KnownPromo> = {
  FIRST10: { code: "FIRST10", percentOff: 10 },
};

export function normalizePromoCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,40}$/.test(code)) return null;
  return code;
}

export function lookupPromo(code: string | null): KnownPromo | null {
  if (!code) return null;
  return KNOWN[code] ?? null;
}

export function listAvailablePromos(): KnownPromo[] {
  return Object.values(KNOWN);
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
