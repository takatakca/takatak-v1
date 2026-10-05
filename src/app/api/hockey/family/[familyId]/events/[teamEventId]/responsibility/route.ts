import { NextRequest } from "next/server";

import { requireHockeyFamilyApiUser } from "@/lib/hockey/family/api-auth";
import {
  deleteHockeyFamilyEventPlan,
  HOCKEY_FAMILY_PLAN_STATUSES,
  listHockeyFamilyEventPlans,
  saveHockeyFamilyEventPlan,
  type HockeyFamilyPlanStatus,
} from "@/lib/hockey/family/game-logistics-service";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import {
  hasValidWriteOrigin,
  readJsonBody,
} from "@/lib/security/write-request";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ids(
  context: {
    params: Promise<{ familyId: string; teamEventId: string }>;
  },
) {
  const { familyId, teamEventId } = await context.params;
  return {
    familyId,
    teamEventId,
    valid: isUuid(familyId) && isUuid(teamEventId),
  };
}

function planInput(value: unknown):
  | {
      ok: true;
      childMemberId: string;
      driverMemberId: string;
      status: HockeyFamilyPlanStatus;
    }
  | { ok: false } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false };
  }

  const record = value as Record<string, unknown>;
  const childMemberId =
    typeof record.childMemberId === "string"
      ? record.childMemberId.trim()
      : "";
  const driverMemberId =
    typeof record.driverMemberId === "string"
      ? record.driverMemberId.trim()
      : "";
  const status = record.status;

  if (
    !isUuid(childMemberId) ||
    !isUuid(driverMemberId) ||
    typeof status !== "string" ||
    !HOCKEY_FAMILY_PLAN_STATUSES.includes(status as HockeyFamilyPlanStatus)
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    childMemberId,
    driverMemberId,
    status: status as HockeyFamilyPlanStatus,
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
    const logistics = await listHockeyFamilyEventPlans({
      authUserId: gate.user.id,
      familyId: resolved.familyId,
      teamEventId: resolved.teamEventId,
    });
    return jsonResponse({ ok: true, logistics }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-family-game-logistics-read",
      error,
      "Family game coordination could not be loaded.",
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

  const input = planInput(body.body);
  if (!input.ok) {
    return jsonResponse(
      {
        ok: false,
        message:
          "Choose a child, an authenticated family guardian and a valid responsibility status.",
      },
      400,
    );
  }

  try {
    const plan = await saveHockeyFamilyEventPlan({
      authUserId: gate.user.id,
      familyId: resolved.familyId,
      teamEventId: resolved.teamEventId,
      childMemberId: input.childMemberId,
      driverMemberId: input.driverMemberId,
      status: input.status,
    });
    return jsonResponse({ ok: true, plan }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-family-game-logistics-write",
      error,
      "Family game coordination could not be saved.",
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
  const childMemberId =
    typeof record.childMemberId === "string"
      ? record.childMemberId.trim()
      : "";

  if (!isUuid(childMemberId)) {
    return jsonResponse(
      { ok: false, message: "Invalid child identifier." },
      400,
    );
  }

  try {
    const result = await deleteHockeyFamilyEventPlan({
      authUserId: gate.user.id,
      familyId: resolved.familyId,
      teamEventId: resolved.teamEventId,
      childMemberId,
    });
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-family-game-logistics-delete",
      error,
      "Family game coordination could not be removed.",
    );
  }
}
