"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clientHasGrowthFeature, FEATURE_UPSELL } from "@/lib/billing/growth/entitlements";
import { getPrisma } from "@/lib/db/prisma";
import { dueUrls } from "@/lib/seo/score-history";
import { listSeoScores, recordSeoScore } from "@/lib/seo/score-store";
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
  const result = await runSiteAudit(String(formData.get("url") ?? ""));
  if (result.ok && access.mode === "client_scoped") {
    const prisma = getPrisma();
    if (prisma) {
      try {
        await recordSeoScore(prisma, {
          clientId: access.activeClientId,
          profileId: access.profileId,
          report: result.report,
        });
      } catch {
        console.error("[seo-history] save failed");
      }
    }
  }
  return result;
}

export async function reauditDueAction() {
  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped" || !hasEffectivePermission(access, "view_dashboard")) {
    redirect("/dashboard/seo?reaudit=0");
  }
  const prisma = getPrisma();
  if (!prisma) redirect("/dashboard/seo?reaudit=0");
  let rows;
  try {
    rows = await listSeoScores(prisma, access.activeClientId);
  } catch {
    console.error("[seo-history] list failed");
    redirect("/dashboard/seo?reaudit=0");
  }
  const urls = dueUrls(rows, new Date());
  let ran = 0;
  for (const url of urls) {
    const result = await runSiteAudit(url);
    if (!result.ok) continue;
    try {
      const saved = await recordSeoScore(prisma, {
        clientId: access.activeClientId,
        profileId: access.profileId,
        report: result.report,
      });
      if (saved) ran += 1;
    } catch {
      console.error("[seo-history] reaudit save failed");
    }
  }
  revalidatePath("/dashboard/seo");
  redirect(`/dashboard/seo?reaudit=${ran}`);
}

export type PageSpeedState = PageSpeedResult | { ok: null };

export async function pageSpeedAction(_prev: PageSpeedState, formData: FormData): Promise<PageSpeedState> {
  const { access } = await getServerAccessContext();
  if (!hasEffectivePermission(access, "view_dashboard")) return { ok: false, error: "Sign in to run a performance test." };
  if (access.mode === "client_scoped" && !(await clientHasGrowthFeature(access.activeClientId, "local_seo"))) return { ok: false, error: FEATURE_UPSELL.local_seo };
  const strategy = formData.get("strategy") === "desktop" ? "desktop" : "mobile";
  return runPageSpeed(String(formData.get("url") ?? ""), strategy);
}
