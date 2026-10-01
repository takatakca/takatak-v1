import { NextResponse } from "next/server";

import { resolveOneLvMerchant } from "@/lib/integrations/one-lv/master";
import { readAuthorizedOneLvJson } from "@/lib/integrations/one-lv/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const input = await readAuthorizedOneLvJson(request);
  if (!input.ok) return input.response;

  if (!input.body || typeof input.body !== "object" || Array.isArray(input.body)) {
    return NextResponse.json({ error: "Invalid merchant payload." }, { status: 400 });
  }

  try {
    const result = await resolveOneLvMerchant(
      input.body as Record<string, unknown>,
    );
    return NextResponse.json({
      id: result.id,
      client_id: result.clientId,
    });
  } catch {
    return NextResponse.json(
      { error: "Merchant resolution failed." },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  }
}
