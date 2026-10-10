import { NextRequest } from "next/server";

import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { resolveCanonicalMetaAdsDashboard } from "@/lib/social/connections/meta-ads-dashboard-resolve";
import { fetchMetaAdsAccountAnalytics } from "@/lib/social/providers/meta-ads-insights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultRange(): { start: string; end: string } {
  const end = new Date();
  end.setUTCHours(12, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  return { start: isoDate(start), end: isoDate(end) };
}

function safeDate(value: string | null): string | null {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireWorkspaceApiPermission("view_social");
    if (!gate.ok) return gate.response;
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
    const fallback = defaultRange();
    const start = safeDate(request.nextUrl.searchParams.get("start")) ?? fallback.start;
    const end = safeDate(request.nextUrl.searchParams.get("end")) ?? fallback.end;
    if (start > end) {
      return jsonResponse({ ok: false, message: "Choose a shorter date range." }, 400);
    }
    const analytics = await fetchMetaAdsAccountAnalytics({
      clientId: gate.access.activeClientId,
      connectionId: resolved.connectionId,
      socialAccountId: resolved.socialAccountId,
      start,
      end,
    });
    return jsonResponse(
      { ok: true, connected: true, range: { start, end }, ...analytics },
      200,
    );
  } catch (error) {
    return handleApiError(
      "meta-ads-analytics-get",
      error,
      "Meta Ads analytics could not be loaded.",
    );
  }
}
