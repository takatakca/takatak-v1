import { NextResponse } from "next/server";

import { grantSupporterThankYou } from "@/lib/billing/hockey/premium-grant-service";
import { parseAhmvSupporterCreditEvent } from "@/lib/integrations/ahmv-supporter/parser";
import { verifyAhmvSupporterRequest } from "@/lib/integrations/ahmv-supporter/signature";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAXIMUM_BODY_SIZE = 32_000;

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

  const verification = verifyAhmvSupporterRequest(rawBody, request.headers);
  if (!verification.valid) {
    return NextResponse.json(
      { accepted: false, error: verification.error },
      { status: verification.status },
    );
  }

  const parsed = parseAhmvSupporterCreditEvent(rawBody);
  if (!parsed.valid) {
    return NextResponse.json({ accepted: false, error: parsed.error }, { status: 400 });
  }

  if (parsed.event.eventId !== verification.eventId) {
    return NextResponse.json(
      { accepted: false, error: "Event ID header and body do not match." },
      { status: 401 },
    );
  }

  try {
    const result = await grantSupporterThankYou({
      identityId: parsed.event.identityId,
      sourcePaymentId: parsed.event.sourcePaymentId,
    });

    return NextResponse.json(
      {
        accepted: true,
        duplicate: result.duplicate,
        grantId: result.grant.id,
        status: result.grant.status,
        grantedWeeks: result.grant.grantedWeeks,
        expiresAt: result.grant.expiresAt?.toISOString() ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "[ahmv-supporter-credit] Grant failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return NextResponse.json(
      {
        accepted: false,
        error: "The supporter thank-you credit could not be applied.",
        retryable: true,
      },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  }
}
