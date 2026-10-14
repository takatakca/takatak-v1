/**
 * Highest pre-click cumulative spend that may still accept one full CPC bid.
 * A null bound fails closed: record the genuine event, never increase spend.
 */
export function maxCpcSpendBeforeClick(
  budgetCents: number,
  bidCents: number | null,
): number | null {
  if (
    !Number.isSafeInteger(budgetCents) ||
    budgetCents <= 0 ||
    bidCents === null ||
    !Number.isSafeInteger(bidCents) ||
    bidCents <= 0 ||
    bidCents > budgetCents
  ) {
    return null;
  }
  return budgetCents - bidCents;
}
