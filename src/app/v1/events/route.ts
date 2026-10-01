import { NextResponse } from "next/server";

import {
  applyOneLvEvent,
  OneLvIdentityConflictError,
  parseOneLvEvent,
} from "@/lib/integrations/one-lv/master";
import { readAuthorizedOneLvJson } from "@/lib/integrations/one-lv/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const input = await readAuthorizedOneLvJson(request);
  if (!input.ok) return input.response;

  const event = parseOneLvEvent(input.body);
  if (!event) {
    return NextResponse.json(
      { accepted: false, error: "Invalid 1LV event payload." },
      { status: 400 },
    );
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (idempotencyKey && idempotencyKey !== event.event_id) {
    return NextResponse.json(
      { accepted: false, error: "Idempotency key does not match event_id." },
      { status: 409 },
    );
  }

  try {
    const result = await applyOneLvEvent(event, input.rawBody);
    return NextResponse.json({ accepted: true, ...result });
  } catch (error) {
    if (error instanceof OneLvIdentityConflictError) {
      return NextResponse.json(
        {
          accepted: false,
          error: "Identity conflict requires review.",
          conflicts: error.fields,
        },
        { status: 409 },
      );
    }

    console.error(
      "[1lv-master] event synchronization failed:",
      error instanceof Error ? error.message : "unknown_error",
    );

    return NextResponse.json(
      {
        accepted: false,
        error: "Synchronization could not be completed.",
        retryable: true,
      },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  }
}
