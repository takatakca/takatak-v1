import { NextRequest } from "next/server";

import { requireHockeyFamilyApiUser } from "@/lib/hockey/family/api-auth";
import { revokeHockeyFamilyGuardianInvite } from "@/lib/hockey/family/guardian-invite-service";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { hasValidWriteOrigin } from "@/lib/security/write-request";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ familyId: string; inviteId: string }> },
) {
  if (!hasValidWriteOrigin(request)) {
    return jsonResponse(
      { ok: false, message: "The request origin could not be verified." },
      403,
    );
  }

  const gate = await requireHockeyFamilyApiUser();
  if (!gate.ok) return gate.response;

  const { familyId, inviteId } = await context.params;
  if (!isUuid(familyId) || !isUuid(inviteId)) {
    return jsonResponse(
      { ok: false, message: "Invalid family or invitation identifier." },
      400,
    );
  }

  try {
    const result = await revokeHockeyFamilyGuardianInvite({
      authUserId: gate.user.id,
      familyId,
      inviteId,
    });
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-family-invite-revoke",
      error,
      "Guardian invitation could not be revoked.",
    );
  }
}
