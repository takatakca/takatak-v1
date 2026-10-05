import {
  AHMV_LEGACY_PLAN_CODES,
  type AhmvLegacyPlanCode,
} from "./types";

/**
 * Compatibility aliases only. Commercial configuration (price, cadence,
 * entitlements, availability) lives in the database Product Catalog.
 */
export const AHMV_LEGACY_PLAN_ALIASES: Record<
  AhmvLegacyPlanCode,
  { canonicalPlanCode: string }
> = {
  hockey_member_weekly_10: { canonicalPlanCode: "parent_essential" },
  hockey_vip_weekly_30: { canonicalPlanCode: "parent_premium" },
};

export function isAhmvLegacyPlanCode(
  value: string | null | undefined,
): value is AhmvLegacyPlanCode {
  return Boolean(
    value && (AHMV_LEGACY_PLAN_CODES as readonly string[]).includes(value),
  );
}
