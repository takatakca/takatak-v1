import type { NextRequest, NextResponse } from "next/server";

import { verifyGatewayRequest } from "@/lib/ai-credits/gateway-auth";
import { json, ledgerResponse, readJsonObject, UUID_PATTERN } from "@/lib/ai-credits/http";
import { debitCredits } from "@/lib/ai-credits/ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST { clientId, actionKey, units?, idempotencyKey }
 * Cost is computed server-side from the credit catalog; callers cannot set it.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = verifyGatewayRequest(request.headers);
  if (!auth.ok) return json({ ok: false, message: auth.message }, auth.status);
  const body = await readJsonObject(request);
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const actionKey = typeof body?.actionKey === "string" ? body.actionKey : "";
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : "";
  const units = body?.units === undefined ? 1 : Number(body.units);
  if (!UUID_PATTERN.test(clientId) || !actionKey || !idempotencyKey) {
    return json({ ok: false, code: "invalid_request" }, 400);
  }
  try {
    return ledgerResponse(await debitCredits({ clientId, actionKey, units, idempotencyKey }));
  } catch {
    console.error("[ai-credits] debit failed");
    return json({ ok: false, message: "Ledger unavailable." }, 503);
  }
}
