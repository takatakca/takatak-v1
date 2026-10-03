import { NextRequest, NextResponse } from "next/server";

import { recordPublicAdsEvent } from "@/lib/ads/ad-server";
import { verifyAdsTrackingToken } from "@/lib/ads/tracking-token";
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

  const trackingToken =
    typeof body.trackingToken === "string"
      ? body.trackingToken.trim()
      : "";
  const eventType =
    body.eventType === "impression" || body.eventType === "click"
      ? body.eventType
      : null;

  if (!trackingToken || !eventType) {
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

  const context =
    body.context &&
    typeof body.context === "object" &&
    !Array.isArray(body.context)
      ? (body.context as AdsTargetingContext)
      : undefined;

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
