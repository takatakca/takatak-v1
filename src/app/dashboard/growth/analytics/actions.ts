"use server";

import { revalidatePath } from "next/cache";

import { parseAudienceRule } from "@/lib/analytics/parse";
import { createAnalyticsSite, createAudience, deleteAudience, linkGoogleSources, setAnalyticsSiteActive } from "@/lib/analytics/service";
import { isValidGa4PropertyId, normalizeSearchConsoleProperty } from "@/lib/integrations/google/parse";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

const BASE = "/dashboard/growth/analytics";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function canManage() {
  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped" || !hasEffectivePermission(access, "manage_services")) return null;
  return access;
}

export type AnalyticsFormState = { ok: null } | { ok: true; message: string } | { ok: false; error: string };

export async function createSiteAction(_prev: AnalyticsFormState, formData: FormData): Promise<AnalyticsFormState> {
  const access = await canManage();
  if (!access) return { ok: false, error: "You do not have permission to add websites." };
  const brand = String(formData.get("businessBrandId") ?? "");
  try {
    const result = await createAnalyticsSite(access.activeClientId, {
      name: String(formData.get("name") ?? ""),
      domain: String(formData.get("domain") ?? ""),
      businessBrandId: UUID.test(brand) ? brand : null,
    });
    if ("error" in result) return { ok: false, error: result.error };
  } catch {
    console.error("[analytics] create site failed");
    return { ok: false, error: "The website could not be added. Try again." };
  }
  revalidatePath(BASE);
  return { ok: true, message: "Website added. Install the tracking code below." };
}

export async function toggleSiteAction(formData: FormData): Promise<void> {
  const access = await canManage();
  const id = String(formData.get("siteId") ?? "");
  if (!access || !UUID.test(id)) return;
  await setAnalyticsSiteActive(access.activeClientId, id, formData.get("active") === "true");
  revalidatePath(BASE);
}

export async function createAudienceAction(_prev: AnalyticsFormState, formData: FormData): Promise<AnalyticsFormState> {
  const access = await canManage();
  if (!access) return { ok: false, error: "You do not have permission to create audiences." };
  const siteId = String(formData.get("siteId") ?? "");
  if (!UUID.test(siteId)) return { ok: false, error: "Choose a website." };
  const parsed = parseAudienceRule(Object.fromEntries(formData.entries()));
  if (!parsed.ok) return parsed;
  try {
    const result = await createAudience(access.activeClientId, siteId, parsed.value);
    if ("error" in result) return { ok: false, error: result.error };
  } catch {
    console.error("[analytics] create audience failed");
    return { ok: false, error: "The audience could not be saved. Try again." };
  }
  revalidatePath(BASE);
  revalidatePath("/dashboard/growth/audiences");
  return { ok: true, message: "Audience saved." };
}

export async function deleteAudienceAction(formData: FormData): Promise<void> {
  const access = await canManage();
  const id = String(formData.get("audienceId") ?? "");
  if (!access || !UUID.test(id)) return;
  await deleteAudience(access.activeClientId, id);
  revalidatePath(BASE);
  revalidatePath("/dashboard/growth/audiences");
}

export async function linkGoogleAction(_prev: AnalyticsFormState, formData: FormData): Promise<AnalyticsFormState> {
  const access = await canManage();
  if (!access) return { ok: false, error: "You do not have permission to connect Google data." };
  const siteId = String(formData.get("siteId") ?? "");
  if (!UUID.test(siteId)) return { ok: false, error: "Choose a website." };
  const ga4Raw = String(formData.get("ga4PropertyId") ?? "").trim().replace(/^properties\//, "");
  const scRaw = String(formData.get("searchConsoleProperty") ?? "").trim();
  if (ga4Raw && !isValidGa4PropertyId(ga4Raw)) return { ok: false, error: "The GA4 property ID is the number shown in GA4 Admin → Property details (e.g. 123456789)." };
  const sc = scRaw ? normalizeSearchConsoleProperty(scRaw) : null;
  if (scRaw && !sc) return { ok: false, error: "Use the Search Console property exactly as listed: sc-domain:example.com or https://www.example.com/." };
  const saved = await linkGoogleSources(access.activeClientId, siteId, { ga4PropertyId: ga4Raw || null, searchConsoleProperty: sc });
  if (!saved) return { ok: false, error: "Website not found in this workspace." };
  revalidatePath(BASE);
  revalidatePath("/dashboard/seo/keywords");
  return { ok: true, message: "Google connections saved." };
}
