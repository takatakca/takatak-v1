import { NextRequest } from "next/server";

import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { resolveCanonicalTikTokDashboard } from "@/lib/social/connections/tiktok-dashboard-resolve";
import { fetchTikTokAnalytics } from "@/lib/social/providers/tiktok-analytics";

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

  return {
    start: isoDate(start),
    end: isoDate(end),
  };
}

function safeDate(value: string | null): string | null {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return null;
}

function rangeLength(start: string, end: string): number {
  const from = new Date(`${start}T12:00:00Z`).getTime();
  const to = new Date(`${end}T12:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000) + 1;
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireWorkspaceApiPermission("view_social");
    if (!gate.ok) {
      return gate.response;
    }

    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    if (!brand.activeBrandId) {
      return jsonResponse(
        {
          ok: true,
          connected: false,
          notice: "Select a brand to load TikTok analytics.",
        },
        200,
      );
    }

    const resolved = await resolveCanonicalTikTokDashboard({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });

    if (resolved.kind !== "ready") {
      return jsonResponse(
        {
          ok: true,
          connected: false,
          notice: "No connected TikTok account is selected.",
        },
        200,
      );
    }

    const fallback = defaultRange();
    const start =
      safeDate(request.nextUrl.searchParams.get("start")) ?? fallback.start;
    const end =
      safeDate(request.nextUrl.searchParams.get("end")) ?? fallback.end;

    if (start > end || rangeLength(start, end) > 366) {
      return jsonResponse(
        {
          ok: false,
          message: "Choose a TikTok range of 366 days or less.",
        },
        400,
      );
    }

    const analytics = await fetchTikTokAnalytics({
      clientId: gate.access.activeClientId,
      connectionId: resolved.connectionId,
      socialAccountId: resolved.socialAccountId,
      start,
      end,
    });

    return jsonResponse(
      {
        ok: true,
        connected: true,
        range: { start, end },
        ...analytics,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "tiktok-analytics-get",
      error,
      "TikTok analytics could not be loaded.",
    );
  }
}
