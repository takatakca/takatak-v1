import { NextResponse } from "next/server";

import {
  applyOneLvEvent,
  InvalidOneLvPayloadError,
  OneLvSyncConflictError,
} from "@/lib/integrations/1lv/apply-event";
import { parseOneLvEvent } from "@/lib/integrations/1lv/parser";
import { verifyOneLvRequest } from "@/lib/integrations/1lv/signature";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maximumBodySize = 100_000;

export async function POST(request: Request) {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Content-Type must be application/json.",
      },
      { status: 415 },
    );
  }

  const declaredLength = Number(
    request.headers.get("content-length") ?? "0",
  );

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > maximumBodySize
  ) {
    return NextResponse.json(
      { accepted: false, error: "Payload too large." },
      { status: 413 },
    );
  }

  const rawBody = await request.text();

  if (
    Buffer.byteLength(rawBody, "utf8") >
    maximumBodySize
  ) {
    return NextResponse.json(
      { accepted: false, error: "Payload too large." },
      { status: 413 },
    );
  }

  const verification =
    verifyOneLvRequest(rawBody, request.headers);

  if (!verification.valid) {
    return NextResponse.json(
      {
        accepted: false,
        error: verification.error,
      },
      { status: verification.status },
    );
  }

  const parsed = parseOneLvEvent(rawBody);

  if (!parsed.valid) {
    return NextResponse.json(
      {
        accepted: false,
        error: parsed.error,
      },
      { status: 400 },
    );
  }

  if (
    parsed.event.event_id !==
    verification.eventId
  ) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Event ID header and body do not match.",
      },
      { status: 401 },
    );
  }

  try {
    const result = await applyOneLvEvent(
      parsed.event,
      rawBody,
    );

    return NextResponse.json(
      {
        accepted: true,
        ...result,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof InvalidOneLvPayloadError) {
      return NextResponse.json(
        {
          accepted: false,
          error: error.message,
        },
        { status: 400 },
      );
    }

    if (error instanceof OneLvSyncConflictError) {
      return NextResponse.json(
        {
          accepted: false,
          error: error.message,
          conflicts: error.conflictingFields,
        },
        { status: 409 },
      );
    }

    console.error(
      "[1lv-sync] Synchronization failed:",
      error instanceof Error
        ? error.message
        : "unknown_error",
    );

    return NextResponse.json(
      {
        accepted: false,
        error: "Synchronization could not be completed.",
        retryable: true,
      },
      {
        status: 503,
        headers: {
          "Retry-After": "30",
        },
      },
    );
  }
}
