"use server";

import { redirect } from "next/navigation";

import { billablePlan } from "@/lib/billing/growth/policy";
import { growthBillingEnabled, startBillingPortal, startPlanCheckout } from "@/lib/billing/growth/stripe";
import { publicAppOrigin } from "@/lib/growth/public-origin";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

const PRICING = "/dashboard/growth/pricing";

async function billingAccess() {
  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped" || !hasEffectivePermission(access, "manage_settings")) return null;
  return access;
}

export async function subscribePlanAction(formData: FormData): Promise<void> {
  const access = await billingAccess();
  const planKey = String(formData.get("planKey") ?? "");
  if (!access || !growthBillingEnabled() || !billablePlan(planKey)) redirect(`${PRICING}?billing=unavailable`);
  let url: string;
  try {
    url = await startPlanCheckout({ clientId: access.activeClientId, planKey, origin: await publicAppOrigin() });
  } catch {
    console.error("[growth-billing] checkout failed");
    redirect(`${PRICING}?billing=error`);
  }
  redirect(url);
}

export async function openBillingPortalAction(): Promise<void> {
  const access = await billingAccess();
  if (!access || !growthBillingEnabled()) redirect(`${PRICING}?billing=unavailable`);
  let url: string | null = null;
  try {
    url = await startBillingPortal(access.activeClientId, await publicAppOrigin());
  } catch {
    console.error("[growth-billing] portal failed");
  }
  redirect(url ?? `${PRICING}?billing=no_customer`);
}
