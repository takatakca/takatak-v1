import { NextResponse } from "next/server";

import { verifyAhmvScheduleRequest } from "@/lib/integrations/ahmv/auth";
import { validateAhmvScheduleSnapshot } from "@/lib/integrations/ahmv/schedule-contract";
import {
  AhmvScheduleConflictError,
  AhmvScheduleUnavailableError,
  ingestAhmvScheduleSnapshot,
} from "@/lib/integrations/ahmv/schedule-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_048_576;

function json(body: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export async function POST(request: Request) {
  const verification = verifyAhmvScheduleRequest(request.headers, "ingest");
  if (!verification.valid) {
    return json({ ok: false, error: verification.error }, verification.status);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return json({ ok: false, error: "Content-Type must be application/json." }, 415);
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return json({ ok: false, error: "Payload too large." }, 413);
  }

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return json({ ok: false, error: "Request body could not be read." }, 400);
  }

  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return json({ ok: false, error: "Payload too large." }, 413);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Invalid JSON." }, 400);
  }

  const input = validateAhmvScheduleSnapshot(payload);
  if (!input) {
    return json({ ok: false, error: "Invalid AHMV schedule snapshot." }, 400);
  }

  try {
    const result = await ingestAhmvScheduleSnapshot(input);
    return json({
      ok: true,
      applied: result.applied,
      duplicate: result.duplicate,
      stale: result.stale,
      eventCount: input.events.length,
      updatedAt: input.updatedAt,
    });
  } catch (error) {
    if (error instanceof AhmvScheduleConflictError) {
      return json({ ok: false, error: error.message }, 409);
    }
    if (error instanceof AhmvScheduleUnavailableError) {
      const response = json(
        { ok: false, error: "AHMV schedule store is unavailable." },
        503,
      );
      response.headers.set("Retry-After", "60");
      return response;
    }

    console.error(
      "[ahmv-schedule] ingestion failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    const response = json(
      { ok: false, error: "AHMV schedule ingestion could not be completed." },
      503,
    );
    response.headers.set("Retry-After", "30");
    return response;
  }
}
