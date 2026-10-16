import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import {
  applyQmapsEvent,
  QmapsEventConflictError,
} from "@/lib/integrations/qmaps/apply-event";
import { parseQmapsEvent } from "@/lib/integrations/qmaps/parser";
import { verifyQmapsRequest } from "@/lib/integrations/qmaps/signature";
import { redactSecrets } from "@/lib/security/redact";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAXIMUM_BODY_BYTES = 64_000;

function reply(body: Record<string, unknown>, status: number, headers?: HeadersInit) {
  return NextResponse.json(body, { status, headers });
}

/** Signed QMAPS → TAKATAK listing/review events (server-to-server only). */
export async function POST(request: Request) {
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return reply({ accepted: false, error: "Content-Type must be application/json." }, 415);
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAXIMUM_BODY_BYTES) {
    return reply({ accepted: false, error: "Payload too large." }, 413);
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAXIMUM_BODY_BYTES) {
    return reply({ accepted: false, error: "Payload too large." }, 413);
  }

  const verification = verifyQmapsRequest(rawBody, request.headers);
  if (!verification.valid) {
    return reply({ accepted: false, error: verification.error }, verification.status);
  }

  const parsed = parseQmapsEvent(rawBody);
  if (!parsed.valid) {
    return reply({ accepted: false, error: parsed.error }, 400);
  }
  if (parsed.event.eventId !== verification.eventId.toLowerCase()) {
    return reply({ accepted: false, error: "Event ID header and body do not match." }, 401);
  }

  const prisma = getPrisma();
  if (!prisma) {
    return reply(
      { accepted: false, error: "Synchronization is temporarily unavailable.", retryable: true },
      503,
      { "Retry-After": "30" },
    );
  }

  try {
    const result = await applyQmapsEvent(prisma, parsed.event, rawBody);
    return reply({ accepted: true, ...result }, 200);
  } catch (error) {
    if (error instanceof QmapsEventConflictError) {
      return reply({ accepted: false, error: error.message }, 409);
    }
    console.error(
      "[qmaps-sync] Synchronization failed:",
      redactSecrets(error instanceof Error ? error.message : "unknown_error"),
    );
    return reply(
      { accepted: false, error: "Synchronization could not be completed.", retryable: true },
      503,
      { "Retry-After": "30" },
    );
  }
}
