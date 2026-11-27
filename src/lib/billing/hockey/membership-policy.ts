import type { HockeyMembershipAccess } from "./types";

export const HOCKEY_SOURCE_APPLICATION = "ahmverdun" as const;

/** Server variable holding the Stripe Price ID of the AHMV Member plan (CAD 10/week). */
export const HOCKEY_MEMBER_PRICE_ENV = "STRIPE_PRICE_HOCKEY_MEMBER_WEEKLY_10" as const;

const MEMBER_PLAN_CODES = new Set(["hockey_member_weekly_10", "parent_essential"]);
const VIP_PLAN_CODES = new Set(["hockey_vip_weekly_30", "parent_premium"]);
const STRIPE_PRICE_ID = /^price_[A-Za-z0-9]{6,}$/;

/**
 * The Stripe Price used for a self-serve AHMV plan.
 *
 * AHMV Member: the server variable STRIPE_PRICE_HOCKEY_MEMBER_WEEKLY_10 when it
 * is set (the owner's live price), otherwise the Product Catalog's Stripe price.
 * A variable that is set but malformed fails closed. AHMV VIP (CAD 30/week) is
 * planned and not for sale: it never gets a price. The amount, currency and
 * cadence always come from the Product Catalog, and checkout verifies the
 * Stripe Price against them before opening.
 */
export function resolveHockeyStripePriceId(input: {
  planCode: string;
  legacyCode: string | null;
  catalogProvider: string | null;
  catalogPriceId: string | null;
  memberPriceId: string;
}): string | null {
  const codes = [input.planCode, input.legacyCode ?? ""];
  if (codes.some((code) => VIP_PLAN_CODES.has(code))) return null;

  const memberPriceId = input.memberPriceId.trim();
  if (codes.some((code) => MEMBER_PLAN_CODES.has(code)) && memberPriceId) {
    return STRIPE_PRICE_ID.test(memberPriceId) ? memberPriceId : null;
  }

  const catalogPriceId = input.catalogPriceId?.trim() ?? "";
  return input.catalogProvider === "stripe" && STRIPE_PRICE_ID.test(catalogPriceId) ? catalogPriceId : null;
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

export function validateHockeyCheckoutInput(value: unknown):
  | { success: true; data: { planCode: string } }
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

  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(planCode)) {
    return {
      success: false,
      message: "This AHMV membership is not available.",
      fieldErrors: { planCode: "Choose an available AHMV plan." },
    };
  }

  return { success: true, data: { planCode } };
}

export function resolveHockeyCheckoutLive(input: {
  enabled: boolean;
  secretKey: string;
  webhookSecret: string;
}): boolean {
  return Boolean(
    input.enabled &&
      input.secretKey.trim() &&
      input.webhookSecret.trim(),
  );
}
