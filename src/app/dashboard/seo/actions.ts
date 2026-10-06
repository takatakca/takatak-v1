"use server";

import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
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
