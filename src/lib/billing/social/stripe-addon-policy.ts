import {
  invalidRequest,
  isRecord,
  type ValidationResult,
} from "@/lib/validation/common";
import { SOCIAL_X_SLOT_MAX } from "./addon-catalog";
import {
  SOCIAL_ADDON_CODES,
  type SocialAddonCode,
  type SocialEntitlements,
} from "./types";
import type { SocialSubscriptionAccess } from "./subscription-lifecycle";

export const SOCIAL_ADDON_ACTIONS = ["add", "remove"] as const;

export type SocialAddonAction = (typeof SOCIAL_ADDON_ACTIONS)[number];

export type SocialStripeAddonChange =
  | {
      kind: "update_now";
      addonCode: SocialAddonCode;
      xAccountAllowance: number;
      advancedAnalytics: boolean;
    }
  | {
      kind: "schedule_period_end";
      addonCode: SocialAddonCode;
      xAccountAllowance: number;
      advancedAnalytics: boolean;
    }
  | { kind: "forbidden"; message: string }
  | { kind: "conflict"; message: string };

function isAddonCode(value: string): value is SocialAddonCode {
  return (SOCIAL_ADDON_CODES as readonly string[]).includes(value);
}

function isAddonAction(value: string): value is SocialAddonAction {
  return (SOCIAL_ADDON_ACTIONS as readonly string[]).includes(value);
}

export function validateSocialStripeAddonInput(value: unknown): ValidationResult<{
  addonCode: SocialAddonCode;
  action: SocialAddonAction;
}> {
  if (!isRecord(value)) {
    return invalidRequest({}, "Choose an add-on to continue.");
  }

  const fieldErrors: Record<string, string> = {};
  const addonCode =
    typeof value.addonCode === "string" ? value.addonCode.trim() : "";
  const action = typeof value.action === "string" ? value.action.trim() : "";

  if (!isAddonCode(addonCode)) {
    fieldErrors.addonCode = "Choose the X add-on or Advanced Analytics.";
  }

  if (!isAddonAction(action)) {
    fieldErrors.action = "Choose add or remove.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      message: "This add-on request is invalid.",
      fieldErrors,
    };
  }

  return {
    success: true,
    data: {
      addonCode: addonCode as SocialAddonCode,
      action: action as SocialAddonAction,
    },
  };
}

/**
 * Pure: can this paid workspace add or remove an add-on, and when?
 * Does not write the database. Add-ons stay off until the webhook.
 */
export function resolveSocialStripeAddonChange(input: {
  access: SocialSubscriptionAccess;
  entitlements: SocialEntitlements;
  hasStripeSubscription: boolean;
  addonCode: SocialAddonCode;
  action: SocialAddonAction;
}): SocialStripeAddonChange {
  if (input.access !== "paid") {
    return {
      kind: "forbidden",
      message: "Buy a Starter or Advanced plan before adding paid add-ons.",
    };
  }

  if (!input.entitlements.eligibleAddons.includes(input.addonCode)) {
    return {
      kind: "forbidden",
      message: "This add-on is not available on the Free plan.",
    };
  }

  if (!input.hasStripeSubscription) {
    return {
      kind: "forbidden",
      message:
        "Upgrade this workspace through Stripe first, then add X slots or Advanced Analytics.",
    };
  }

  const currentX = input.entitlements.xConnectionAllowance;
  const currentAnalytics = input.entitlements.advancedAnalytics;

  if (input.addonCode === "x_account") {
    if (input.action === "add") {
      const next = currentX + 1;
      if (next > SOCIAL_X_SLOT_MAX) {
        return {
          kind: "conflict",
          message: `This workspace can have at most ${SOCIAL_X_SLOT_MAX} paid X slots.`,
        };
      }

      return {
        kind: "update_now",
        addonCode: "x_account",
        xAccountAllowance: next,
        advancedAnalytics: currentAnalytics,
      };
    }

    if (currentX <= 0) {
      return {
        kind: "conflict",
        message: "This workspace has no paid X slots to remove.",
      };
    }

    return {
      kind: "schedule_period_end",
      addonCode: "x_account",
      xAccountAllowance: currentX - 1,
      advancedAnalytics: currentAnalytics,
    };
  }

  if (input.action === "add") {
    if (currentAnalytics) {
      return {
        kind: "conflict",
        message: "Advanced Analytics is already on this workspace.",
      };
    }

    return {
      kind: "update_now",
      addonCode: "advanced_analytics",
      xAccountAllowance: currentX,
      advancedAnalytics: true,
    };
  }

  if (!currentAnalytics) {
    return {
      kind: "conflict",
      message: "Advanced Analytics is not on this workspace.",
    };
  }

  return {
    kind: "schedule_period_end",
    addonCode: "advanced_analytics",
    xAccountAllowance: currentX,
    advancedAnalytics: false,
  };
}
