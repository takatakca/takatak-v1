import { NextResponse } from "next/server";

import {
  BILLING_FEED_MAX_BODY_BYTES,
  feedInvoiceRequest,
  getFedInvoiceRequest,
  verifyBillingFeedHeaders,
} from "@/lib/billing/invoices/feed-service";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GROUPE TAKATAK Billing — signed machine feed for ecosystem apps outside
// this repository. POST queues an invoice request (DRAFT path only; a TAKATAK
// OWNER still reviews and submits it to Facturations). GET returns the status
// of one of the calling app's own requests (?sourceReference=…).

function pathOf(request: Request): string {
  const url = new URL(request.url);
  return `${url.pathname}${url.search}`;
}

function denied(status: number, code: string): NextResponse {
  return jsonResponse({ ok: false, error: code }, status);
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return denied(415, "JSON_REQUIRED");
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > BILLING_FEED_MAX_BODY_BYTES) {
    return denied(413, "PAYLOAD_TOO_LARGE");
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > BILLING_FEED_MAX_BODY_BYTES) {
    return denied(413, "PAYLOAD_TOO_LARGE");
  }

  if (new URL(request.url).search) {
    return denied(422, "INVALID_QUERY");
  }

  const verification = verifyBillingFeedHeaders({
    headers: request.headers,
    method: "POST",
    path: pathOf(request),
    rawBody,
  });

  if (!verification.ok) {
    return denied(verification.status, verification.code);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return denied(400, "INVALID_JSON");
  }

  try {
    const result = await feedInvoiceRequest(verification.app, body);

    return jsonResponse({ ok: true, created: result.created, request: result.request }, result.created ? 201 : 200);
  } catch (error) {
    return handleApiError("billing-feed", error, "The invoice request could not be queued.");
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const keys = [...url.searchParams.keys()];

  if (keys.length !== 1 || keys[0] !== "sourceReference") {
    return denied(422, "SOURCE_REFERENCE_REQUIRED");
  }

  const verification = verifyBillingFeedHeaders({
    headers: request.headers,
    method: "GET",
    path: pathOf(request),
    rawBody: "",
  });

  if (!verification.ok) {
    return denied(verification.status, verification.code);
  }

  try {
    const result = await getFedInvoiceRequest(verification.app, url.searchParams.get("sourceReference") ?? "");

    return jsonResponse({ ok: true, request: result }, 200);
  } catch (error) {
    return handleApiError("billing-feed", error, "The invoice request could not be read.");
  }
}
