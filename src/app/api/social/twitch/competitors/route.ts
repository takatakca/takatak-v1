import { NextRequest } from "next/server";

import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { resolveCanonicalTwitchDashboard } from "@/lib/social/connections/twitch-dashboard-resolve";
import {
  addTwitchCompetitor,
  listTwitchCompetitors,
  removeTwitchCompetitor,
} from "@/lib/social/providers/twitch-competitors";

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
      return jsonResponse({ ok: true, competitors: [] }, 200);
    }
    const resolved = await resolveCanonicalTwitchDashboard({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });
    if (resolved.kind !== "ready") {
      return jsonResponse({ ok: true, competitors: [] }, 200);
    }
    const fallback = defaultRange();
    const start = safeDate(request.nextUrl.searchParams.get("start")) ?? fallback.start;
    const end = safeDate(request.nextUrl.searchParams.get("end")) ?? fallback.end;
    const competitors = await listTwitchCompetitors({
      clientId: gate.access.activeClientId,
      connectionId: resolved.connectionId,
      businessBrandId: brand.activeBrandId,
      start,
      end,
    });
    return jsonResponse({ ok: true, competitors }, 200);
  } catch (error) {
    return handleApiError("twitch-competitors-get", error, "Twitch competitors could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireWorkspaceApiPermission("manage_social_accounts");
    if (!gate.ok) return gate.response;
    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    if (!brand.activeBrandId) {
      return jsonResponse({ ok: false, message: "Select a brand before adding a competitor." }, 400);
    }
    const resolved = await resolveCanonicalTwitchDashboard({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });
    if (resolved.kind !== "ready") {
      return jsonResponse({ ok: false, message: "Connect a Twitch channel first." }, 400);
    }
    const body = (await request.json()) as { login?: string };
    await addTwitchCompetitor({
      clientId: gate.access.activeClientId,
      connectionId: resolved.connectionId,
      businessBrandId: brand.activeBrandId,
      login: body.login ?? "",
    });
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    return handleApiError("twitch-competitors-add", error, "That Twitch channel could not be added.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireWorkspaceApiPermission("manage_social_accounts");
    if (!gate.ok) return gate.response;
    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    if (!brand.activeBrandId) {
      return jsonResponse({ ok: false, message: "Select a brand first." }, 400);
    }
    const ref = request.nextUrl.searchParams.get("ref") ?? "";
    if (!/^twc_[a-f0-9]{24}$/.test(ref)) {
      return jsonResponse({ ok: false, message: "Choose a competitor to remove." }, 400);
    }
    await removeTwitchCompetitor({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
      ref,
    });
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    return handleApiError(
      "twitch-competitors-remove",
      error,
      "That competitor could not be removed.",
    );
  }
}
