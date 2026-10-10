import "server-only";

import { getPrisma } from "@/lib/db/prisma";

import { ACTIVE_STATUSES, planUnlocks, type GrowthFeature } from "./policy";

/** Enforcement is off during the pilot; turn on with GROWTH_ENTITLEMENTS_ENFORCED=true once prices are live. */
export function growthEntitlementsEnforced(): boolean {
  return process.env.GROWTH_ENTITLEMENTS_ENFORCED === "true";
}

export async function activeGrowthPlans(clientId: string): Promise<string[]> {
  const prisma = getPrisma();
  if (!prisma) return [];
  const rows = await prisma.growthSubscription.findMany({
    where: { clientId, status: { in: [...ACTIVE_STATUSES] } },
    select: { planKey: true },
  });
  return rows.map((r) => r.planKey);
}

export async function clientHasGrowthFeature(clientId: string, feature: GrowthFeature): Promise<boolean> {
  if (!growthEntitlementsEnforced()) return true;
  return planUnlocks(await activeGrowthPlans(clientId), feature);
}

export const FEATURE_UPSELL: Record<GrowthFeature, string> = {
  reputation: "This needs the Reputation Pro plan (Plans & Pricing).",
  conversations: "This needs the Conversations plan (Plans & Pricing).",
  ai_autopilot: "This needs the AI Autopilot plan (Plans & Pricing).",
  local_seo: "This needs the Local SEO plan (Plans & Pricing).",
  ads_manager: "This needs the Ads Manager plan (Plans & Pricing).",
  social: "This needs the Social Suite plan (Plans & Pricing).",
};
