import type { NextRequest, NextResponse } from "next/server";
import { verifyGatewayRequest } from "@/lib/ai-credits/gateway-auth";
import { json, readJsonObject, UUID_PATTERN } from "@/lib/ai-credits/http";
import { publishReviewRunReply } from "@/lib/reputation/review-publisher";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Execute only the stored approved provider payload; never accept a browser tenant. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = verifyGatewayRequest(request.headers);
  if (!auth.ok) return json({ ok: false, message: auth.message }, auth.status);
  const body = await readJsonObject(request);
  const runId = typeof body?.runId === "string" ? body.runId : "";
  if (!UUID_PATTERN.test(runId) || typeof body?.comment !== "string")
    return json({ ok: false, code: "invalid_request" }, 400);
  try {
    const result = await publishReviewRunReply(runId, body.comment);
    if (result.ok) return json(result, result.replayed ? 200 : 201);
    const status =
      result.code === "not_found"
        ? 404
        : ["approval_required", "agent_disabled", "plan_required"].includes(
              result.code,
            )
          ? 403
          : ["database_unavailable", "not_configured"].includes(result.code)
            ? 503
            : 409;
    return json(result, status);
  } catch {
    console.error(
      "[ai-reviews] Publication outcome unavailable; verify source before retry.",
    );
    return json({ ok: false, code: "publication_uncertain" }, 503);
  }
}
