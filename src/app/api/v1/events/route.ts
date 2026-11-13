import { NextResponse } from "next/server";

import { MasterApiInputError } from "@/lib/integrations/master-api/errors";
import {
  applyMasterEvent,
  type MasterEventInput,
} from "@/lib/integrations/master-api/events";
import {
  authorizeMasterScope,
  masterApiError,
  readMasterJson,
} from "@/lib/integrations/master-api/http";
import { MASTER_API_ROUTE_SCOPES } from "@/lib/integrations/master-api/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = authorizeMasterScope(request, MASTER_API_ROUTE_SCOPES.events);
  if (auth.response) return auth.response;

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
      auth.scope,
    );

    return NextResponse.json(
      { ok: true, ...result },
      { status: 200 },
    );
  } catch (error) {
    return masterApiError(error);
  }
}
