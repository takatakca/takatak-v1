import { NextRequest } from "next/server";

import { requireHockeyFamilyApiUser } from "@/lib/hockey/family/api-auth";
import {
  createHockeyFamilyGuardianInvite,
  listHockeyFamilyGuardianInvites,
} from "@/lib/hockey/family/guardian-invite-service";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { hasValidWriteOrigin } from "@/lib/security/write-request";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ familyId: string }> },
) {
  const gate = await requireHockeyFamilyApiUser();
  if (!gate.ok) return gate.response;

  const { familyId } = await context.params;
  if (!isUuid(familyId)) {
    return jsonResponse({ ok: false, message: "Invalid family identifier." }, 400);
  }

  try {
    const invites = await listHockeyFamilyGuardianInvites({
      authUserId: gate.user.id,
      familyId,
    });
    return jsonResponse({ ok: true, invites }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-family-invites-list",
      error,
      "Guardian invitations could not be loaded.",
    );
  }
}

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

  try {
    const result = await createHockeyFamilyGuardianInvite({
      authUserId: gate.user.id,
      familyId,
    });
    return jsonResponse({ ok: true, ...result }, 201);
  } catch (error) {
    return handleApiError(
      "hockey-family-invite-create",
      error,
      "Guardian invitation could not be created.",
    );
  }
}
