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

/**
 * Streaming bound on incoming API bodies. Never call request.text() before
 * enforcing a size ceiling: a forged Content-Length can otherwise allocate
 * arbitrarily large user-supplied data.
 */
async function readBoundedMasterBody(request: Request): Promise<string> {
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader !== null) {
    const length = Number(lengthHeader);
    if (!Number.isSafeInteger(length) || length < 0) {
      throw new MasterApiInputError("Invalid Content-Length.");
    }
    if (length > MASTER_API_MAX_BODY_BYTES) {
      throw new MasterApiInputError("Payload too large.");
    }
  }

  if (!request.body) {
    throw new MasterApiInputError("JSON object required.");
  }

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MASTER_API_MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new MasterApiInputError("Payload too large.");
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    if (error instanceof MasterApiInputError) throw error;
    throw new MasterApiInputError("Request body could not be read.");
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, total).toString("utf8");
}

export async function readMasterJson(request: Request): Promise<{
  rawBody: string;
  body: Record<string, unknown>;
}> {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    throw new MasterApiInputError("Content-Type must be application/json.");
  }

  const rawBody = await readBoundedMasterBody(request);

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
