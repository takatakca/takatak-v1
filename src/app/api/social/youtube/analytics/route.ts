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

type AllowedDays = 7 | 30 | 90 | 365;
const ALLOWED_DAYS = new Set([7, 30, 90, 365]);

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

    const days = Number(request.nextUrl.searchParams.get("days") ?? "30");
    if (!ALLOWED_DAYS.has(days)) {
      return jsonResponse({ ok: false, message: "Choose a supported reporting period." }, 400);
    }
    const allowedHistory = billing.analyticsHistoryDays;
    if (typeof allowedHistory === "number" && days > allowedHistory) {
      return jsonResponse({ ok: false, message: "Your subscription does not include this reporting period." }, 403);
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
      days: days as AllowedDays,
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
