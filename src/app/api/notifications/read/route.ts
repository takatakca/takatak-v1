import type { NextRequest } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import {
  markNotificationsRead,
  parseMarkReadBody,
} from "@/lib/notifications/workspace-notifications";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Marks the active workspace's notifications as read (all, or by id). */
export async function POST(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("view_dashboard");
  if (!gate.ok) return gate.response;

  const body = await readJsonBody(request, 8_192);
  if (!body.ok) return jsonResponse({ ok: false, message: body.message }, body.status);

  const target = parseMarkReadBody(body.body);
  if (!target) return jsonResponse({ ok: false, message: "Choose notifications to mark as read." }, 400);

  const prisma = getPrisma();
  if (!prisma) return jsonResponse({ ok: false, message: "Notifications are temporarily unavailable." }, 503);

  try {
    const updated = await markNotificationsRead(prisma, {
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId ?? null,
      target,
    });
    return jsonResponse({ ok: true, updated }, 200);
  } catch (error) {
    return handleApiError("notifications-read", error, "Notifications could not be updated.");
  }
}
