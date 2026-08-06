import type { NextRequest } from "next/server";

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
  ]);

  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    try {
      origins.add(new URL(configuredUrl).origin);
    } catch {
      // Invalid configuration is handled by readiness checks.
    }
  }

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

  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !contentType
      .toLowerCase()
      .startsWith("application/json")
  ) {
    return {
      ok: false,
      status: 415,
      message: "This endpoint requires JSON.",
    };
  }

  const declaredLength = Number(
    request.headers.get("content-length") ?? "0",
  );

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > maximumBytes
  ) {
    return {
      ok: false,
      status: 413,
      message: "The request is too large.",
    };
  }

  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return {
      ok: false,
      status: 400,
      message:
        "The request body could not be read.",
    };
  }

  if (
    Buffer.byteLength(rawBody, "utf8") >
    maximumBytes
  ) {
    return {
      ok: false,
      status: 413,
      message: "The request is too large.",
    };
  }

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