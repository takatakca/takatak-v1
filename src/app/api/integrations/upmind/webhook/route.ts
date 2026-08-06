import { NextResponse } from "next/server";
import { verifyUpmindWebhook } from "@/lib/integrations/upmind/webhook";
import { recordUpmindWebhookReceipt } from "@/lib/integrations/upmind/upmind-service";

export const dynamic = "force-dynamic";

// Phase 8 webhook SKELETON: events are NEVER trusted or processed here.
// No provisioning, invoices, service updates, or domain changes happen.
const MAX_BODY_BYTES = 100_000; // 100 KB — generous for provider events

export async function POST(request: Request) {
  // Phase 14 — input limits. Raw body is read for future signature checks
  // but is NEVER logged or echoed back.
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("application/json")) {
    return NextResponse.json({ error: "Unsupported content type." }, { status: 415 });
  }
  const rawBody = await request.text(); // raw body for future signature checks
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }
  const verification = verifyUpmindWebhook(rawBody, request.headers);

  let recorded = { recorded: false };
  if (verification.state !== "disabled") {
    // Observability only — stored as "ignored", never processed.
    recorded = await recordUpmindWebhookReceipt(verification.state);
  }
  return NextResponse.json(
    {
      provider: "upmind",
      state: verification.state,
      trusted: verification.trusted,
      processed: false,
      recorded: recorded.recorded,
      message: verification.message,
    },
    { status: verification.state === "disabled" ? 200 : 202 },
  );
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
