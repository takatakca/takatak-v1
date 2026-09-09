import {
  invalidRequest,
  isRecord,
  type ValidationResult,
} from "@/lib/validation/common";
import {
  PAID_CHECKOUT_PLAN_CODES,
  SOCIAL_PLAN_CATALOG,
  isPaidCheckoutPlanCode,
  planFamily,
  type PaidCheckoutPlanCode,
} from "./plan-catalog";
import type { SocialPlanCode } from "./types";

export const SOCIAL_BILLING_CYCLES = ["monthly", "annual"] as const;

export type SocialBillingCycle = (typeof SOCIAL_BILLING_CYCLES)[number];

export type SocialStripePlanChange =
  | "checkout"
  | "upgrade"
  | "downgrade"
  | "interval"
  | "noop"
  | "forbidden";

export function isSocialBillingCycle(
  value: string | null | undefined,
): value is SocialBillingCycle {
  return (
    typeof value === "string" &&
    (SOCIAL_BILLING_CYCLES as readonly string[]).includes(value)
  );
}

export function socialStripePriceEnvKey(
  planCode: PaidCheckoutPlanCode,
  cycle: SocialBillingCycle,
): string {
  return `STRIPE_PRICE_${planCode.toUpperCase()}_${cycle.toUpperCase()}`;
}

export function socialStripePriceEnvKeys(): string[] {
  const keys: string[] = [];
  for (const planCode of PAID_CHECKOUT_PLAN_CODES) {
    for (const cycle of SOCIAL_BILLING_CYCLES) {
      keys.push(socialStripePriceEnvKey(planCode, cycle));
    }
  }
  return keys;
}

export function resolveSocialCheckoutLive(input: {
  secretKey: string;
  webhookSecret: string;
  hasPrice: boolean;
}): boolean {
  return Boolean(
    input.secretKey.trim() &&
      input.webhookSecret.trim() &&
      input.hasPrice,
  );
}

export function socialPlanRank(planCode: SocialPlanCode): number {
  const familyRank = {
    free: 0,
    starter: 1,
    advanced: 2,
    custom: 3,
  } as const;

  return (
    familyRank[planFamily(planCode)] * 1000 +
    SOCIAL_PLAN_CATALOG[planCode].brandAllowance
  );
}

/**
 * How to take a workspace from the current plan to a self-serve paid plan.
 * Does not write the database. Checkout from Free stays on Free until the webhook.
 */
export function resolveSocialStripePlanChange(input: {
  currentPlanCode: SocialPlanCode;
  targetPlanCode: string;
  hasStripeSubscription: boolean;
  currentAccess: "paid" | "free" | "blocked";
}): SocialStripePlanChange {
  if (!isPaidCheckoutPlanCode(input.targetPlanCode)) {
    return "forbidden";
  }

  if (
    input.currentPlanCode === input.targetPlanCode &&
    input.hasStripeSubscription &&
    input.currentAccess === "paid"
  ) {
    return "interval";
  }

  if (!input.hasStripeSubscription || input.currentAccess !== "paid") {
    return "checkout";
  }

  const from = socialPlanRank(input.currentPlanCode);
  const to = socialPlanRank(input.targetPlanCode);

  if (to > from) {
    return "upgrade";
  }

  if (to < from) {
    return "downgrade";
  }

  return "noop";
}

export function validateSocialStripeCheckoutInput(value: unknown): ValidationResult<{
  planCode: PaidCheckoutPlanCode;
  billingCycle: SocialBillingCycle;
}> {
  if (!isRecord(value)) {
    return invalidRequest({}, "Choose a Social plan to continue.");
  }

  const fieldErrors: Record<string, string> = {};
  const planCode =
    typeof value.planCode === "string" ? value.planCode.trim() : "";
  const billingCycle =
    typeof value.billingCycle === "string" ? value.billingCycle.trim() : "";

  if (!isPaidCheckoutPlanCode(planCode)) {
    fieldErrors.planCode =
      planCode === "social_custom"
        ? "Custom plans are not self-serve. Talk to us instead."
        : "Choose a Starter or Advanced plan.";
  }

  if (!isSocialBillingCycle(billingCycle)) {
    fieldErrors.billingCycle = "Choose monthly or annual billing.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      message: "This plan cannot be checked out.",
      fieldErrors,
    };
  }

  return {
    success: true,
    data: {
      planCode: planCode as PaidCheckoutPlanCode,
      billingCycle: billingCycle as SocialBillingCycle,
    },
  };
}
