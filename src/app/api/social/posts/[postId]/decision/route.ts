import { NextRequest, NextResponse } from "next/server";

import { assertClientCanUseApprovals } from "@/lib/billing/social/entitlement-gates";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { decideSocialPostApproval } from "@/lib/social/publishing/approval-actions";
import { parseApprovalDecision, record } from "@/lib/social/publishing/publication-model";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { decision: "approve" | "reject" | "request_changes", comment?: string } */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> },
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("approve_content");
  if (!gate.ok) return gate.response;

  const { postId } = await context.params;
  if (!isUuid(postId)) {
    return jsonResponse({ ok: false, message: "The post identifier is invalid." }, 400);
  }

  const body = await readJsonBody(request, 8_192);
  if (!body.ok) return jsonResponse({ ok: false, message: body.message }, body.status);
  const raw = record(body.body);
  const decision = parseApprovalDecision(raw.decision);
  if (!decision) {
    return jsonResponse({ ok: false, message: "The decision must be approve, reject or request_changes." }, 400);
  }
  const comment = typeof raw.comment === "string" ? raw.comment : null;
  if (comment && comment.length > 2_000) {
    return jsonResponse({ ok: false, message: "The comment is too long." }, 400);
  }

  try {
    await assertClientCanUseApprovals(gate.access.activeClientId);
    const result = await decideSocialPostApproval({
      clientId: gate.access.activeClientId,
      socialPostId: postId,
      reviewerProfileId: gate.access.profileId ?? null,
      decision,
      comment,
    });
    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : result.reason === "unavailable" ? 503 : 409;
      return jsonResponse({ ok: false, code: result.reason }, status);
    }
    return jsonResponse({ ...result }, 200);
  } catch (error) {
    return handleApiError("social-post-decision", error, "The decision could not be saved.");
  }
}
