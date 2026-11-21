// Claude (Anthropic) · 2026-11-21 — native app: mark notifications as read (all, or by id).
import type { NextRequest } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { requireMobileWorkspace } from "@/lib/mobile/mobile-auth";
import { markNotificationsRead, parseMarkReadBody } from "@/lib/notifications/workspace-notifications";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await requireMobileWorkspace(request, "view_dashboard");
  if (!gate.ok) return gate.response;

  const text = await request.text().catch(() => "");
  if (text.length > 8192) return jsonResponse({ ok: false, message: "Request too large." }, 413);
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  const target = parseMarkReadBody(body);
  if (!target) return jsonResponse({ ok: false, message: "Choose notifications to mark as read." }, 400);

  const prisma = getPrisma();
  if (!prisma) return jsonResponse({ ok: false, message: "Notifications are temporarily unavailable." }, 503);
  try {
    const { access } = gate.context;
    const updated = await markNotificationsRead(prisma, {
      clientId: access.activeClientId,
      profileId: access.profileId ?? null,
      target,
    });
    return jsonResponse({ ok: true, updated }, 200);
  } catch (error) {
    return handleApiError("mobile-notifications-read", error, "Notifications could not be updated.");
  }
}
