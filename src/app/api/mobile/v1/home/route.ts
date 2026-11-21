// Claude (Anthropic) · 2026-11-21 — native app home: the same numbers as /dashboard (reach, engagement,
// website traffic, leads, reviews, connections), read with the same loader and the same tenant scope.
import type { NextRequest } from "next/server";

import { getDashboardHomeData } from "@/lib/dashboard/home-data";
import { requireMobileWorkspace } from "@/lib/mobile/mobile-auth";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireMobileWorkspace(request, "view_dashboard");
  if (!gate.ok) return gate.response;
  const { access, profileDetails, clientNames } = gate.context;
  const from = request.nextUrl.searchParams.get("from") ?? undefined;
  const to = request.nextUrl.searchParams.get("to") ?? undefined;
  try {
    const data = await getDashboardHomeData({ from, to, access });
    const welcomeName =
      profileDetails?.firstName?.trim() ||
      profileDetails?.displayName?.trim() ||
      clientNames[access.activeClientId] ||
      data.welcomeName;
    return jsonResponse({ ok: true, ...data, welcomeName }, 200);
  } catch (error) {
    return handleApiError("mobile-home", error, "Your dashboard could not be loaded.");
  }
}
