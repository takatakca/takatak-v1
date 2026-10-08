import { NextRequest } from "next/server";

import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { resolveCanonicalGoogleBusinessDashboard } from "@/lib/social/connections/google-business-dashboard-resolve";
import {
  fetchGoogleBusinessAnalytics,
  fetchGoogleBusinessMedia,
  fetchGoogleBusinessPosts,
  fetchGoogleBusinessReviews,
} from "@/lib/social/providers/google-business-performance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultRange(): {
  start: string;
  end: string;
} {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);

  return {
    start: isoDate(start),
    end: isoDate(end),
  };
}

function safeDate(
  value: string | null,
): string | null {
  if (
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }

  return null;
}

export async function GET(
  request: NextRequest,
) {
  try {
    const gate =
      await requireWorkspaceApiPermission(
        "view_social",
      );

    if (!gate.ok) {
      return gate.response;
    }

    const brand =
      await resolveBrandSessionContextFromRequest(
        gate.access,
      );

    if (!brand.activeBrandId) {
      return jsonResponse(
        {
          ok: true,
          connected: false,
          notice:
            "Select a brand to load Google Business Profile analytics.",
        },
        200,
      );
    }

    const resolved =
      await resolveCanonicalGoogleBusinessDashboard({
        clientId:
          gate.access.activeClientId,
        businessBrandId:
          brand.activeBrandId,
      });

    if (resolved.kind !== "ready") {
      return jsonResponse(
        {
          ok: true,
          connected: false,
          notice:
            "No connected Google Business Profile location is selected.",
        },
        200,
      );
    }

    const fallback = defaultRange();

    const start =
      safeDate(
        request.nextUrl.searchParams.get(
          "start",
        ),
      ) ?? fallback.start;

    const end =
      safeDate(
        request.nextUrl.searchParams.get(
          "end",
        ),
      ) ?? fallback.end;

    const analytics =
      await fetchGoogleBusinessAnalytics({
        clientId:
          gate.access.activeClientId,
        connectionId:
          resolved.connectionId,
        locationName:
          resolved.locationName,
        start,
        end,
      });

    const reviews = await fetchGoogleBusinessReviews({
      clientId: gate.access.activeClientId,
      connectionId: resolved.connectionId,
      socialAccountId: resolved.socialAccountId,
      locationName: resolved.locationName,
      start,
      end,
    }).catch(() => ({
      averageRating: null,
      total: 0,
      items: [],
    }));

    const posts = await fetchGoogleBusinessPosts({
      clientId: gate.access.activeClientId,
      connectionId: resolved.connectionId,
      socialAccountId: resolved.socialAccountId,
      locationName: resolved.locationName,
      start,
      end,
    }).catch(() => ({
      total: 0,
      items: [],
    }));

    const media = await fetchGoogleBusinessMedia({
      clientId: gate.access.activeClientId,
      connectionId: resolved.connectionId,
      socialAccountId: resolved.socialAccountId,
      locationName: resolved.locationName,
      start,
      end,
    }).catch(() => ({
      total: 0,
      items: [],
    }));

    return jsonResponse(
      {
        ok: true,
        connected: true,
        account: {
          name: resolved.accountName,
          category: resolved.category,
          profileUrl:
            resolved.profileUrl,
        },
        reviews,
        media,
        posts,
        ...analytics,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "google-business-analytics-get",
      error,
      "Google Business Profile analytics could not be loaded.",
    );
  }
}
