import { NextResponse } from "next/server";
import { verifyAhmvContentRequest } from "@/lib/contributions/ahmv-auth";
import { getAhmvContributorSnapshot } from "@/lib/contributions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = verifyAhmvContentRequest(request.headers);
  if (!auth.valid) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const authUserId = url.searchParams.get("authUserId")?.trim() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(authUserId)) {
    return NextResponse.json({ ok: false, error: "Invalid contributor identity." }, { status: 400 });
  }

  try {
    const contributor = await getAhmvContributorSnapshot(authUserId);
    return NextResponse.json({ ok: true, contributor }, {
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "REPUTATION_READ_FAILED" },
      { status: 503 },
    );
  }
}
