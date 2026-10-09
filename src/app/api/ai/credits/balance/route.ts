import type { NextRequest, NextResponse } from "next/server";

import { verifyGatewayRequest } from "@/lib/ai-credits/gateway-auth";
import { json, UUID_PATTERN } from "@/lib/ai-credits/http";
import { getCreditSnapshot } from "@/lib/ai-credits/ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET ?clientId= — current balance, so the gateway can refuse work up front. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = verifyGatewayRequest(request.headers);
  if (!auth.ok) return json({ ok: false, message: auth.message }, auth.status);
  const clientId = request.nextUrl.searchParams.get("clientId") ?? "";
  if (!UUID_PATTERN.test(clientId)) return json({ ok: false, code: "invalid_request" }, 400);
  try {
    const { balance } = await getCreditSnapshot(clientId);
    return json({ ok: true, clientId, balance });
  } catch {
    console.error("[ai-credits] balance failed");
    return json({ ok: false, message: "Ledger unavailable." }, 503);
  }
}
