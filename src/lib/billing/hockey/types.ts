export const HOCKEY_MEMBERSHIP_PLAN_CODES = [
  "hockey_member_weekly_10",
  "hockey_vip_weekly_30",
] as const;

export type HockeyMembershipPlanCode =
  (typeof HOCKEY_MEMBERSHIP_PLAN_CODES)[number];

export const HOCKEY_MEMBERSHIP_FEATURES = [
  "ad_free",
  "ai_assistant",
  "game_reminders",
  "smart_departure",
  "calendar_sync",
  "team_community",
  "parent_messaging",
  "parent_rideshare",
  "tournament_travel",
  "family_live_coordination",
] as const;

export type HockeyMembershipFeature =
  (typeof HOCKEY_MEMBERSHIP_FEATURES)[number];

export type HockeyMembershipEntitlements = {
  planCode: HockeyMembershipPlanCode;
  planName: string;
  displayWeeklyCad: number;
  features: readonly HockeyMembershipFeature[];
  selfServeEligible: boolean;
  launchState: "pilot" | "planned";
};

export type HockeyMembershipAccess =
  | "paid"
  | "blocked";
