import { NextResponse } from "next/server";

import {
  applyRentautoEvent,
  IdentityConflictError,
} from "@/lib/integrations/rentauto/apply-event";

import {
  parseRentautoEvent,
} from "@/lib/integrations/rentauto/parser";

import {
  verifyRentautoRequest,
} from "@/lib/integrations/rentauto/signature";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maximumBodySize = 100_000;

export async function POST(request: Request) {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !contentType.includes("application/json")
  ) {
    return NextResponse.json(
      {
        accepted: false,
        error:
          "Content-Type must be application/json.",
      },
      {
        status: 415,
      },
    );
  }

  const declaredLength = Number(
    request.headers.get("content-length") ?? "0",
  );

  if (declaredLength > maximumBodySize) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Payload too large.",
      },
      {
        status: 413,
      },
    );
  }

  const rawBody = await request.text();

  if (
    Buffer.byteLength(rawBody, "utf8") >
    maximumBodySize
  ) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Payload too large.",
      },
      {
        status: 413,
      },
    );
  }

  const verification =
    verifyRentautoRequest(
      rawBody,
      request.headers,
    );

  if (!verification.valid) {
    return NextResponse.json(
      {
        accepted: false,
        error: verification.error,
      },
      {
        status: verification.status,
      },
    );
  }

  const parsed = parseRentautoEvent(rawBody);

  if (!parsed.valid) {
    return NextResponse.json(
      {
        accepted: false,
        error: parsed.error,
      },
      {
        status: 400,
      },
    );
  }

  if (
    parsed.event.eventId !==
    verification.eventId
  ) {
    return NextResponse.json(
      {
        accepted: false,
        error:
          "Event ID header and body do not match.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const result = await applyRentautoEvent(
      parsed.event,
      rawBody,
    );

    return NextResponse.json(
      {
        accepted: true,
        ...result,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof IdentityConflictError) {
      return NextResponse.json(
        {
          accepted: false,
          error:
            "Identity conflict requires review.",
          conflicts:
            error.conflictingFields,
        },
        {
          status: 409,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "source_profile_not_found"
    ) {
      return NextResponse.json(
        {
          accepted: false,
          error:
            "Synchronize the RENTAUTO customer profile before sending payment summaries.",
        },
        {
          status: 409,
        },
      );
    }

    console.error(
      "[rentauto-sync] Synchronization failed:",
      error instanceof Error
        ? error.message
        : "unknown_error",
    );

    return NextResponse.json(
        {
          accepted: false,
          error:
            "Synchronization could not be completed.",
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