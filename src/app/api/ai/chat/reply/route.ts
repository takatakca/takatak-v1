import type { NextRequest, NextResponse } from "next/server";

import { authorizeAgentRun } from "@/lib/ai-agents/service";
import { verifyGatewayRequest } from "@/lib/ai-credits/gateway-auth";
import { json, readJsonObject, UUID_PATTERN } from "@/lib/ai-credits/http";
import { cleanMessage, postAiReply } from "@/lib/chat/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST { runId, body } — posts the AI reply into the run's conversation.
 * Allowed only in the execute phase (after human approval) or, when the
 * client turned approval off, while generating. Then report the run as usual.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = verifyGatewayRequest(request.headers);
  if (!auth.ok) return json({ ok: false, message: auth.message }, auth.status);
  const payload = await readJsonObject(request);
  const runId = typeof payload?.runId === "string" ? payload.runId : "";
  const body = cleanMessage(payload?.body);
  if (!UUID_PATTERN.test(runId) || !body) return json({ ok: false, code: "invalid_request" }, 400);
  try {
    const authority = await authorizeAgentRun(runId, "chat_concierge");
    if (!authority.ok) return json(authority, authority.code === "not_found" ? 404 : 409);
    if (!authority.run.canAct) return json({ ok: false, code: "approval_required" }, 403);
    const conversationId = String(authority.run.input.conversationId ?? "");
    if (!UUID_PATTERN.test(conversationId)) return json({ ok: false, code: "not_found" }, 404);
    const posted = await postAiReply(authority.run.clientId, conversationId, body);
    if (!posted) return json({ ok: false, code: "conversation_closed" }, 409);
    return json({ ok: true }, 201);
  } catch {
    console.error("[ai-chat] reply failed");
    return json({ ok: false, message: "Unavailable." }, 503);
  }
}
