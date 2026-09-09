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

export async function readJsonBody(
  request: NextRequest,
  maximumBytes: number,
): Promise<unknown> {
  const bodyText = await request.text();
  const bodyBytes = new TextEncoder().encode(bodyText).byteLength;

  if (bodyBytes > maximumBytes) {
    throw new Error("REQUEST_TOO_LARGE");
  }

  return JSON.parse(bodyText) as unknown;
}
