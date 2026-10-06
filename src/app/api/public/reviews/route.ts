import { NextRequest, NextResponse } from "next/server";

import { getReviewShowcase } from "@/lib/reputation/service";
import { PUBLIC_SLUG_PATTERN } from "@/lib/reputation/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET ?p=<review page slug>&n=<count>
 * Public, read-only showcase for public/takatak-reviews.js. Only consented
 * 4–5★ comments (first name only); the average covers every rating.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const slug = request.nextUrl.searchParams.get("p") ?? "";
  const limit = Number(request.nextUrl.searchParams.get("n") ?? "6");
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=300, s-maxage=300",
  };
  if (!PUBLIC_SLUG_PATTERN.test(slug)) return NextResponse.json({ ok: false }, { status: 404, headers });
  try {
    const showcase = await getReviewShowcase(slug, Number.isFinite(limit) ? limit : 6);
    if (!showcase) return NextResponse.json({ ok: false }, { status: 404, headers });
    return NextResponse.json({ ok: true, ...showcase }, { headers });
  } catch {
    console.error("[reviews] showcase failed");
    return NextResponse.json({ ok: false }, { status: 503, headers: { ...headers, "Cache-Control": "no-store" } });
  }
}
