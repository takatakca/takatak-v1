import { NextRequest } from "next/server";

import { requireHockeyFamilyApiUser } from "@/lib/hockey/family/api-auth";
import {
  deleteHockeyFamilyEventRsvp,
  HOCKEY_FAMILY_RSVP_STATUSES,
  listHockeyFamilyEventRsvps,
  saveHockeyFamilyEventRsvp,
  type HockeyFamilyRsvpStatus,
} from "@/lib/hockey/family/rsvp-service";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { hasValidWriteOrigin, readJsonBody } from "@/lib/security/write-request";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveIds(context: { params: Promise<{ familyId: string; teamEventId: string }> }) {
  const { familyId, teamEventId } = await context.params;
  return { familyId, teamEventId, valid: isUuid(familyId) && isUuid(teamEventId) };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ familyId: string; teamEventId: string }> },
) {
  const gate = await requireHockeyFamilyApiUser();
  if (!gate.ok) return gate.response;
  const ids = await resolveIds(context);
  if (!ids.valid) return jsonResponse({ ok: false, message: "Invalid family or event identifier." }, 400);

  try {
    const rsvps = await listHockeyFamilyEventRsvps({
      authUserId: gate.user.id, familyId: ids.familyId, teamEventId: ids.teamEventId,
    });
    return jsonResponse({ ok: true, ...rsvps }, 200);
  } catch (error) {
    return handleApiError("hockey-family-rsvp-read", error, "Family RSVP could not be loaded.");
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ familyId: string; teamEventId: string }> },
) {
  if (!hasValidWriteOrigin(request)) {
    return jsonResponse({ ok: false, message: "The request origin could not be verified." }, 403);
  }
  const gate = await requireHockeyFamilyApiUser();
  if (!gate.ok) return gate.response;
  const ids = await resolveIds(context);
  if (!ids.valid) return jsonResponse({ ok: false, message: "Invalid family or event identifier." }, 400);

  const body = await readJsonBody(request);
  if (!body.ok) return jsonResponse({ ok: false, message: body.message }, body.status);
  const record = body.body && typeof body.body === "object" && !Array.isArray(body.body)
    ? body.body as Record<string, unknown> : {};
  const childMemberId = typeof record.childMemberId === "string" ? record.childMemberId.trim() : "";
  const status = typeof record.status === "string" ? record.status : "";

  if (!isUuid(childMemberId) || !HOCKEY_FAMILY_RSVP_STATUSES.includes(status as HockeyFamilyRsvpStatus)) {
    return jsonResponse({ ok: false, message: "Choose a valid child and RSVP status." }, 400);
  }

  try {
    const rsvp = await saveHockeyFamilyEventRsvp({
      authUserId: gate.user.id,
      familyId: ids.familyId,
      teamEventId: ids.teamEventId,
      childMemberId,
      status: status as HockeyFamilyRsvpStatus,
    });
    return jsonResponse({ ok: true, rsvp }, 200);
  } catch (error) {
    return handleApiError("hockey-family-rsvp-write", error, "Family RSVP could not be saved.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ familyId: string; teamEventId: string }> },
) {
  if (!hasValidWriteOrigin(request)) {
    return jsonResponse({ ok: false, message: "The request origin could not be verified." }, 403);
  }
  const gate = await requireHockeyFamilyApiUser();
  if (!gate.ok) return gate.response;
  const ids = await resolveIds(context);
  if (!ids.valid) return jsonResponse({ ok: false, message: "Invalid family or event identifier." }, 400);

  const body = await readJsonBody(request);
  if (!body.ok) return jsonResponse({ ok: false, message: body.message }, body.status);
  const record = body.body && typeof body.body === "object" && !Array.isArray(body.body)
    ? body.body as Record<string, unknown> : {};
  const childMemberId = typeof record.childMemberId === "string" ? record.childMemberId.trim() : "";
  if (!isUuid(childMemberId)) return jsonResponse({ ok: false, message: "Invalid child identifier." }, 400);

  try {
    const result = await deleteHockeyFamilyEventRsvp({
      authUserId: gate.user.id, familyId: ids.familyId, teamEventId: ids.teamEventId, childMemberId,
    });
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (error) {
    return handleApiError("hockey-family-rsvp-delete", error, "Family RSVP could not be removed.");
  }
}
