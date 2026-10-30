import type { NextRequest, NextResponse } from "next/server";

import { json } from "@/lib/ai-credits/http";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { readJsonBody } from "@/lib/security/write-request";
import { MAX_PROMPT_CHARS } from "@/lib/takbot/catalog";
import { runTakbot } from "@/lib/takbot/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUEST_ID = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * POST { mode, engine, prompt, requestId } — one TAK bot request for the
 * active workspace. Same-origin only; credits are debited before the relay
 * and refunded when the engine fails. requestId makes a retry safe.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = await readJsonBody(request, 16_384);
  if (!parsed.ok) return json({ ok: false, code: "invalid_request", message: parsed.message }, parsed.status);
  const body = (parsed.body ?? {}) as Record<string, unknown>;
  const mode = typeof body.mode === "string" ? body.mode : "";
  const engine = typeof body.engine === "string" ? body.engine : "auto";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (!prompt || prompt.length > MAX_PROMPT_CHARS || !REQUEST_ID.test(requestId)) {
    return json({ ok: false, code: "invalid_request" }, 400);
  }

  let clientId: string;
  try {
    const { access } = await getServerAccessContext();
    if (access.mode !== "client_scoped") {
      return json({ ok: false, code: "profileId" in access ? "workspace_required" : "sign_in_required" }, 401);
    }
    if (!hasEffectivePermission(access, "create_content")) return json({ ok: false, code: "forbidden" }, 403);
    clientId = access.activeClientId;
  } catch {
    return json({ ok: false, code: "sign_in_required" }, 401);
  }

  try {
    const result = await runTakbot({ clientId, mode, engine, prompt, requestId });
    if (!result.ok) return json({ ok: false, code: result.code, balance: result.balance ?? null }, result.status);
    return json(result, 201);
  } catch {
    console.error("[takbot] run failed");
    return json({ ok: false, code: "unavailable" }, 503);
  }
}
