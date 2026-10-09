import type { NextRequest, NextResponse } from "next/server";

import { verifyGatewayRequest } from "@/lib/ai-credits/gateway-auth";
import { json, ledgerResponse, readJsonObject, UUID_PATTERN } from "@/lib/ai-credits/http";
import { refundDebit } from "@/lib/ai-credits/ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST { clientId, debitIdempotencyKey, note? } — refunds a failed task's debit once. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = verifyGatewayRequest(request.headers);
  if (!auth.ok) return json({ ok: false, message: auth.message }, auth.status);
  const body = await readJsonObject(request);
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const debitIdempotencyKey = typeof body?.debitIdempotencyKey === "string" ? body.debitIdempotencyKey : "";
  const note = typeof body?.note === "string" ? body.note.slice(0, 280) : null;
  if (!UUID_PATTERN.test(clientId) || !debitIdempotencyKey) return json({ ok: false, code: "invalid_request" }, 400);
  try {
    return ledgerResponse(await refundDebit({ clientId, debitIdempotencyKey, note }));
  } catch {
    console.error("[ai-credits] refund failed");
    return json({ ok: false, message: "Ledger unavailable." }, 503);
  }
}
