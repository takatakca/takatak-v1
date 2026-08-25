import { NextRequest } from "next/server";

import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { resolveBrandSessionContext } from "@/lib/security/brand-context";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { resolveCanonicalFacebookDashboard } from "@/lib/social/connections/facebook-dashboard-resolve";
import {
  listFacebookContentItems,
  type FacebookContentListItem,
} from "@/lib/social/sync/facebook-content-sync";
import { resolveFacebookAnalyticsRange } from "@/lib/social/sync/facebook-page-sync-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseContentType(
  value: string | null,
): "post" | "reel" | "story" | null {
  if (value === "post" || value === "reel" || value === "story") return value;
  return null;
}

function sumConfirmed(
  items: FacebookContentListItem[],
  key: keyof Pick<
    FacebookContentListItem,
    "reach" | "views" | "reactions" | "comments" | "shares" | "engagement"
  >,
): number | null {
  let total = 0;
  let seen = false;
  for (const item of items) {
    const value = item[key];
    if (typeof value !== "number") continue;
    total += value;
    seen = true;
  }
  return seen ? total : null;
}

/**
 * GET /api/social/facebook/content?type=post|reel|story&range=last_30&start=&end=&compare=1
 * Client-safe content rows only — never Meta object IDs or tokens.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireWorkspaceApiPermission("view_social");
    if (!gate.ok) return gate.response;

    const brand = await resolveBrandSessionContext(gate.access);
    if (!brand.activeBrandId) {
      return jsonResponse(
        {
          ok: true,
          items: [],
          compareItems: [],
          notice: "Select a brand to load Facebook content.",
        },
        200,
      );
    }

    const contentType = parseContentType(
      request.nextUrl.searchParams.get("type"),
    );
    if (!contentType) {
      return jsonResponse(
        { ok: false, message: "type must be post, reel, or story." },
        400,
      );
    }

    const resolved = await resolveCanonicalFacebookDashboard({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });

    if (resolved.kind === "ambiguous") {
      return jsonResponse(
        {
          ok: false,
          message:
            "Multiple Facebook Page selections need attention. Open Manage connections to continue.",
          category: "ambiguous",
        },
        409,
      );
    }

    if (resolved.kind !== "ready") {
      return jsonResponse(
        {
          ok: true,
          contentType,
          items: [],
          compareItems: [],
          notice: "No connected Facebook Page is selected.",
        },
        200,
      );
    }

    const presetRaw = request.nextUrl.searchParams.get("range") ?? "last_30";
    const customStart = request.nextUrl.searchParams.get("start");
    const customEnd = request.nextUrl.searchParams.get("end");
    const compare = request.nextUrl.searchParams.get("compare") === "1";

    const preset =
      presetRaw === "last_7" ||
      presetRaw === "last_30" ||
      presetRaw === "last_90" ||
      presetRaw === "current_month" ||
      presetRaw === "previous_month" ||
      presetRaw === "custom"
        ? presetRaw
        : customStart && customEnd
          ? "custom"
          : "last_30";

    const range = resolveFacebookAnalyticsRange({
      preset,
      timezone: "UTC",
      customStart,
      customEnd,
      compare,
    });

    const sortParam = request.nextUrl.searchParams.get("sort");
    const sort =
      sortParam === "publishedAt_asc" || sortParam === "engagement_desc"
        ? sortParam
        : "publishedAt_desc";

    const items = await listFacebookContentItems({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
      socialAccountId: resolved.socialAccountId,
      contentType,
      rangeStart: range.start,
      rangeEnd: range.end,
      sort,
    });

    const compareItems =
      range.compareStart && range.compareEnd
        ? await listFacebookContentItems({
            clientId: gate.access.activeClientId,
            businessBrandId: brand.activeBrandId,
            socialAccountId: resolved.socialAccountId,
            contentType,
            rangeStart: range.compareStart,
            rangeEnd: range.compareEnd,
            sort,
          })
        : [];

    return jsonResponse(
      {
        ok: true,
        contentType,
        range: {
          start: range.start,
          end: range.end,
          compareStart: range.compareStart,
          compareEnd: range.compareEnd,
        },
        items,
        compareItems,
        totals: {
          count: items.length,
          reach: sumConfirmed(items, "reach"),
          views: sumConfirmed(items, "views"),
          reactions: sumConfirmed(items, "reactions"),
          comments: sumConfirmed(items, "comments"),
          shares: sumConfirmed(items, "shares"),
          engagement: sumConfirmed(items, "engagement"),
        },
        compareTotals:
          compareItems.length > 0
            ? {
                count: compareItems.length,
                reach: sumConfirmed(compareItems, "reach"),
                views: sumConfirmed(compareItems, "views"),
                reactions: sumConfirmed(compareItems, "reactions"),
                comments: sumConfirmed(compareItems, "comments"),
                shares: sumConfirmed(compareItems, "shares"),
                engagement: sumConfirmed(compareItems, "engagement"),
              }
            : null,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "facebook-content-get",
      error,
      "Facebook content could not be loaded.",
    );
  }
}
