import type { HockeyMembershipAccess } from "./types";

export const HOCKEY_SOURCE_APPLICATION = "ahmverdun" as const;

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
