import { NextRequest } from "next/server";

import { addHockeyFamilyChild } from "@/lib/hockey/family/family-service";
import { requireHockeyFamilyApiUser } from "@/lib/hockey/family/api-auth";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import {
  hasValidWriteOrigin,
  readJsonBody,
} from "@/lib/security/write-request";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ familyId: string }> },
) {
  if (!hasValidWriteOrigin(request)) {
    return jsonResponse(
      { ok: false, message: "The request origin could not be verified." },
      403,
    );
  }

  const gate = await requireHockeyFamilyApiUser();
  if (!gate.ok) return gate.response;

  const { familyId } = await context.params;
  if (!isUuid(familyId)) {
    return jsonResponse({ ok: false, message: "Invalid family identifier." }, 400);
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
    typeof record.displayName === "string" ? record.displayName : "";

  try {
    const member = await addHockeyFamilyChild({
      authUserId: gate.user.id,
      familyId,
      displayName,
    });
    return jsonResponse({ ok: true, member }, 201);
  } catch (error) {
    return handleApiError(
      "hockey-family-child-create",
      error,
      "Child hockey profile could not be added.",
    );
  }
}
