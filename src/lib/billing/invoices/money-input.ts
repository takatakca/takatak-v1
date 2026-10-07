// GROUPE TAKATAK Billing — exact parsing of human money/rate inputs.
// Pure module. Decimal strings are split, never parsed as floating point.

/** "12.5" -> 1250 cents. Accepts "." or "," as the decimal separator. */
export function dollarsToCents(value: string): number | null {
  const match = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(value.trim());

  if (!match) {
    return null;
  }

  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** "9.975" -> 9975 milli-percent (the Facturations rate unit). */
export function percentToMilliPercent(value: string): number | null {
  const match = /^(\d{1,3})(?:[.,](\d{1,3}))?$/.exec(value.trim());

  if (!match) {
    return null;
  }

  return Number(match[1]) * 1000 + Number((match[2] ?? "").padEnd(3, "0"));
}
