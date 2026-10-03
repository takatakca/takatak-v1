import { NextRequest, NextResponse } from "next/server";

import { serveAds } from "@/lib/ads/ad-server";
import type { AdsTargetingContext } from "@/lib/ads/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function withCors(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function OPTIONS(): Promise<NextResponse> {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid_body");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return withCors(
      NextResponse.json(
        { ok: false, message: "Invalid request." },
        { status: 400 },
      ),
    );
  }

  const publisherCode =
    typeof body.publisherCode === "string"
      ? body.publisherCode.trim()
      : "";
  const placementCode =
    typeof body.placementCode === "string"
      ? body.placementCode.trim()
      : "";

  if (!publisherCode || !placementCode) {
    return withCors(
      NextResponse.json(
        {
          ok: false,
          message: "publisherCode and placementCode are required.",
        },
        { status: 400 },
      ),
    );
  }

  const context =
    body.context &&
    typeof body.context === "object" &&
    !Array.isArray(body.context)
      ? (body.context as AdsTargetingContext)
      : undefined;

  try {
    const ad = await serveAds({
      publisherCode,
      placementCode,
      context,
    });

    return withCors(
      NextResponse.json(
        { ok: true, filled: Boolean(ad), ad },
        { status: 200 },
      ),
    );
  } catch (error) {
    console.error(
      "[ads-serve] Failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return withCors(
      NextResponse.json(
        { ok: false, filled: false, ad: null },
        { status: 503 },
      ),
    );
  }
}
