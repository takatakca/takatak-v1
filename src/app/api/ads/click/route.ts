import { NextRequest, NextResponse } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { recordPublicAdsEvent } from "@/lib/ads/ad-server";
import { verifyAdsTrackingToken } from "@/lib/ads/tracking-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeDestination(
  value: string,
  attributionId: string,
): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    url.searchParams.set("ttclid", attributionId);
    return url.toString();
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("t")?.trim() ?? "";
  const payload = token ? verifyAdsTrackingToken(token) : null;

  if (!payload) {
    return NextResponse.json(
      { ok: false, message: "Invalid or expired ad click." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json(
      { ok: false, message: "Ad click service unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const creative = await prisma.adCreative.findFirst({
    where: {
      id: payload.creativeId,
      campaignId: payload.campaignId,
    },
    select: {
      destinationUrl: true,
    },
  });

  const destination = creative
    ? safeDestination(creative.destinationUrl, payload.nonce)
    : null;

  if (!destination) {
    return NextResponse.json(
      { ok: false, message: "Ad destination unavailable." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    await recordPublicAdsEvent({
      campaignId: payload.campaignId,
      creativeId: payload.creativeId,
      placementId: payload.placementId,
      nonce: payload.nonce,
      eventType: "click",
    });
  } catch (error) {
    console.error(
      "[ads-click] Tracking failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
  }

  const response = NextResponse.redirect(destination, 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}
