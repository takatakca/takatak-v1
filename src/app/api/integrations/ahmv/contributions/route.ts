import { NextResponse } from "next/server";
import { verifyAhmvContentRequest } from "@/lib/contributions/ahmv-auth";
import { submitAhmvContribution } from "@/lib/contributions/service";
import { parseContributionInput } from "@/lib/contributions/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = verifyAhmvContentRequest(request.headers);
  if (!auth.valid) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  const input = parseContributionInput(body);
  if (!input) {
    return NextResponse.json({ ok: false, error: "Invalid contribution payload." }, { status: 400 });
  }

  try {
    const result = await submitAhmvContribution(input);
    return NextResponse.json({ ok: true, ...result }, {
      status: result.duplicate ? 200 : 201,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CONTRIBUTION_FAILED";
    const status = message === "AHMV_BRAND_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
