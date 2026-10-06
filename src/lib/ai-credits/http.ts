import "server-only";

import { NextResponse } from "next/server";

import type { LedgerResult } from "./ledger";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const STATUS_BY_CODE = {
  insufficient_credits: 402,
  unknown_client: 404,
  idempotency_conflict: 409,
  invalid_request: 400,
} as const;

export function ledgerResponse(result: LedgerResult): NextResponse {
  if (result.ok) return json(result, result.replayed ? 200 : 201);
  return json(result, STATUS_BY_CODE[result.code]);
}
