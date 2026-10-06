import "server-only";

import { getAdsWorkspaceSnapshot } from "@/lib/ads/management-service";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import type { TenantAccess } from "@/lib/security/tenant-access";

export interface AdsSummary {
  campaigns: number;
  budgetCents: number;
  spentCents: number;
  impressions: number;
  clicks: number;
  leads: number;
}

/**
 * Real TAKATAK ADS totals for the active workspace, or null when the viewer is
 * not client-scoped, lacks view_ads, or the database is unavailable.
 */
export async function getActiveWorkspaceAdsSummary(access: TenantAccess): Promise<AdsSummary | null> {
  if (access.mode !== "client_scoped" || !hasEffectivePermission(access, "view_ads")) return null;
  try {
    const { totals } = await getAdsWorkspaceSnapshot(access.activeClientId);
    return {
      campaigns: totals.campaigns,
      budgetCents: totals.budgetCents,
      spentCents: totals.spentCents,
      impressions: totals.impressions,
      clicks: totals.clicks,
      leads: totals.leads,
    };
  } catch {
    console.error("[growth] TAKATAK ADS summary unavailable");
    return null;
  }
}

export function formatCad(cents: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}
