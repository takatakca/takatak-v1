import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { verifyMimtWebhook } from "@/lib/integrations/mimt/verify-webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 32_768;
const ALLOWED_TYPES = new Set([
  "entitlement.updated",
  "telecom_account.status_changed",
  "phone_number.assigned",
]);

const json = (data: Record<string, unknown>, status: number) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

const safeOpaqueId = (v: unknown): string | undefined =>
  typeof v === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(v) ? v : undefined;

type MimtEvent = {
  id: string;
  type: string;
  created_at: string;
  data: Record<string, unknown>;
};

function parseEvent(rawBody: string): MimtEvent | null {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const obj = body as Record<string, unknown>;
  if (typeof obj.id !== "string" ||
      !/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89abAB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$/.test(obj.id) ||
      typeof obj.type !== "string" || !ALLOWED_TYPES.has(obj.type) ||
      typeof obj.created_at !== "string" || !Number.isFinite(Date.parse(obj.created_at)) ||
      !obj.data || typeof obj.data !== "object" || Array.isArray(obj.data)) {
    return null;
  }
  return { id: obj.id, type: obj.type, created_at: obj.created_at, data: obj.data as Record<string, unknown> };
}

// Keep only non-sensitive, opaque service references. In particular, do NOT
// copy subscriber phone numbers, communications, recordings, or contact data
// into TAKATAK. Receipt does not authorize a MasterIdentity/CRM merge.
function safeProjection(ev: MimtEvent): Prisma.InputJsonValue {
  const p: Record<string, string> = { created_at: ev.created_at };
  for (const key of ["telecom_account_id", "workspace_id", "global_user_id"]) {
    const value = safeOpaqueId(ev.data[key]);
    if (value) p[key] = value;
  }
  if (ev.type === "entitlement.updated") {
    const plan = safeOpaqueId(ev.data.plan);
    if (plan) p.plan = plan;
  } else if (ev.type === "telecom_account.status_changed") {
    const status = safeOpaqueId(ev.data.status);
    if (status) p.status = status;
  }
  return p;
}

export async function POST(request: Request) {
  const secret = process.env.MIMT_WEBHOOK_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) return json({ error: "not_configured" }, 503);
  const size = Number(request.headers.get("content-length") || "0");
  if (size > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return json({ error: "unsupported_media_type" }, 415);
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
  if (!verifyMimtWebhook(rawBody, request.headers.get("x-mimt-signature"), secret)) {
    return json({ error: "unauthorized" }, 401);
  }
  const ev = parseEvent(rawBody);
  if (!ev) return json({ error: "invalid_event" }, 422);
  // MIMT-independent subscriber events are not TAKATAK agency records.
  // Do not retain events with no TAKATAK-linked identity/workspace reference.
  if (!safeOpaqueId(ev.data.global_user_id) && !safeOpaqueId(ev.data.workspace_id)) {
    return json({ received: true, ignored: true, processed: false }, 202);
  }
  const prisma = getPrisma();
  if (!prisma) return json({ error: "database_unavailable" }, 503);
  const digest = createHash("sha256").update(rawBody).digest("hex");

  const existingResponse = async () => {
    const existing = await prisma.sourceSynchronizationEvent.findUnique({ where: { eventId: ev.id } });
    if (!existing) return null;
    if (existing.sourceApplication !== "mimt" || existing.payloadHash !== digest) {
      return json({ error: "event_id_conflict" }, 409);
    }
    return json({ received: true, duplicate: true, processed: false }, 200);
  };

  try {
    const existing = await existingResponse();
    if (existing) return existing;
    await prisma.sourceSynchronizationEvent.create({
      data: {
        eventId: ev.id,
        eventType: ev.type,
        sourceApplication: "mimt",
        payloadHash: digest,
        payload: safeProjection(ev),
        status: "RECEIVED",
      },
    });
    // No downstream CRM/entitlement mutation is performed by this intake.
    // A later consent- and tenant-scoped processor can use these safe receipts.
    return json({ received: true, processed: false }, 202);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      try {
        const duplicate = await existingResponse();
        if (duplicate) return duplicate;
      } catch {
        // DB still unavailable.
      }
    }
    console.error("[mimt-webhook] receipt persistence failed", error instanceof Error ? error.name : "unknown");
    return json({ error: "temporarily_unavailable" }, 503);
  }
}

export function GET() {
  return json({ error: "method_not_allowed" }, 405);
}
