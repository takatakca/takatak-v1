import { NextRequest, NextResponse } from "next/server";

import { serveAds } from "@/lib/ads/ad-server";
import { readPublicAdsJson, sanitizePublicAdsContext } from "@/lib/ads/public-request";

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
  const parsed = await readPublicAdsJson(request);
  if (!parsed.ok) {
    return withCors(
      NextResponse.json(
        { ok: false, message: parsed.message },
        { status: parsed.status },
      ),
    );
  }
  const body = parsed.body;

  const publisherCode =
    typeof body.publisherCode === "string"
      ? body.publisherCode.trim()
      : "";
  const placementCode =
    typeof body.placementCode === "string"
      ? body.placementCode.trim()
      : "";

  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(publisherCode) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(placementCode)
  ) {
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

  const context = sanitizePublicAdsContext(body.context);

  try {
    const ad = await serveAds({
      publisherCode,
      placementCode,
      context,
      callerOrigin: request.headers.get("origin"),
    });

    const responseAd =
      ad && ad.trackingToken
        ? {
            ...ad,
            clickUrl: new URL(
              `/api/ads/click?t=${encodeURIComponent(ad.trackingToken)}`,
              request.nextUrl.origin,
            ).toString(),
          }
        : ad;

    return withCors(
      NextResponse.json(
        {
          ok: true,
          filled: Boolean(responseAd),
          ad: responseAd,
        },
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
