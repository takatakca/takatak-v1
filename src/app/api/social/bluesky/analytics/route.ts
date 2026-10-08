import { NextRequest } from "next/server";

import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { resolveCanonicalBlueskyDashboard } from "@/lib/social/connections/bluesky-dashboard-resolve";
import { fetchBlueskyAnalytics } from "@/lib/social/providers/bluesky-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function safeDate(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireWorkspaceApiPermission("view_social");
    if (!gate.ok) return gate.response;

    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    const resolved = await resolveCanonicalBlueskyDashboard({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });

    if (resolved.kind !== "ready") {
      return jsonResponse(
        { ok: true, connected: false, notice: "No Bluesky account is connected." },
        200,
      );
    }

    const endDate = new Date();
    endDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCDate(endDate.getUTCDate() - 1);
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 29);

    const start = safeDate(request.nextUrl.searchParams.get("start")) ?? isoDate(startDate);
    const end = safeDate(request.nextUrl.searchParams.get("end")) ?? isoDate(endDate);
    const analytics = await fetchBlueskyAnalytics({
      handle: resolved.handle,
      start,
      end,
    });

    return jsonResponse(
      {
        ok: true,
        connected: true,
        handle: resolved.handle,
        accountName: resolved.accountName,
        range: { start, end },
        ...analytics,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "bluesky-analytics-get",
      error,
      "Bluesky analytics could not be loaded.",
    );
  }
}
