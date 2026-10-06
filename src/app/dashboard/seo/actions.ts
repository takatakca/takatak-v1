"use server";

import { clientHasGrowthFeature, FEATURE_UPSELL } from "@/lib/billing/growth/entitlements";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { runPageSpeed, type PageSpeedResult } from "@/lib/seo/pagespeed";
import { runSiteAudit, type SiteAuditResult } from "@/lib/seo/site-audit";

export type SiteAuditState = SiteAuditResult | { ok: null };

export async function auditSiteAction(
  _prev: SiteAuditState,
  formData: FormData,
): Promise<SiteAuditState> {
  const { access } = await getServerAccessContext();
  if (!hasEffectivePermission(access, "view_dashboard")) {
    return { ok: false, error: "Sign in to run a site audit." };
  }
  return runSiteAudit(String(formData.get("url") ?? ""));
}

export type PageSpeedState = PageSpeedResult | { ok: null };

export async function pageSpeedAction(_prev: PageSpeedState, formData: FormData): Promise<PageSpeedState> {
  const { access } = await getServerAccessContext();
  if (!hasEffectivePermission(access, "view_dashboard")) return { ok: false, error: "Sign in to run a performance test." };
  if (access.mode === "client_scoped" && !(await clientHasGrowthFeature(access.activeClientId, "local_seo"))) return { ok: false, error: FEATURE_UPSELL.local_seo };
  const strategy = formData.get("strategy") === "desktop" ? "desktop" : "mobile";
  return runPageSpeed(String(formData.get("url") ?? ""), strategy);
}
