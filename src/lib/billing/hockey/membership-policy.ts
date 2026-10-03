import {
  HOCKEY_MEMBERSHIP_CATALOG,
  isHockeyMembershipPlanCode,
  isHockeySelfServePlanCode,
  type HockeySelfServePlanCode,
} from "./plan-catalog";
import type {
  HockeyMembershipAccess,
  HockeyMembershipPlanCode,
} from "./types";

export const HOCKEY_BILLING_INTERVAL = "week" as const;
export const HOCKEY_SOURCE_APPLICATION = "ahmverdun" as const;

export function hockeyStripePriceEnvKey(
  planCode: HockeySelfServePlanCode,
): string {
  return `STRIPE_PRICE_${planCode.toUpperCase()}`;
}

export function resolveHockeyMembershipAccess(
  status: string | null | undefined,
): HockeyMembershipAccess {
  return status === "active" ||
    status === "past_due" ||
    status === "grace_period"
    ? "paid"
    : "blocked";
}

export function hockeyMembershipAllows(
  input: {
    status?: string | null;
    planCode?: string | null;
  },
  feature: (typeof HOCKEY_MEMBERSHIP_CATALOG)[HockeyMembershipPlanCode]["features"][number],
): boolean {
  if (resolveHockeyMembershipAccess(input.status) !== "paid") {
    return false;
  }

  if (!isHockeyMembershipPlanCode(input.planCode)) {
    return false;
  }

  return HOCKEY_MEMBERSHIP_CATALOG[input.planCode].features.includes(feature);
}

export function validateHockeyCheckoutInput(value: unknown):
  | { success: true; data: { planCode: HockeySelfServePlanCode } }
  | {
      success: false;
      message: string;
      fieldErrors: Record<string, string>;
    } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      success: false,
      message: "Choose an AHMV membership to continue.",
      fieldErrors: { planCode: "Choose an AHMV membership." },
    };
  }

  const candidate = value as Record<string, unknown>;
  const planCode =
    typeof candidate.planCode === "string" ? candidate.planCode.trim() : "";

  if (!isHockeySelfServePlanCode(planCode)) {
    return {
      success: false,
      message: "This AHMV membership is not available for self-serve checkout.",
      fieldErrors: {
        planCode:
          planCode === "hockey_vip_weekly_30"
            ? "AHMV VIP is planned and is not being sold yet."
            : "Choose the available AHMV Member plan.",
      },
    };
  }

  return {
    success: true,
    data: { planCode },
  };
}

export function resolveHockeyCheckoutLive(input: {
  enabled: boolean;
  secretKey: string;
  webhookSecret: string;
  priceId: string;
}): boolean {
  return Boolean(
    input.enabled &&
      input.secretKey.trim() &&
      input.webhookSecret.trim() &&
      input.priceId.trim(),
  );
}
