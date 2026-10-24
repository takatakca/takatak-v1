import { NextRequest } from "next/server";

import {
  PRODUCTION_APP_ORIGIN,
  isProductionAppRuntime,
  resolvePublicUrl,
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

/**
 * Authorize credential-changing browser writes against a server-configured
 * origin, never a Host or X-Forwarded-Host supplied by the request itself.
 * Forwarded headers are useful for redirects but cannot establish CSRF trust.
 */
export function isTrustedRequestOrigin(request: NextRequest): boolean {
  const received = normalizeOrigin(request.headers.get("origin"));
  if (!received) return false;

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      const expected = resolvePublicUrl(configured);
      if (
        !["https:", "http:"].includes(expected.protocol) ||
        expected.username ||
        expected.password
      ) {
        return false;
      }
      return received === expected.origin;
    } catch {
      // Invalid configuration must not fall back to client-controlled headers.
      return false;
    }
  }

  if (isProductionAppRuntime()) {
    return received === PRODUCTION_APP_ORIGIN;
  }

  // Local previews without an explicit app URL may use their own exact
  // request URL origin; do not accept any forwarded hostname overrides.
  try {
    return received === new URL(request.url).origin;
  } catch {
    return false;
  }
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
