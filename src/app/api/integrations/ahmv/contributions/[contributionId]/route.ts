import { NextResponse } from "next/server";
import { verifyAhmvContentRequest } from "@/lib/contributions/ahmv-auth";
import { getAhmvContributionStatus } from "@/lib/contributions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ contributionId: string }> },
) {
  const auth = verifyAhmvContentRequest(request.headers);
  if (!auth.valid) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { contributionId } = await context.params;
  try {
    const contribution = await getAhmvContributionStatus(contributionId);
    if (!contribution) {
      return NextResponse.json({ ok: false, error: "Contribution not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, contribution }, {
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "CONTRIBUTION_READ_FAILED" },
      { status: 503 },
    );
  }
}
