import { NextRequest } from "next/server";

import { requireHockeyFamilyApiUser } from "@/lib/hockey/family/api-auth";
import { deactivateHockeyFamilyGuardian } from "@/lib/hockey/family/guardian-access-service";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { hasValidWriteOrigin } from "@/lib/security/write-request";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{ familyId: string; guardianMemberId: string }>;
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

  const { familyId, guardianMemberId } = await context.params;
  if (!isUuid(familyId) || !isUuid(guardianMemberId)) {
    return jsonResponse(
      { ok: false, message: "Invalid family or guardian identifier." },
      400,
    );
  }

  try {
    const result = await deactivateHockeyFamilyGuardian({
      authUserId: gate.user.id,
      familyId,
      guardianMemberId,
    });
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-family-guardian-remove",
      error,
      "Family guardian access could not be changed.",
    );
  }
}
