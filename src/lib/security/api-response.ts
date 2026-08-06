import { NextResponse } from "next/server";

import {
  isServiceError,
  type ServiceError,
} from "@/lib/services/service-error";

export function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): NextResponse {
  const response = NextResponse.json(body, {
    status,
  });

  response.headers.set("Cache-Control", "no-store");

  return response;
}

export function serviceErrorResponse(
  error: ServiceError,
): NextResponse {
  return jsonResponse(
    {
      ok: false,
      message: error.message,
      ...(error.fieldErrors
        ? {
            fieldErrors: error.fieldErrors,
          }
        : {}),
    },
    error.status,
  );
}

export function handleApiError(
  scope: string,
  error: unknown,
  fallbackMessage: string,
): NextResponse {
  if (isServiceError(error)) {
    return serviceErrorResponse(error);
  }

  console.error(
    `[${scope}] Request failed:`,
    error instanceof Error
      ? error.message
      : "Unknown error",
  );

  return jsonResponse(
    {
      ok: false,
      message: fallbackMessage,
    },
    500,
  );
}