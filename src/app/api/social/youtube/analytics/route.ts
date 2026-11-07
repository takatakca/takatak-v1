import { NextRequest } from "next/server";

import { getSocialShellBilling } from "@/lib/billing/social/billing-banner";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { resolveCanonicalYoutubeDashboard } from "@/lib/social/connections/youtube-dashboard-resolve";
import { getYoutubeCommunitySnapshot } from "@/lib/social/providers/youtube-community-analytics";
import { getYoutubeVideoPerformance } from "@/lib/social/providers/youtube-video-performance";
import { isServiceError } from "@/lib/services/service-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDay(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
}
function yesterdayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
}
function isoDay(date: Date): string { return date.toISOString().slice(0, 10); }

export async function GET(request: NextRequest) {
  try {
    const gate = await requireWorkspaceApiPermission("view_social");
    if (!gate.ok) return gate.response;

    // Subscription checks must also execute in this API: hiding a widget
    // is not access control. Exempt workspace IDs are resolved by the
    // existing server-side SOCIAL_CONNECTION_SETUP_CLIENT_IDS policy.
    const billing = await getSocialShellBilling(gate.access.activeClientId);
    if (!billing?.hasPaidPlan) {
      return jsonResponse({ ok: false, message: "An active Social subscription is required to view YouTube analytics." }, 403);
    }

    const latest = yesterdayUtc();
    const urlStart = request.nextUrl.searchParams.get("start");
    const urlEnd = request.nextUrl.searchParams.get("end");
    if ((urlStart === null) !== (urlEnd === null)) {
      return jsonResponse({ ok: false, message: "Provide both start and end dates." }, 400);
    }
    const end = urlEnd ? parseDay(urlEnd) : latest;
    const start = urlStart
      ? parseDay(urlStart)
      : new Date(latest.getTime() - 29 * 86_400_000);
    if (!start || !end || start > end || end > latest) {
      return jsonResponse({ ok: false, message: "Choose a valid date range ending no later than yesterday." }, 400);
    }
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (days < 1 || days > 365) {
      return jsonResponse({ ok: false, message: "YouTube analytics supports up to 365 days per request." }, 400);
    }
    const allowedHistory = billing.analyticsHistoryDays;
    const earliest = typeof allowedHistory === "number"
      ? new Date(latest.getTime() - (allowedHistory - 1) * 86_400_000)
      : null;
    if (earliest && start < earliest) {
      return jsonResponse({ ok: false, message: "Your subscription does not include this analytics history." }, 403);
    }
    const compare = request.nextUrl.searchParams.get("compare") === "previous";
    const canCompare = billing.billingExempt ||
      billing.entitlements.advancedAnalytics ||
      billing.entitlements.apiAccess;
    if (compare && !canCompare) {
      return jsonResponse({ ok: false, message: "Period comparison requires Advanced Analytics." }, 403);
    }

    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    const youtube = await resolveCanonicalYoutubeDashboard({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });
    if (youtube.kind !== "ready" || !brand.activeBrandId || youtube.connectionStatus !== "connected") {
      return jsonResponse({ ok: false, message: "Connect and select a YouTube channel first." }, 409);
    }

    const options = {
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
      connectionId: youtube.connectionId,
      socialAccountId: youtube.socialAccountId,
      days,
      range: { start: isoDay(start), end: isoDay(end) },
    };
    const current = await getYoutubeCommunitySnapshot(options);
    const previous = compare
      ? await getYoutubeCommunitySnapshot({ ...options, previousPeriod: true })
      : null;
    // Community remains usable when the optional video breakdown fails.
    const videos = await getYoutubeVideoPerformance({
      clientId: options.clientId,
      brandId: options.businessBrandId,
      connectionId: options.connectionId,
      socialAccountId: options.socialAccountId,
      range: current.range,
    }).then((report) => ({ ok: true as const, report }))
      .catch((error: unknown) => ({
        ok: false as const,
        message: isServiceError(error)
          ? error.message
          : "YouTube video performance is temporarily unavailable.",
      }));
    return jsonResponse({
      ok: true,
      current,
      previous,
      videos,
    }, 200);
  } catch (error) {
    return handleApiError("youtube-community-analytics", error, "YouTube analytics could not be loaded.");
  }
}
