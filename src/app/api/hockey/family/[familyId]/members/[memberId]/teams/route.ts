import { NextRequest } from "next/server";

import { requireHockeyFamilyApiUser } from "@/lib/hockey/family/api-auth";
import {
  addHockeyFamilyTeamSelection,
  removeHockeyFamilyTeamSelection,
  type HockeyFamilySelectionType,
} from "@/lib/hockey/family/family-service";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import {
  hasValidWriteOrigin,
  readJsonBody,
} from "@/lib/security/write-request";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function selectionInput(value: unknown):
  | { ok: true; teamId: string; selectionType: HockeyFamilySelectionType }
  | { ok: false } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false };
  }

  const record = value as Record<string, unknown>;
  const teamId =
    typeof record.teamId === "string" ? record.teamId.trim() : "";
  const selectionType = record.selectionType;

  if (
    !teamId ||
    teamId.length > 160 ||
    (selectionType !== "assigned" && selectionType !== "favorite")
  ) {
    return { ok: false };
  }

  return { ok: true, teamId, selectionType };
}

async function identifiers(
  context: {
    params: Promise<{ familyId: string; memberId: string }>;
  },
) {
  const { familyId, memberId } = await context.params;
  return {
    familyId,
    memberId,
    valid: isUuid(familyId) && isUuid(memberId),
  };
}

export async function PUT(
  request: NextRequest,
  context: {
    params: Promise<{ familyId: string; memberId: string }>;
  },
) {
  if (!hasValidWriteOrigin(request)) {
    return jsonResponse(
      { ok: false, message: "The request origin could not be verified." },
      403,
    );
  }

  const gate = await requireHockeyFamilyApiUser();
  if (!gate.ok) return gate.response;

  const ids = await identifiers(context);
  if (!ids.valid) {
    return jsonResponse(
      { ok: false, message: "Invalid family or member identifier." },
      400,
    );
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonResponse({ ok: false, message: body.message }, body.status);
  }

  const selection = selectionInput(body.body);
  if (!selection.ok) {
    return jsonResponse(
      {
        ok: false,
        message: "Choose an exact team ID and a valid selection type.",
      },
      400,
    );
  }

  try {
    const result = await addHockeyFamilyTeamSelection({
      authUserId: gate.user.id,
      familyId: ids.familyId,
      memberId: ids.memberId,
      teamId: selection.teamId,
      selectionType: selection.selectionType,
    });
    return jsonResponse({ ok: true, selection: result }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-family-team-add",
      error,
      "Team selection could not be saved.",
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{ familyId: string; memberId: string }>;
  },
) {
  if (!hasValidWriteOrigin(request)) {
    return jsonResponse(
      { ok: false, message: "The request origin could not be verified." },
      403,
    );
  }

  const gate = await requireHockeyFamilyApiUser();
  if (!gate.ok) return gate.response;

  const ids = await identifiers(context);
  if (!ids.valid) {
    return jsonResponse(
      { ok: false, message: "Invalid family or member identifier." },
      400,
    );
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonResponse({ ok: false, message: body.message }, body.status);
  }

  const selection = selectionInput(body.body);
  if (!selection.ok) {
    return jsonResponse(
      {
        ok: false,
        message: "Choose an exact team ID and a valid selection type.",
      },
      400,
    );
  }

  try {
    const result = await removeHockeyFamilyTeamSelection({
      authUserId: gate.user.id,
      familyId: ids.familyId,
      memberId: ids.memberId,
      teamId: selection.teamId,
      selectionType: selection.selectionType,
    });
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-family-team-remove",
      error,
      "Team selection could not be removed.",
    );
  }
}
