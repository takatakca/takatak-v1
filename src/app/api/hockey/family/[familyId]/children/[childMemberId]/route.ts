import { NextRequest } from "next/server";

import { requireHockeyFamilyApiUser } from "@/lib/hockey/family/api-auth";
import {
  deactivateHockeyFamilyChild,
  updateHockeyFamilyChild,
} from "@/lib/hockey/family/child-lifecycle-service";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import {
  hasValidWriteOrigin,
  readJsonBody,
} from "@/lib/security/write-request";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveIds(
  context: {
    params: Promise<{ familyId: string; childMemberId: string }>;
  },
) {
  const { familyId, childMemberId } = await context.params;
  return {
    familyId,
    childMemberId,
    valid: isUuid(familyId) && isUuid(childMemberId),
  };
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ familyId: string; childMemberId: string }>;
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

  const ids = await resolveIds(context);
  if (!ids.valid) {
    return jsonResponse(
      { ok: false, message: "Invalid family or child identifier." },
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

  const displayName =
    record.displayName === undefined
      ? undefined
      : typeof record.displayName === "string"
        ? record.displayName
        : null;
  const status =
    record.status === undefined
      ? undefined
      : record.status === "active" || record.status === "inactive"
        ? record.status
        : null;

  if (displayName === null || status === null) {
    return jsonResponse(
      { ok: false, message: "Invalid child profile update." },
      400,
    );
  }

  try {
    const result = await updateHockeyFamilyChild({
      authUserId: gate.user.id,
      familyId: ids.familyId,
      childMemberId: ids.childMemberId,
      ...(displayName !== undefined ? { displayName } : {}),
      ...(status !== undefined ? { status } : {}),
    });
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-family-child-update",
      error,
      "Child hockey profile could not be updated.",
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{ familyId: string; childMemberId: string }>;
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

  const ids = await resolveIds(context);
  if (!ids.valid) {
    return jsonResponse(
      { ok: false, message: "Invalid family or child identifier." },
      400,
    );
  }

  try {
    const result = await deactivateHockeyFamilyChild({
      authUserId: gate.user.id,
      familyId: ids.familyId,
      childMemberId: ids.childMemberId,
    });
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-family-child-deactivate",
      error,
      "Child hockey profile could not be deactivated.",
    );
  }
}
