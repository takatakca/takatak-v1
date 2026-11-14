import { NextRequest, NextResponse } from "next/server";

import { recordPublicAdsEvent } from "@/lib/ads/ad-server";
import { verifyAdsTrackingToken } from "@/lib/ads/tracking-token";
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

  const trackingToken =
    typeof body.trackingToken === "string"
      ? body.trackingToken.trim()
      : "";
  const eventType =
    body.eventType === "impression" || body.eventType === "click"
      ? body.eventType
      : null;

  if (
    !trackingToken ||
    trackingToken.length > 2048 ||
    !eventType
  ) {
    return withCors(
      NextResponse.json(
        {
          ok: false,
          message: "A valid trackingToken and public eventType are required.",
        },
        { status: 400 },
      ),
    );
  }

  const payload = verifyAdsTrackingToken(trackingToken);
  if (!payload) {
    return withCors(
      NextResponse.json(
        { ok: false, message: "Tracking token is invalid or expired." },
        { status: 401 },
      ),
    );
  }

  const context = sanitizePublicAdsContext(body.context);

  try {
    const result = await recordPublicAdsEvent({
      campaignId: payload.campaignId,
      creativeId: payload.creativeId,
      placementId: payload.placementId,
      nonce: payload.nonce,
      eventType,
      context,
    });

    return withCors(
      NextResponse.json(
        {
          ok: true,
          recorded: !result.duplicate,
          duplicate: result.duplicate,
        },
        { status: 200 },
      ),
    );
  } catch (error) {
    console.error(
      "[ads-events] Failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return withCors(
      NextResponse.json(
        { ok: false, message: "Ad event could not be recorded." },
        { status: 503 },
      ),
    );
  }
}
