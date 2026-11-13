import type { NextRequest } from "next/server";

import { getApplicationOrigin } from "@/lib/config/app-origin";

export type JsonBodyResult =
  | {
      ok: true;
      body: unknown;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

function getAllowedOrigins(
  request: NextRequest,
): Set<string> {
  const origins = new Set<string>([
    request.nextUrl.origin,
    getApplicationOrigin(request.nextUrl.origin),
  ]);

  return origins;
}

export function hasValidWriteOrigin(
  request: NextRequest,
): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return process.env.NODE_ENV !== "production";
  }

  try {
    return getAllowedOrigins(request).has(
      new URL(origin).origin,
    );
  } catch {
    return false;
  }
}

export async function readJsonBody(
  request: NextRequest,
  maximumBytes = 32_768,
): Promise<JsonBodyResult> {
  if (!hasValidWriteOrigin(request)) {
    return {
      ok: false,
      status: 403,
      message:
        "The request origin could not be verified.",
    };
  }

  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    return {
      ok: false,
      status: 415,
      message: "This endpoint requires JSON.",
    };
  }

  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader !== null) {
    const length = Number(lengthHeader);
    if (!Number.isSafeInteger(length) || length < 0) {
      return { ok: false, status: 400, message: "Invalid request size." };
    }
    if (length > maximumBytes) {
      return { ok: false, status: 413, message: "The request is too large." };
    }
  }

  if (!request.body) {
    return {
      ok: false,
      status: 400,
      message: "The request body could not be read.",
    };
  }

  // Restrict in-memory allocation while streaming, even if Content-Length
  // was omitted or deliberately understated by a malicious client.
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      receivedBytes += value.byteLength;
      if (receivedBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        return {
          ok: false,
          status: 413,
          message: "The request is too large.",
        };
      }
      chunks.push(Buffer.from(value));
    }
  } catch {
    return {
      ok: false,
      status: 400,
      message: "The request body could not be read.",
    };
  } finally {
    reader.releaseLock();
  }

  const rawBody = Buffer.concat(chunks, receivedBytes).toString("utf8");

  try {
    return {
      ok: true,
      body: JSON.parse(rawBody) as unknown,
    };
  } catch {
    return {
      ok: false,
      status: 400,
      message:
        "The request body is invalid JSON.",
    };
  }
}