import type { NextRequest } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { applyLeadUpdate, parseLeadUpdate } from "@/lib/leads/lead-actions";
import { isLeadId } from "@/lib/leads/lead-id";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Updates status, priority, follow-up date or adds a note to one lead of the active workspace. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireWorkspaceApiPermission("edit_content");
  if (!gate.ok) return gate.response;

  const { id } = await params;
  if (!isLeadId(id)) return jsonResponse({ ok: false, message: "Lead not found." }, 404);

  const body = await readJsonBody(request, 8_192);
  if (!body.ok) return jsonResponse({ ok: false, message: body.message }, body.status);

  const update = parseLeadUpdate(body.body);
  if (!update) return jsonResponse({ ok: false, message: "Nothing valid to save." }, 400);

  const prisma = getPrisma();
  if (!prisma) return jsonResponse({ ok: false, message: "Leads are temporarily unavailable." }, 503);

  try {
    const result = await applyLeadUpdate(prisma, {
      clientId: gate.access.activeClientId,
      leadId: id,
      profileId: gate.access.profileId ?? null,
      update,
    });
    if (!result.ok) return jsonResponse({ ok: false, message: "Lead not found." }, 404);
    return jsonResponse({ ok: true, changes: result.changes }, 200);
  } catch (error) {
    return handleApiError("lead-update", error, "The lead could not be updated.");
  }
}
