import type { NextRequest, NextResponse } from "next/server";

import { claimNextAgentRun } from "@/lib/ai-agents/service";
import { verifyGatewayRequest } from "@/lib/ai-credits/gateway-auth";
import { json } from "@/lib/ai-credits/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST — the gateway claims the oldest runnable agent run.
 * 200 { ok, run: { runId, clientId, agentKey, phase: "generate"|"execute", input, output, instructions, requireApproval } }
 * 204 when there is nothing to do.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = verifyGatewayRequest(request.headers);
  if (!auth.ok) return json({ ok: false, message: auth.message }, auth.status);
  try {
    const run = await claimNextAgentRun();
    if (!run) return json(null, 204);
    return json({ ok: true, run });
  } catch {
    console.error("[ai-agents] claim failed");
    return json({ ok: false, message: "Queue unavailable." }, 503);
  }
}
