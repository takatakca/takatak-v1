import { NextRequest } from "next/server";

import {
  getApplicationOrigin,
  originFromRequest,
} from "@/lib/config/app-origin";

export function normalizeOrigin(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isTrustedRequestOrigin(request: NextRequest): boolean {
  const requestOrigin = normalizeOrigin(request.headers.get("origin"));

  if (!requestOrigin) {
    return false;
  }

  const allowedOrigins = new Set<string>();
  allowedOrigins.add(originFromRequest(request));
  allowedOrigins.add(getApplicationOrigin(new URL(request.url).origin));

  return allowedOrigins.has(requestOrigin);
}

export function jsonAuthHeaders(): Headers {
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json");
  return headers;
}

/**
 * Read bounded JSON for the authenticated TAKATAK Auth routes. The body size
 * is enforced while consuming the stream, not after request.text() has
 * already allocated attacker-controlled bytes.
 *
 * Keep throwing REQUEST_TOO_LARGE for existing auth-json response handling.
 */
export async function readJsonBody(
  request: NextRequest,
  maximumBytes: number,
): Promise<unknown> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    throw new Error("REQUEST_TOO_LARGE");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const size = Number(declaredLength);
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error("INVALID_REQUEST_SIZE");
    }
    if (size > maximumBytes) {
      throw new Error("REQUEST_TOO_LARGE");
    }
  }

  if (!request.body) {
    throw new Error("INVALID_REQUEST_BODY");
  }

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let length = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      length += value.byteLength;
      if (length > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("REQUEST_TOO_LARGE");
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
      throw error;
    }
    throw new Error("INVALID_REQUEST_BODY");
  } finally {
    reader.releaseLock();
  }

  return JSON.parse(Buffer.concat(chunks, length).toString("utf8")) as unknown;
}
