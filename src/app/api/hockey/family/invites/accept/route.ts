import { NextRequest } from "next/server";

import { requireHockeyFamilyApiUser } from "@/lib/hockey/family/api-auth";
import { acceptHockeyFamilyGuardianInvite } from "@/lib/hockey/family/guardian-invite-service";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import {
  hasValidWriteOrigin,
  readJsonBody,
} from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasValidWriteOrigin(request)) {
    return jsonResponse(
      { ok: false, message: "The request origin could not be verified." },
      403,
    );
  }

  const gate = await requireHockeyFamilyApiUser();
  if (!gate.ok) return gate.response;

  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonResponse({ ok: false, message: body.message }, body.status);
  }

  const record =
    body.body && typeof body.body === "object" && !Array.isArray(body.body)
      ? (body.body as Record<string, unknown>)
      : {};
  const token = typeof record.token === "string" ? record.token.trim() : "";

  if (!token) {
    return jsonResponse(
      { ok: false, message: "Guardian invitation token is required." },
      400,
    );
  }

  try {
    const result = await acceptHockeyFamilyGuardianInvite({
      authUserId: gate.user.id,
      token,
    });
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-family-invite-accept",
      error,
      "Guardian invitation could not be accepted.",
    );
  }
}
