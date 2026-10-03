import {
  HOCKEY_MEMBERSHIP_PLAN_CODES,
  type HockeyMembershipEntitlements,
  type HockeyMembershipPlanCode,
} from "./types";

export const HOCKEY_MEMBERSHIP_CATALOG: Record<
  HockeyMembershipPlanCode,
  HockeyMembershipEntitlements
> = {
  hockey_member_weekly_10: {
    planCode: "hockey_member_weekly_10",
    planName: "AHMV Member",
    displayWeeklyCad: 10,
    launchState: "pilot",
    selfServeEligible: true,
    features: [
      "ad_free",
      "ai_assistant",
      "game_reminders",
      "calendar_sync",
      "smart_departure",
      "family_sync",
      "team_community",
      "parent_messaging",
      "parent_rideshare",
    ],
  },
  hockey_vip_weekly_30: {
    planCode: "hockey_vip_weekly_30",
    planName: "AHMV VIP",
    displayWeeklyCad: 30,
    launchState: "planned",
    selfServeEligible: false,
    features: [
      "ad_free",
      "ai_assistant",
      "game_reminders",
      "calendar_sync",
      "smart_departure",
      "family_sync",
      "team_community",
      "parent_messaging",
      "parent_rideshare",
      "tournament_travel",
      "family_live_coordination",
    ],
  },
};

export const HOCKEY_SELF_SERVE_PLAN_CODES = [
  "hockey_member_weekly_10",
] as const;

export type HockeySelfServePlanCode =
  (typeof HOCKEY_SELF_SERVE_PLAN_CODES)[number];

export function isHockeyMembershipPlanCode(
  value: string | null | undefined,
): value is HockeyMembershipPlanCode {
  return Boolean(
    value &&
      (HOCKEY_MEMBERSHIP_PLAN_CODES as readonly string[]).includes(value),
  );
}

export function isHockeySelfServePlanCode(
  value: string | null | undefined,
): value is HockeySelfServePlanCode {
  return Boolean(
    value &&
      (HOCKEY_SELF_SERVE_PLAN_CODES as readonly string[]).includes(value),
  );
}

export function hockeyPlanHasFeature(
  planCode: HockeyMembershipPlanCode,
  feature: HockeyMembershipEntitlements["features"][number],
): boolean {
  return HOCKEY_MEMBERSHIP_CATALOG[planCode].features.includes(feature);
}
