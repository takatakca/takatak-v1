import type { NextRequest, NextResponse } from "next/server";

import { authorizeAgentRun } from "@/lib/ai-agents/service";
import { verifyGatewayRequest } from "@/lib/ai-credits/gateway-auth";
import { json, UUID_PATTERN } from "@/lib/ai-credits/http";
import { conversationForAgent } from "@/lib/chat/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET ?runId= — conversation history for an active Chat Concierge run. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = verifyGatewayRequest(request.headers);
  if (!auth.ok) return json({ ok: false, message: auth.message }, auth.status);
  const runId = request.nextUrl.searchParams.get("runId") ?? "";
  if (!UUID_PATTERN.test(runId)) return json({ ok: false, code: "invalid_request" }, 400);
  try {
    const authority = await authorizeAgentRun(runId, "chat_concierge");
    if (!authority.ok) return json(authority, authority.code === "not_found" ? 404 : 409);
    const conversationId = String(authority.run.input.conversationId ?? "");
    const context = UUID_PATTERN.test(conversationId) ? await conversationForAgent(authority.run.clientId, conversationId) : null;
    if (!context) return json({ ok: false, code: "not_found" }, 404);
    return json({ ok: true, canReply: authority.run.canAct, ...context });
  } catch {
    console.error("[ai-chat] context failed");
    return json({ ok: false, message: "Unavailable." }, 503);
  }
}
