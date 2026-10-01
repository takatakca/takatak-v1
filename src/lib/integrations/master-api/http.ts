import { NextResponse } from "next/server";

import { verifyMasterApiRequest } from "./auth";
import {
  MasterApiConflictError,
  MasterApiInputError,
  MasterApiUnavailableError,
} from "./errors";

export const MASTER_API_MAX_BODY_BYTES = 100_000;

export function authorizeMasterRequest(request: Request) {
  const verification = verifyMasterApiRequest(request.headers);
  if (verification.valid) return null;

  return NextResponse.json(
    { ok: false, error: verification.error },
    { status: verification.status },
  );
}

export async function readMasterJson(request: Request): Promise<{
  rawBody: string;
  body: Record<string, unknown>;
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new MasterApiInputError("Content-Type must be application/json.");
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MASTER_API_MAX_BODY_BYTES) {
    throw new MasterApiInputError("Payload too large.");
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MASTER_API_MAX_BODY_BYTES) {
    throw new MasterApiInputError("Payload too large.");
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new MasterApiInputError("Invalid JSON payload.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new MasterApiInputError("JSON object required.");
  }

  return { rawBody, body: body as Record<string, unknown> };
}

export function masterApiError(error: unknown) {
  if (error instanceof MasterApiInputError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  if (error instanceof MasterApiConflictError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
  }

  if (error instanceof MasterApiUnavailableError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  }

  console.error(
    "[master-api] request failed:",
    error instanceof Error ? error.message : "unknown_error",
  );

  return NextResponse.json(
    { ok: false, error: "Master API request could not be completed." },
    { status: 503, headers: { "Retry-After": "30" } },
  );
}
