import { NextResponse } from "next/server";

import { MasterApiInputError } from "@/lib/integrations/master-api/errors";
import {
  applyMasterEvent,
  type MasterEventInput,
} from "@/lib/integrations/master-api/events";
import {
  authorizeMasterRequest,
  masterApiError,
  readMasterJson,
} from "@/lib/integrations/master-api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = authorizeMasterRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const { rawBody, body } = await readMasterJson(request);
    const eventId =
      typeof body["event_id"] === "string"
        ? body["event_id"].trim()
        : "";
    const idempotencyKey =
      request.headers.get("idempotency-key")?.trim() ?? "";

    if (!idempotencyKey || idempotencyKey !== eventId) {
      throw new MasterApiInputError(
        "Idempotency-Key must match the event id.",
      );
    }

    const result = await applyMasterEvent(
      rawBody,
      body as MasterEventInput,
    );

    return NextResponse.json(
      { ok: true, ...result },
      { status: 200 },
    );
  } catch (error) {
    return masterApiError(error);
  }
}
