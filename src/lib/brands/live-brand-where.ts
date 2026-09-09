/**
 * Brands that Social and billing treat as live (count toward the plan).
 * `frozen` is plan-parked. `archived` is gone from operations.
 */
export const LIVE_BRAND_STATUSES = ["draft", "active", "paused"] as const;

export type LiveBrandStatus = (typeof LIVE_BRAND_STATUSES)[number];

export function isLiveBrandStatus(status: string): boolean {
  return (LIVE_BRAND_STATUSES as readonly string[]).includes(status);
}

export function isFrozenBrandStatus(status: string): boolean {
  return status === "frozen";
}

/** Prisma `where.status` for Social operations and the brand switcher. */
export function liveBrandStatusWhere(): {
  notIn: ["archived", "frozen"];
} {
  return {
    notIn: ["archived", "frozen"],
  };
}
