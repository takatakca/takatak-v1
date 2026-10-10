import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { z } from "zod";

import { getPrisma } from "@/lib/db/prisma";
import {
  REVERS_INTEGRATION_ID,
  verifyReversHmac,
} from "@/lib/integrations/revers/signature";
import { jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("lead.created"),
  version: z.literal("1"),
  occurredAt: z.string().datetime({ offset: true }),
  workspaceId: z.string().uuid().nullable(),
  customerId: z.string().nullable(),
  payload: z.object({
    source: z.literal("contact_form"),
    language: z.enum(["fr", "en"]),
    sourceEntityId: z.string().uuid(),
  }).strict(),
});

export async function POST(request: Request) {
  const secret = process.env.TAKATAK_REVERS_HMAC_SECRET?.trim() ?? "";
  if (!secret) {
    return jsonResponse(
      { ok: false, message: "REVERS integration is not configured." },
      503,
    );
  }

  const integration = request.headers.get("X-TAKATAK-Integration") ?? "";
  const timestamp = request.headers.get("X-TAKATAK-Timestamp") ?? "";
  const nonce = request.headers.get("X-TAKATAK-Nonce") ?? "";
  const signature = request.headers.get("X-TAKATAK-Signature") ?? "";

  if (integration !== REVERS_INTEGRATION_ID) {
    return jsonResponse({ ok: false, message: "Forbidden." }, 403);
  }

  if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    return jsonResponse({ ok: false, message: "Invalid nonce." }, 400);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ ok: false, message: "JSON required." }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 262_144) {
    return jsonResponse({ ok: false, message: "Request too large." }, 413);
  }

  const body = await request.text();

  if (
    !verifyReversHmac({
      secret,
      timestamp,
      nonce,
      method: "POST",
      path: "/api/v1/integrations/revers/events",
      body,
      signature,
    })
  ) {
    return jsonResponse({ ok: false, message: "Invalid signature." }, 403);
  }

  let parsed: z.infer<typeof EnvelopeSchema>;
  try {
    parsed = EnvelopeSchema.parse(JSON.parse(body));
  } catch {
    return jsonResponse({ ok: false, message: "Invalid event envelope." }, 400);
  }

  const prisma = getPrisma();
  if (!prisma) {
    return jsonResponse(
      { ok: false, message: "Integration is temporarily unavailable." },
      503,
    );
  }

  const payloadHash = createHash("sha256").update(body, "utf8").digest("hex");

  const existing = await prisma.sourceSynchronizationEvent.findUnique({
    where: { eventId: parsed.eventId },
    select: { id: true, payloadHash: true, responsePayload: true },
  });

  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      return jsonResponse(
        { ok: false, message: "Event idempotency conflict." },
        409,
      );
    }

    const duplicateResponse =
      existing.responsePayload &&
      typeof existing.responsePayload === "object" &&
      !Array.isArray(existing.responsePayload)
        ? (existing.responsePayload as Record<string, unknown>)
        : {
            ok: true,
            duplicate: true,
            eventId: parsed.eventId,
          };

    return jsonResponse(duplicateResponse, 200);
  }

  const responsePayload = {
    ok: true,
    accepted: true,
    eventId: parsed.eventId,
  };

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.integrationRequestNonce.create({
        data: {
          integrationId: REVERS_INTEGRATION_ID,
          nonce,
          expiresAt: new Date(Date.now() + 5 * 60_000),
        },
      });

      await transaction.sourceSynchronizationEvent.create({
        data: {
          eventId: parsed.eventId,
          eventType: parsed.eventType,
          sourceApplication: REVERS_INTEGRATION_ID,
          payloadHash,
          payload: parsed.payload as Prisma.InputJsonValue,
          responsePayload: responsePayload as Prisma.InputJsonValue,
          status: "RECEIVED",
          createdAt: new Date(parsed.occurredAt),
        },
      });
    });
  } catch {
    const duplicate = await prisma.sourceSynchronizationEvent.findUnique({
      where: { eventId: parsed.eventId },
      select: { payloadHash: true },
    });

    if (duplicate?.payloadHash === payloadHash) {
      return jsonResponse(
        { ...responsePayload, duplicate: true },
        200,
      );
    }

    return jsonResponse({ ok: false, message: "Replay or idempotency conflict." }, 409);
  }

  const response = jsonResponse(responsePayload, 202);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
