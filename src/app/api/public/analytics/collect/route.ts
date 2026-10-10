import { NextRequest, NextResponse } from "next/server";

import { parseCollectPayload } from "@/lib/analytics/parse";
import { recordAnalyticsEvent } from "@/lib/analytics/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 4096;

function done(status: number, allowOrigin: string | null): NextResponse {
  const response = new NextResponse(null, { status });
  response.headers.set("Cache-Control", "no-store");
  if (allowOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowOrigin);
    response.headers.set("Vary", "Origin");
  }
  return response;
}

export async function OPTIONS(): Promise<NextResponse> {
  // The tracker only sends CORS-safelisted text/plain beacons, so no preflight is needed.
  return done(204, null);
}

/** Beacon endpoint for public/takatak-analytics.js. Body: JSON sent as text/plain. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return done(413, null);
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return done(413, null);
    raw = JSON.parse(text);
  } catch {
    return done(400, null);
  }
  const payload = parseCollectPayload(raw);
  if (!payload) return done(400, null);
  try {
    const result = await recordAnalyticsEvent(payload, request.headers);
    return result.ok ? done(204, result.allowOrigin) : done(result.status, result.allowOrigin);
  } catch {
    console.error("[analytics] collect failed");
    return done(503, null);
  }
}
