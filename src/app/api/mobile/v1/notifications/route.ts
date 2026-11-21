// Claude (Anthropic) · 2026-11-21 — native app: this business's notifications (same list as /dashboard/notifications).
import type { NextRequest } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { requireMobileWorkspace } from "@/lib/mobile/mobile-auth";
import { listWorkspaceNotifications } from "@/lib/notifications/workspace-notifications";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireMobileWorkspace(request, "view_dashboard");
  if (!gate.ok) return gate.response;
  const prisma = getPrisma();
  if (!prisma) return jsonResponse({ ok: false, message: "Notifications are temporarily unavailable." }, 503);
  try {
    const { access } = gate.context;
    const result = await listWorkspaceNotifications(prisma, access.activeClientId, access.profileId ?? null);
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (error) {
    return handleApiError("mobile-notifications", error, "Notifications could not be loaded.");
  }
}
