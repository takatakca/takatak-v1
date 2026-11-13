import { NextRequest } from "next/server";
import { getSocialShellBilling } from "@/lib/billing/social/billing-banner";
import { getPrisma } from "@/lib/db/prisma";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { assertCompetitorRateLimit } from "@/lib/social/sync/facebook-competitor-rate-limit";
import { resolveCanonicalYoutubeDashboard } from "@/lib/social/connections/youtube-dashboard-resolve";
import {
  addYoutubeCompetitor,
  listYoutubeCompetitors,
  removeYoutubeCompetitor,
  starYoutubeCompetitor,
} from "@/lib/social/providers/youtube-competitors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function calendarDay(input: string | null): Date | null {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const parsed = new Date(input + "T00:00:00.000Z");
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== input ? null : parsed;
}
function defaultDates(): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return { start: new Date(end.getTime() - 29 * 86_400_000), end };
}
function jsonDates(request: NextRequest, history: number | null) {
  const defaults = defaultDates();
  const queryStart = request.nextUrl.searchParams.get("start");
  const queryEnd = request.nextUrl.searchParams.get("end");
  if ((queryStart === null) !== (queryEnd === null)) return null;
  const start = queryStart ? calendarDay(queryStart) : defaults.start;
  const end = queryEnd ? calendarDay(queryEnd) : defaults.end;
  if (!start || !end || start > end || end > defaults.end) return null;
  const length = (end.getTime() - start.getTime()) / 86_400_000 + 1;
  if (length > 365) return null;
  if (history !== null && start.getTime() < defaults.end.getTime() - (history - 1) * 86_400_000) return null;
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

async function requestContext(permission: "view_social" | "manage_social_accounts") {
  const gate = await requireWorkspaceApiPermission(permission);
  if (!gate.ok) return { response: gate.response };
  const billing = await getSocialShellBilling(gate.access.activeClientId);
  if (!billing?.hasPaidPlan) {
    return { response: jsonResponse({ ok: false, message: "A TAKATAK Social subscription is required." }, 403) };
  }
  const brand = await resolveBrandSessionContextFromRequest(gate.access);
  if (!brand.activeBrandId) {
    return { response: jsonResponse({ ok: false, message: "Select a brand to manage competitors." }, 409) };
  }
  const resolved = await resolveCanonicalYoutubeDashboard({
    clientId: gate.access.activeClientId,
    businessBrandId: brand.activeBrandId,
  });
  if (resolved.kind !== "ready" || resolved.connectionStatus !== "connected") {
    return { response: jsonResponse({ ok: false, message: "Connect and select a YouTube channel first." }, 409) };
  }
  const limited = assertCompetitorRateLimit({
    profileId: gate.access.profileId,
    clientId: gate.access.activeClientId,
    businessBrandId: brand.activeBrandId,
    action: permission === "view_social" ? "list" : "add",
  });
  if (!limited.ok) return { response: jsonResponse({ ok: false, message: limited.message }, 429) };
  return {
    clientId: gate.access.activeClientId,
    brandId: brand.activeBrandId,
    accountId: resolved.socialAccountId,
    connectionId: resolved.connectionId,
    allowance: billing.entitlements.competitorAllowance,
    history: billing.analyticsHistoryDays,
    response: null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const context = await requestContext("view_social");
    if (context.response) return context.response;
    if (!context.brandId || !context.clientId || !context.connectionId) {
      return jsonResponse({ ok: false, message: "Select a connected brand." }, 409);
    }
    const range = jsonDates(request, context.history ?? 0);
    if (!range) return jsonResponse({ ok: false, message: "This date range is outside your plan's analytics allowance." }, 403);
    const report = await listYoutubeCompetitors({
      clientId: context.clientId,
      brandId: context.brandId,
      connectionId: context.connectionId,
      start: range.start,
      end: range.end,
      allowance: context.allowance ?? 0,
    });
    return jsonResponse({ ok: true, ...report, range }, 200);
  } catch (error) {
    return handleApiError("youtube-competitors-get", error, "YouTube competitor data could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requestContext("manage_social_accounts");
    if (context.response) return context.response;
    if (!context.brandId || !context.clientId || !context.connectionId || !context.accountId) {
      return jsonResponse({ ok: false, message: "Select a connected YouTube channel first." }, 409);
    }
    const body = await request.json().catch(() => null) as { channel?: unknown } | null;
    if (typeof body?.channel !== "string" || body.channel.length > 220) {
      return jsonResponse({ ok: false, message: "Provide a YouTube @handle or channel URL." }, 400);
    }
    const db = getPrisma();
    if (!db) return jsonResponse({ ok: false, message: "Competitor database unavailable." }, 503);
    const owner = await db.socialAccount.findFirst({
      where: {
        id: context.accountId,
        clientId: context.clientId,
        businessBrandId: context.brandId,
        platform: "youtube",
      },
      select: { externalAccountId: true },
    });
    if (!owner?.externalAccountId) return jsonResponse({ ok: false, message: "Select a YouTube channel first." }, 409);
    await addYoutubeCompetitor({
      clientId: context.clientId,
      brandId: context.brandId,
      connectionId: context.connectionId,
      ownerAccountId: owner.externalAccountId,
      source: body.channel,
      allowance: context.allowance ?? 0,
    });
    return jsonResponse({ ok: true }, 201);
  } catch (error) {
    return handleApiError("youtube-competitors-add", error, "Unable to add YouTube competitor.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requestContext("manage_social_accounts");
    if (context.response) return context.response;
    if (!context.clientId || !context.brandId) return jsonResponse({ ok: false, message: "Select a brand." }, 409);
    const ref = request.nextUrl.searchParams.get("ref");
    if (!ref || !/^ytc_[a-f0-9]{24}$/.test(ref)) {
      return jsonResponse({ ok: false, message: "Choose a saved competitor." }, 400);
    }
    await removeYoutubeCompetitor({ clientId: context.clientId, brandId: context.brandId, ref });
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    return handleApiError("youtube-competitors-remove", error, "Unable to remove YouTube competitor.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await requestContext("manage_social_accounts");
    if (context.response) return context.response;
    if (!context.clientId || !context.brandId) return jsonResponse({ ok: false, message: "Select a brand." }, 409);
    const body = await request.json().catch(() => null) as { ref?: unknown; starred?: unknown } | null;
    if (typeof body?.ref !== "string" || !/^ytc_[a-f0-9]{24}$/.test(body.ref) || typeof body?.starred !== "boolean") {
      return jsonResponse({ ok: false, message: "Choose a saved competitor and favorite state." }, 400);
    }
    await starYoutubeCompetitor({ clientId: context.clientId, brandId: context.brandId, ref: body.ref, starred: body.starred });
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    return handleApiError("youtube-competitors-star", error, "Unable to update the competitor.");
  }
}
