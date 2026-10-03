import { NextRequest } from "next/server";

import { requireHockeyFamilyApiUser } from "@/lib/hockey/family/api-auth";
import {
  deleteHockeyFamilyEventRsvp,
  HOCKEY_FAMILY_RSVP_RESPONSES,
  listHockeyFamilyEventRsvps,
  saveHockeyFamilyEventRsvp,
  type HockeyFamilyRsvpResponse,
} from "@/lib/hockey/family/event-rsvp-service";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import {
  hasValidWriteOrigin,
  readJsonBody,
} from "@/lib/security/write-request";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ids(
  context: { params: Promise<{ familyId: string; teamEventId: string }> },
) {
  const { familyId, teamEventId } = await context.params;
  return {
    familyId,
    teamEventId,
    valid: isUuid(familyId) && isUuid(teamEventId),
  };
}

function rsvpInput(value: unknown):
  | { ok: true; memberId: string; response: HockeyFamilyRsvpResponse }
  | { ok: false } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false };
  }

  const record = value as Record<string, unknown>;
  const memberId =
    typeof record.memberId === "string" ? record.memberId.trim() : "";
  const response = record.response;

  if (
    !isUuid(memberId) ||
    typeof response !== "string" ||
    !HOCKEY_FAMILY_RSVP_RESPONSES.includes(
      response as HockeyFamilyRsvpResponse,
    )
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    memberId,
    response: response as HockeyFamilyRsvpResponse,
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ familyId: string; teamEventId: string }> },
) {
  const gate = await requireHockeyFamilyApiUser();
  if (!gate.ok) return gate.response;

  const resolved = await ids(context);
  if (!resolved.valid) {
    return jsonResponse(
      { ok: false, message: "Invalid family or event identifier." },
      400,
    );
  }

  try {
    const rsvp = await listHockeyFamilyEventRsvps({
      authUserId: gate.user.id,
      familyId: resolved.familyId,
      teamEventId: resolved.teamEventId,
    });
    return jsonResponse({ ok: true, rsvp }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-family-rsvp-read",
      error,
      "Family RSVP could not be loaded.",
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ familyId: string; teamEventId: string }> },
) {
  if (!hasValidWriteOrigin(request)) {
    return jsonResponse(
      { ok: false, message: "The request origin could not be verified." },
      403,
    );
  }

  const gate = await requireHockeyFamilyApiUser();
  if (!gate.ok) return gate.response;

  const resolved = await ids(context);
  if (!resolved.valid) {
    return jsonResponse(
      { ok: false, message: "Invalid family or event identifier." },
      400,
    );
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonResponse({ ok: false, message: body.message }, body.status);
  }

  const input = rsvpInput(body.body);
  if (!input.ok) {
    return jsonResponse(
      {
        ok: false,
        message: "Choose a child and a valid event response.",
      },
      400,
    );
  }

  try {
    const response = await saveHockeyFamilyEventRsvp({
      authUserId: gate.user.id,
      familyId: resolved.familyId,
      teamEventId: resolved.teamEventId,
      memberId: input.memberId,
      response: input.response,
    });
    return jsonResponse({ ok: true, response }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-family-rsvp-write",
      error,
      "Family RSVP could not be saved.",
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ familyId: string; teamEventId: string }> },
) {
  if (!hasValidWriteOrigin(request)) {
    return jsonResponse(
      { ok: false, message: "The request origin could not be verified." },
      403,
    );
  }

  const gate = await requireHockeyFamilyApiUser();
  if (!gate.ok) return gate.response;

  const resolved = await ids(context);
  if (!resolved.valid) {
    return jsonResponse(
      { ok: false, message: "Invalid family or event identifier." },
      400,
    );
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonResponse({ ok: false, message: body.message }, body.status);
  }

  const record =
    body.body && typeof body.body === "object" && !Array.isArray(body.body)
      ? (body.body as Record<string, unknown>)
      : {};
  const memberId =
    typeof record.memberId === "string" ? record.memberId.trim() : "";

  if (!isUuid(memberId)) {
    return jsonResponse({ ok: false, message: "Invalid child identifier." }, 400);
  }

  try {
    const result = await deleteHockeyFamilyEventRsvp({
      authUserId: gate.user.id,
      familyId: resolved.familyId,
      teamEventId: resolved.teamEventId,
      memberId,
    });
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-family-rsvp-delete",
      error,
      "Family RSVP could not be removed.",
    );
  }
}
