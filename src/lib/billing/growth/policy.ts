// Growth plan billing — pure policy (no I/O; safe for QA).

import { ALL_IN_BUNDLE, SERVICE_PLANS } from "@/lib/growth/plans";

export const GROWTH_BILLING_DOMAIN = "growth_plan";

export interface BillablePlan {
  key: string;
  name: string;
  monthlyCad: number;
  includedCredits: number;
}

export const BILLABLE_PLANS: BillablePlan[] = [
  ...SERVICE_PLANS.map((p) => ({ key: p.key, name: p.name, monthlyCad: p.monthlyCad, includedCredits: p.includedCredits ?? 0 })),
  { key: ALL_IN_BUNDLE.key, name: ALL_IN_BUNDLE.name, monthlyCad: ALL_IN_BUNDLE.monthlyCad, includedCredits: ALL_IN_BUNDLE.includedCredits },
];

export function billablePlan(key: string): BillablePlan | null {
  return BILLABLE_PLANS.find((p) => p.key === key) ?? null;
}

/** Feature → plans that unlock it. The bundle unlocks everything. */
export type GrowthFeature = "reputation" | "conversations" | "ai_autopilot" | "local_seo" | "ads_manager" | "social";

export const FEATURE_PLANS: Record<GrowthFeature, string[]> = {
  reputation: ["reputation"],
  conversations: ["conversations"],
  ai_autopilot: ["ai_autopilot"],
  local_seo: ["local_seo"],
  ads_manager: ["ads_manager"],
  social: ["social_suite"],
};

export function planUnlocks(activePlanKeys: string[], feature: GrowthFeature): boolean {
  if (activePlanKeys.includes(ALL_IN_BUNDLE.key)) return true;
  return FEATURE_PLANS[feature].some((k) => activePlanKeys.includes(k));
}

export const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;

export function normalizeStripeStatus(status: string | null | undefined): string {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "unpaid":
    case "incomplete":
      return status;
    case "incomplete_expired":
      return "canceled";
    case "paused":
      return "unpaid";
    default:
      return "incomplete";
  }
}

export interface PlanSessionLike {
  id: string;
  mode?: string | null;
  status?: string | null;
  client_reference_id?: string | null;
  customer?: string | null;
  subscription?: string | null;
  metadata?: Record<string, string> | null;
}

export type PlanCheckoutDecision =
  | { record: true; clientId: string; planKey: string; customerId: string | null; subscriptionId: string }
  | { record: false; reason: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function decidePlanCheckout(session: PlanSessionLike): PlanCheckoutDecision {
  const meta = session.metadata ?? {};
  if (meta.billingDomain !== GROWTH_BILLING_DOMAIN) return { record: false, reason: "not_growth_plan" };
  if (session.mode !== "subscription") return { record: false, reason: "not_subscription" };
  if (session.status !== "complete") return { record: false, reason: "not_complete" };
  const plan = billablePlan(meta.planKey ?? "");
  if (!plan) return { record: false, reason: "unknown_plan" };
  const clientId = meta.clientId ?? "";
  if (!UUID.test(clientId) || session.client_reference_id !== clientId) return { record: false, reason: "client_mismatch" };
  if (!session.subscription) return { record: false, reason: "no_subscription" };
  return { record: true, clientId, planKey: plan.key, customerId: session.customer ?? null, subscriptionId: session.subscription };
}

/** Credits granted for a paid subscription invoice (first payment and each renewal). */
export function creditsForInvoice(planKey: string, billingReason: string | null | undefined): number {
  if (billingReason !== "subscription_create" && billingReason !== "subscription_cycle") return 0;
  return billablePlan(planKey)?.includedCredits ?? 0;
}
