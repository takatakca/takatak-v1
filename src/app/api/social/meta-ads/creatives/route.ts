import { NextRequest } from "next/server";

import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { resolveCanonicalMetaAdsDashboard } from "@/lib/social/connections/meta-ads-dashboard-resolve";
import { fetchMetaAdsCreativeReport } from "@/lib/social/providers/meta-ads-insights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REPORT_DAYS = 31;
const COOLDOWN_MS = 20_000;
const lastRequestByAccount = new Map<string, number>();

function parseDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function getReportRange(request: NextRequest): { start: string; end: string } | null {
  const end = request.nextUrl.searchParams.get("end");
  const start = request.nextUrl.searchParams.get("start");
  const firstDate = parseDate(start);
  const lastDate = parseDate(end);
  if (!firstDate || !lastDate || firstDate > lastDate) return null;
  const days = (lastDate.getTime() - firstDate.getTime()) / 86_400_000 + 1;
  const today = new Date().toISOString().slice(0, 10);
  if (days > MAX_REPORT_DAYS || lastDate.toISOString().slice(0, 10) > today) return null;
  return { start: start!, end: end! };
}

/** Private, process-local best-effort query throttle, not a global quota guarantee. */
function rateLimit(key: string): boolean {
  const now = Date.now();
  const prior = lastRequestByAccount.get(key) ?? 0;
  if (now - prior < COOLDOWN_MS) return false;
  if (lastRequestByAccount.size >= 500) {
    for (const [oldKey, time] of lastRequestByAccount) {
      if (now - time >= COOLDOWN_MS) lastRequestByAccount.delete(oldKey);
    }
    // At capacity, reject instead of clearing active cooldowns and allowing a burst.\n    if (lastRequestByAccount.size >= 500) return false;
  }
  lastRequestByAccount.set(key, now);
  return true;
}

/** GET is read-only; never accepts client/brand/account identities from URL parameters. */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireWorkspaceApiPermission("view_social");
    if (!gate.ok) return gate.response;
    if (process.env.TAKATAK_CREATIVE_INTELLIGENCE_ENABLED !== "true") {
      return jsonResponse({ ok: false, message: "Creative Intelligence is not enabled for this deployment." }, 404);
    }
    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    if (!brand.activeBrandId) {
      return jsonResponse({ ok: true, connected: false }, 200);
    }
    const resolved = await resolveCanonicalMetaAdsDashboard({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });
    if (resolved.kind !== "ready") {
      return jsonResponse({ ok: true, connected: false }, 200);
    }
    const range = getReportRange(request);
    if (!range) {
      return jsonResponse({ ok: false, message: "Choose a valid reporting period of up to 31 days." }, 400);
    }
    const key = `${gate.access.activeClientId}:${brand.activeBrandId}:${resolved.socialAccountId}`;
    if (!rateLimit(key)) {
      return jsonResponse({ ok: false, message: "Please wait before refreshing the ad-level report." }, 429);
    }
    const report = await fetchMetaAdsCreativeReport({
      clientId: gate.access.activeClientId,
      connectionId: resolved.connectionId,
      socialAccountId: resolved.socialAccountId,
      start: range.start,
      end: range.end,
    });
    return jsonResponse({ ok: true, connected: true, ...report }, 200);
  } catch (error) {
    return handleApiError("meta-ads-creative-report-get", error, "Meta ad-level performance could not be loaded.");
  }
}
