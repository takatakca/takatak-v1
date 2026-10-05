export const AHMV_CANONICAL_PLAN_CODES = [
  "parent_essential",
  "parent_premium",
] as const;

export type AhmvCanonicalPlanCode =
  (typeof AHMV_CANONICAL_PLAN_CODES)[number];

export const AHMV_LEGACY_PLAN_CODES = [
  "hockey_member_weekly_10",
  "hockey_vip_weekly_30",
] as const;

export type AhmvLegacyPlanCode =
  (typeof AHMV_LEGACY_PLAN_CODES)[number];

export type HockeyMembershipAccess = "paid" | "blocked";
