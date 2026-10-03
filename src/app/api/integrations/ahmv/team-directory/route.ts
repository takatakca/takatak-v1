import { NextResponse } from "next/server";

import { applyAhmvTeamDirectory } from "@/lib/hockey/family/team-directory-service";
import { parseAhmvTeamDirectoryEnvelope } from "@/lib/hockey/family/team-directory-parser";
import { verifyAhmvTeamEventRequest } from "@/lib/hockey/events/signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAXIMUM_BODY_SIZE = 120_000;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { accepted: false, error: "Content-Type must be application/json." },
      { status: 415 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAXIMUM_BODY_SIZE) {
    return NextResponse.json(
      { accepted: false, error: "Payload too large." },
      { status: 413 },
    );
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAXIMUM_BODY_SIZE) {
    return NextResponse.json(
      { accepted: false, error: "Payload too large." },
      { status: 413 },
    );
  }

  // Team directory and team events share the same dedicated AHMV signed
  // server-to-server integration boundary.
  const verification = verifyAhmvTeamEventRequest(rawBody, request.headers);
  if (!verification.valid) {
    return NextResponse.json(
      { accepted: false, error: verification.error },
      { status: verification.status },
    );
  }

  const parsed = parseAhmvTeamDirectoryEnvelope(rawBody);
  if (!parsed.valid) {
    return NextResponse.json(
      { accepted: false, error: parsed.error },
      { status: 400 },
    );
  }

  if (parsed.envelope.eventId !== verification.eventId) {
    return NextResponse.json(
      { accepted: false, error: "Event ID header and body do not match." },
      { status: 401 },
    );
  }

  try {
    const result = await applyAhmvTeamDirectory(parsed.envelope);
    return NextResponse.json({ accepted: true, ...result }, { status: 200 });
  } catch (error) {
    console.error(
      "[ahmv-team-directory] Synchronization failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return NextResponse.json(
      {
        accepted: false,
        error: "AHMV public team directory could not be synchronized.",
        retryable: true,
      },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  }
}
