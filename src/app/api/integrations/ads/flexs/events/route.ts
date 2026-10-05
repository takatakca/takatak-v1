import { NextRequest, NextResponse } from "next/server";

import {
  FLEXS_AD_EVENT_TYPES,
  recordFlexsAdAttribution,
  type FlexsAdEventType,
} from "@/lib/ads/flexs-attribution";
import { verifyFlexsAdsRequest } from "@/lib/ads/flexs-auth";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { readJsonBody } from "@/lib/security/write-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPAQUE_REFERENCE_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

function stringValue(
  value: unknown,
  max: number,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const auth = verifyFlexsAdsRequest(request.headers);
  if (!auth.valid) {
    return jsonResponse(
      { ok: false, message: auth.error },
      auth.status,
    );
  }

  const bodyResult = await readJsonBody(request, 16_000);
  if (!bodyResult.ok) {
    return jsonResponse(
      { ok: false, message: bodyResult.message },
      bodyResult.status,
    );
  }

  const raw =
    bodyResult.body &&
    typeof bodyResult.body === "object" &&
    !Array.isArray(bodyResult.body)
      ? (bodyResult.body as Record<string, unknown>)
      : {};

  const attributionId =
    stringValue(raw.attributionId, 64) ?? "";
  const externalEventId =
    stringValue(raw.externalEventId, 160) ?? "";
  const sourceReference =
    stringValue(raw.sourceReference, 160);
  const eventType =
    typeof raw.eventType === "string" &&
    (FLEXS_AD_EVENT_TYPES as readonly string[]).includes(
      raw.eventType,
    )
      ? (raw.eventType as FlexsAdEventType)
      : null;

  const valueCents =
    raw.valueCents === null ||
    raw.valueCents === undefined
      ? null
      : typeof raw.valueCents === "number" &&
          Number.isInteger(raw.valueCents) &&
          raw.valueCents >= 0 &&
          raw.valueCents <= 1_000_000_000
        ? raw.valueCents
        : Number.NaN;

  const currencyRaw =
    stringValue(raw.currency, 3)?.toUpperCase() ?? null;
  const currency =
    currencyRaw && /^[A-Z]{3}$/.test(currencyRaw)
      ? currencyRaw
      : null;

  let occurredAt: Date | null = null;
  if (
    raw.occurredAt !== null &&
    raw.occurredAt !== undefined
  ) {
    if (typeof raw.occurredAt !== "string") {
      return jsonResponse(
        { ok: false, message: "occurredAt must be an ISO date." },
        400,
      );
    }
    occurredAt = new Date(raw.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      return jsonResponse(
        { ok: false, message: "occurredAt must be an ISO date." },
        400,
      );
    }
  }

  if (!UUID_PATTERN.test(attributionId)) {
    return jsonResponse(
      { ok: false, message: "Invalid attributionId." },
      400,
    );
  }

  if (!OPAQUE_REFERENCE_PATTERN.test(externalEventId)) {
    return jsonResponse(
      {
        ok: false,
        message:
          "externalEventId must be an opaque identifier.",
      },
      400,
    );
  }

  if (
    sourceReference &&
    !OPAQUE_REFERENCE_PATTERN.test(sourceReference)
  ) {
    return jsonResponse(
      {
        ok: false,
        message:
          "sourceReference must be an opaque identifier.",
      },
      400,
    );
  }

  if (!eventType) {
    return jsonResponse(
      {
        ok: false,
        message:
          "eventType must be lead, call, form_submit or conversion.",
      },
      400,
    );
  }

  if (Number.isNaN(valueCents)) {
    return jsonResponse(
      {
        ok: false,
        message:
          "valueCents must be a non-negative integer.",
      },
      400,
    );
  }

  if (
    raw.currency !== null &&
    raw.currency !== undefined &&
    !currency
  ) {
    return jsonResponse(
      {
        ok: false,
        message: "currency must be a 3-letter ISO code.",
      },
      400,
    );
  }

  try {
    const result = await recordFlexsAdAttribution({
      attributionId,
      externalEventId,
      eventType,
      occurredAt,
      sourceReference,
      valueCents,
      currency,
    });

    return jsonResponse(
      {
        ok: true,
        recorded: !result.duplicate,
        duplicate: result.duplicate,
        eventId: result.eventId,
        campaignId: result.campaignId,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "ads-flexs-attribution",
      error,
      "FLEXS attribution could not be recorded.",
    );
  }
}
