import { NextResponse } from "next/server";

import { readR2FIntakeConfig } from "@/lib/integrations/r2f/config";
import {
  recordR2FLead,
  R2FEventConflictError,
  R2FRateLimitedError,
} from "@/lib/integrations/r2f/store";
import { verifyR2FRequest } from "@/lib/integrations/r2f/signature";
import { validateR2FLeadRequest } from "@/lib/integrations/r2f/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAXIMUM_BODY_SIZE = 24_000;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { accepted: false, error: "Content-Type must be application/json." },
      { status: 415 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAXIMUM_BODY_SIZE) {
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

  const config = readR2FIntakeConfig();
  const verification = verifyR2FRequest(
    rawBody,
    request.headers,
    config,
  );

  if (!verification.valid) {
    return NextResponse.json(
      { accepted: false, error: verification.error },
      { status: verification.status },
    );
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { accepted: false, error: "Invalid JSON." },
      { status: 400 },
    );
  }

  const parsed = validateR2FLeadRequest(decoded);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Invalid R2F lead request.",
        fieldErrors: parsed.fieldErrors,
      },
      { status: 400 },
    );
  }

  if (parsed.value.requestId !== verification.eventId) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Event ID header and request ID do not match.",
      },
      { status: 401 },
    );
  }

  if (!config.enabled) {
    return NextResponse.json(
      { accepted: false, error: "R2F intake is unavailable." },
      { status: 503 },
    );
  }

  try {
    const result = await recordR2FLead(
      parsed.value,
      rawBody,
      config.clientId,
    );

    return NextResponse.json(
      {
        accepted: true,
        reference: result.reference,
        duplicate: result.duplicate,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof R2FEventConflictError) {
      return NextResponse.json(
        {
          accepted: false,
          error: "Event ID has already been used for different content.",
        },
        { status: 409 },
      );
    }

    if (error instanceof R2FRateLimitedError) {
      return NextResponse.json(
        {
          accepted: false,
          error: "R2F intake is temporarily rate limited.",
          retryable: true,
        },
        {
          status: 429,
          headers: { "Retry-After": "60" },
        },
      );
    }

    console.error(
      "[r2f-intake] request failed:",
      error instanceof Error ? error.message : "unknown_error",
    );

    return NextResponse.json(
      {
        accepted: false,
        error: "R2F intake could not be completed.",
        retryable: true,
      },
      {
        status: 503,
        headers: { "Retry-After": "30" },
      },
    );
  }
}
