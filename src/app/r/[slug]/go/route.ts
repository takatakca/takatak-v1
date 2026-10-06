import { NextRequest, NextResponse } from "next/server";

import { resolvePublicReviewDestination } from "@/lib/reputation/service";
import { PUBLIC_SLUG_PATTERN } from "@/lib/reputation/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  const { slug } = await params;
  const target = request.nextUrl.searchParams.get("to") === "facebook" ? "facebook" : "google";
  const responseId = request.nextUrl.searchParams.get("r");
  if (!PUBLIC_SLUG_PATTERN.test(slug)) return new NextResponse("Not found", { status: 404 });
  try {
    const destination = await resolvePublicReviewDestination(slug, responseId, target);
    if (!destination) return new NextResponse("Not found", { status: 404 });
    const response = NextResponse.redirect(destination, 302);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return new NextResponse("Temporarily unavailable", { status: 503 });
  }
}
