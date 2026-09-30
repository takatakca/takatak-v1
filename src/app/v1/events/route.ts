import { NextResponse } from "next/server";
import { applyOneLvEvent } from "@/lib/integrations/one-lv/apply-event";
import { verifyOneLvRequest } from "@/lib/integrations/one-lv/auth";
import { parseOneLvEvent } from "@/lib/integrations/one-lv/parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY = 100_000;

export async function POST(request: Request) {
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json({ accepted: false, error: "Content-Type must be application/json." }, { status: 415 });
  }

  const auth = verifyOneLvRequest(request.headers);
  if (!auth.valid) {
    return NextResponse.json({ accepted: false, error: auth.error }, { status: auth.status });
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY) {
    return NextResponse.json({ accepted: false, error: "Payload too large." }, { status: 413 });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY) {
    return NextResponse.json({ accepted: false, error: "Payload too large." }, { status: 413 });
  }

  const parsed = parseOneLvEvent(raw);
  if (!parsed.valid) {
    return NextResponse.json({ accepted: false, error: parsed.error }, { status: 400 });
  }

  const idempotency = request.headers.get("idempotency-key")?.trim();
  if (idempotency && idempotency !== parsed.event.event_id) {
    return NextResponse.json({ accepted: false, error: "Idempotency key does not match event ID." }, { status: 409 });
  }

  try {
    const result = await applyOneLvEvent(parsed.event, raw);
    return NextResponse.json({ accepted: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message === "event_id_payload_conflict") {
      return NextResponse.json({ accepted: false, error: "Event ID was already used with a different payload." }, { status: 409 });
    }
    if (message === "source_merchant_not_found" || message === "relationship_reference_missing") {
      return NextResponse.json({ accepted: false, error: message, retryable: true }, { status: 409 });
    }
    console.error("[1lv-master-sync] event failed:", message);
    return NextResponse.json(
      { accepted: false, error: "Synchronization could not be completed.", retryable: true },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  }
}
