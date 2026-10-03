import {
  ADS_PLAN_CATALOG,
  ADS_UNSUBSCRIBED_PLAN_CODE,
  isAdsPlanCode,
} from "./plan-catalog";
import type {
  AdsFeature,
  AdsPlanCode,
  AdsSubscriptionAccess,
} from "./types";

const PAID_STATUSES = new Set([
  "trial",
  "active",
  "past_due",
  "grace_period",
]);

function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function resolveAdsSubscriptionAccess(input: {
  status?: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | string | null;
  now?: Date;
}): AdsSubscriptionAccess {
  const status = input.status ?? null;
  const now = input.now ?? new Date();
  const periodEnd = parseDate(input.currentPeriodEnd);

  if (PAID_STATUSES.has(status ?? "")) {
    if (
      input.cancelAtPeriodEnd &&
      (!periodEnd || periodEnd.getTime() <= now.getTime())
    ) {
      return "blocked";
    }
    return "paid";
  }

  if (
    status === "canceled" &&
    periodEnd &&
    periodEnd.getTime() > now.getTime()
  ) {
    return "paid";
  }

  return "blocked";
}

export function resolveEffectiveAdsPlan(input: {
  status?: string | null;
  planCode?: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | string | null;
  now?: Date;
}): AdsPlanCode {
  const access = resolveAdsSubscriptionAccess(input);
  if (access !== "paid" || !isAdsPlanCode(input.planCode)) {
    return ADS_UNSUBSCRIBED_PLAN_CODE;
  }
  return input.planCode;
}

export function adsSubscriptionAllows(
  input: {
    status?: string | null;
    planCode?: string | null;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: Date | string | null;
    now?: Date;
  },
  feature: AdsFeature,
): boolean {
  const planCode = resolveEffectiveAdsPlan(input);
  return ADS_PLAN_CATALOG[planCode].features.includes(feature);
}
