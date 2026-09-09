import { NextResponse } from "next/server";

import { applyUpmindWebhookEvent } from "@/lib/integrations/upmind/webhook-apply";
import { parseUpmindWebhookPayload } from "@/lib/integrations/upmind/webhook-payload";
import { recordUpmindWebhookReceipt } from "@/lib/integrations/upmind/upmind-service";
import { verifyUpmindWebhook } from "@/lib/integrations/upmind/webhook";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 100_000;

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("application/json")) {
    return NextResponse.json({ error: "Unsupported content type." }, { status: 415 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  const verification = verifyUpmindWebhook(rawBody, request.headers);

  if (verification.state === "disabled") {
    return NextResponse.json(
      {
        provider: "upmind",
        state: verification.state,
        trusted: false,
        processed: false,
        message: verification.message,
      },
      { status: 200 },
    );
  }

  if (verification.state === "not_configured") {
    const recorded = await recordUpmindWebhookReceipt(verification.state, "ignored");
    return NextResponse.json(
      {
        provider: "upmind",
        state: verification.state,
        trusted: false,
        processed: false,
        recorded: recorded.recorded,
        message: verification.message,
      },
      { status: 202 },
    );
  }

  if (verification.state === "invalid_signature") {
    const recorded = await recordUpmindWebhookReceipt(verification.state, "failed");
    return NextResponse.json(
      {
        provider: "upmind",
        state: verification.state,
        trusted: false,
        processed: false,
        recorded: recorded.recorded,
        message: verification.message,
      },
      { status: 401 },
    );
  }

  const envelope = parseUpmindWebhookPayload(rawBody);
  if (!envelope) {
    const recorded = await recordUpmindWebhookReceipt("invalid_payload", "ignored");
    return NextResponse.json(
      {
        provider: "upmind",
        state: "verified",
        trusted: true,
        processed: false,
        recorded: recorded.recorded,
        message: "Signature verified, but the JSON body could not be parsed.",
      },
      { status: 200 },
    );
  }

  const applied = await applyUpmindWebhookEvent(envelope);
  return NextResponse.json(
    {
      provider: "upmind",
      state: "verified",
      trusted: true,
      processed: applied.applied || applied.duplicate,
      applied: applied.applied,
      duplicate: applied.duplicate,
      domainName: applied.domainName,
      reason: applied.reason,
    },
    { status: 200 },
  );
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
