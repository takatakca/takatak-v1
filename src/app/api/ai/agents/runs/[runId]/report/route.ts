import type { NextRequest, NextResponse } from "next/server";

import { reportAgentRun } from "@/lib/ai-agents/service";
import { verifyGatewayRequest } from "@/lib/ai-credits/gateway-auth";
import { json, readJsonObject, UUID_PATTERN } from "@/lib/ai-credits/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST { succeeded: boolean, output?: { summary?: string, preview?: string, ... }, creditsDebited?: number, error?: string }
 * Debit credits through /api/ai/credits/debit first; creditsDebited here is the receipt total for display.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ runId: string }> }): Promise<NextResponse> {
  const auth = verifyGatewayRequest(request.headers);
  if (!auth.ok) return json({ ok: false, message: auth.message }, auth.status);
  const { runId } = await params;
  const body = await readJsonObject(request);
  if (!UUID_PATTERN.test(runId) || !body || typeof body.succeeded !== "boolean") return json({ ok: false, code: "invalid_request" }, 400);
  try {
    const result = await reportAgentRun(runId, {
      succeeded: body.succeeded,
      output: body.output,
      creditsDebited: body.creditsDebited === undefined ? 0 : Number(body.creditsDebited),
      error: typeof body.error === "string" ? body.error : null,
    });
    if (!result.ok) return json(result, result.code === "not_found" ? 404 : result.code === "not_claimed" ? 409 : 400);
    return json(result);
  } catch {
    console.error("[ai-agents] report failed");
    return json({ ok: false, message: "Queue unavailable." }, 503);
  }
}
