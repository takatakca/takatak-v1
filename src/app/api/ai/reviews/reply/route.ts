import type { NextRequest, NextResponse } from "next/server";

import { authorizeAgentRun } from "@/lib/ai-agents/service";
import { verifyGatewayRequest } from "@/lib/ai-credits/gateway-auth";
import { json, readJsonObject, UUID_PATTERN } from "@/lib/ai-credits/http";
import { replyToGoogleReview } from "@/lib/integrations/google-business/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST { runId, comment } — publishes the Review Responder's reply on Google.
 * Only for a Google review run, in the execute phase (after human approval)
 * or when the client turned approval off for the responder.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = verifyGatewayRequest(request.headers);
  if (!auth.ok) return json({ ok: false, message: auth.message }, auth.status);
  const body = await readJsonObject(request);
  const runId = typeof body?.runId === "string" ? body.runId : "";
  const comment = typeof body?.comment === "string" ? body.comment : "";
  if (!UUID_PATTERN.test(runId) || !comment.trim()) return json({ ok: false, code: "invalid_request" }, 400);
  try {
    const authority = await authorizeAgentRun(runId, "review_responder");
    if (!authority.ok) return json(authority, authority.code === "not_found" ? 404 : 409);
    if (!authority.run.canAct) return json({ ok: false, code: "approval_required" }, 403);
    const reviewId = String(authority.run.input.reviewResponseId ?? "");
    if (authority.run.input.source !== "google" || !UUID_PATTERN.test(reviewId)) return json({ ok: false, code: "not_a_google_review" }, 409);
    const result = await replyToGoogleReview(authority.run.clientId, reviewId, comment);
    return result.ok ? json({ ok: true }, 201) : json({ ok: false, code: result.reason }, 502);
  } catch {
    console.error("[ai-reviews] reply failed");
    return json({ ok: false, message: "Unavailable." }, 503);
  }
}
