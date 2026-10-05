import { NextResponse } from "next/server";

import { applyAhmvTeamEvent, HockeyUnknownPublicTeamError } from "@/lib/hockey/events/apply-event";
import { parseAhmvTeamEventEnvelope } from "@/lib/hockey/events/parser";
import { verifyAhmvTeamEventRequest } from "@/lib/hockey/events/signature";
import { validateAhmvEventSourceUrl } from "@/lib/hockey/events/source-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAXIMUM_BODY_SIZE = 64_000;

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
    return NextResponse.json({ accepted: false, error: "Payload too large." }, { status: 413 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAXIMUM_BODY_SIZE) {
    return NextResponse.json({ accepted: false, error: "Payload too large." }, { status: 413 });
  }

  const verification = verifyAhmvTeamEventRequest(rawBody, request.headers);
  if (!verification.valid) {
    return NextResponse.json(
      { accepted: false, error: verification.error },
      { status: verification.status },
    );
  }

  const parsed = parseAhmvTeamEventEnvelope(rawBody);
  if (!parsed.valid) {
    return NextResponse.json({ accepted: false, error: parsed.error }, { status: 400 });
  }

  if (parsed.envelope.eventId !== verification.eventId) {
    return NextResponse.json(
      { accepted: false, error: "Event ID header and body do not match." },
      { status: 401 },
    );
  }

  const sourceDecision = validateAhmvEventSourceUrl(
    parsed.envelope.event.sourceUrl,
  );
  if (!sourceDecision.allowed) {
    return NextResponse.json(
      {
        accepted: false,
        code: sourceDecision.code,
        error: sourceDecision.message,
      },
      { status: sourceDecision.status },
    );
  }

  try {
    const result = await applyAhmvTeamEvent(parsed.envelope);
    return NextResponse.json({ accepted: true, ...result }, { status: 200 });
  } catch (error) {
    if (error instanceof HockeyUnknownPublicTeamError) {
      return NextResponse.json(
        {
          accepted: false,
          code: "unknown_team",
          error:
            "The exact public team ID is not active in the verified AHMV team directory.",
          retryable: true,
        },
        { status: 409, headers: { "Retry-After": "30" } },
      );
    }

    console.error(
      "[ahmv-team-events] Apply failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return NextResponse.json(
      {
        accepted: false,
        error: "The AHMV team event could not be synchronized.",
        retryable: true,
      },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  }
}
