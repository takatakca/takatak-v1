import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

/**
 * CUBAFOOD -> TAKATAK integration contract, definition only.
 *
 * No route may call these helpers until a durable replay ledger, the explicit
 * tenant/product entitlement gate and a verified identity-link ceremony exist.
 * The existing 1LV master endpoints MUST continue rejecting cubafood.
 */
export const CUBAFOOD_SOURCE_APPLICATION = "cubafood" as const;
export const CUBAFOOD_CONTRACT_VERSION = 1 as const;
export const CUBAFOOD_REQUEST_TTL_SECONDS = 300;

const EVENT_AGGREGATES = {
  "participant.registered": "participant",
  "participant.status_changed": "participant",
  "partner.interest_submitted": "partner",
  "lead.created": "lead",
  "lead.status_changed": "lead",
} as const;

export type CubafoodEventType = keyof typeof EVENT_AGGREGATES;
export type CubafoodAggregateType =
  (typeof EVENT_AGGREGATES)[CubafoodEventType];

export type CubafoodEventEnvelope = {
  schema_version: typeof CUBAFOOD_CONTRACT_VERSION;
  source_application: typeof CUBAFOOD_SOURCE_APPLICATION;
  event_id: string;
  event_type: CubafoodEventType;
  aggregate_type: CubafoodAggregateType;
  source_tenant_ref: string;
  aggregate_ref: string;
  occurred_at: string;
};

export type CubafoodContractValidation =
  | { ok: true; event: CubafoodEventEnvelope }
  | { ok: false; code: "invalid_event" };

const FIELDS = new Set<keyof CubafoodEventEnvelope>([
  "schema_version",
  "source_application",
  "event_id",
  "event_type",
  "aggregate_type",
  "source_tenant_ref",
  "aggregate_ref",
  "occurred_at",
]);

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPAQUE_REFERENCE = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export function validateCubafoodEnvelope(value: unknown): CubafoodContractValidation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_event" };
  }

  const raw = value as Record<string, unknown>;
  if (
    Object.keys(raw).length !== FIELDS.size ||
    Object.keys(raw).some((key) => !FIELDS.has(key as keyof CubafoodEventEnvelope)) ||
    raw.schema_version !== CUBAFOOD_CONTRACT_VERSION ||
    raw.source_application !== CUBAFOOD_SOURCE_APPLICATION ||
    typeof raw.event_id !== "string" ||
    !UUID.test(raw.event_id) ||
    typeof raw.event_type !== "string" ||
    !Object.prototype.hasOwnProperty.call(EVENT_AGGREGATES, raw.event_type) ||
    raw.aggregate_type !== EVENT_AGGREGATES[raw.event_type as CubafoodEventType] ||
    typeof raw.source_tenant_ref !== "string" ||
    !OPAQUE_REFERENCE.test(raw.source_tenant_ref) ||
    typeof raw.aggregate_ref !== "string" ||
    !OPAQUE_REFERENCE.test(raw.aggregate_ref) ||
    typeof raw.occurred_at !== "string" ||
    !ISO_UTC.test(raw.occurred_at) ||
    !Number.isFinite(Date.parse(raw.occurred_at))
  ) {
    return { ok: false, code: "invalid_event" };
  }

  // Preserve only the validated non-personal reference fields.
  return {
    ok: true,
    event: {
      schema_version: CUBAFOOD_CONTRACT_VERSION,
      source_application: CUBAFOOD_SOURCE_APPLICATION,
      event_id: raw.event_id,
      event_type: raw.event_type as CubafoodEventType,
      aggregate_type: raw.aggregate_type as CubafoodAggregateType,
      source_tenant_ref: raw.source_tenant_ref,
      aggregate_ref: raw.aggregate_ref,
      occurred_at: raw.occurred_at,
    },
  };
}

export type CubafoodSignedRequest = {
  rawBody: string;
  timestamp: string;
  nonce: string;
  signature: string;
};

export type CubafoodSignatureProof =
  | {
      ok: true;
      nonce: string;
      payloadHash: string;
      timestamp: number;
    }
  | { ok: false; code: "invalid_signature" };

/** Canonical UTF-8 message signed by the CUBAFOOD-specific key. */
export function signCubafoodRequest(
  secret: string,
  timestamp: string,
  nonce: string,
  rawBody: string,
): string {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("CUBAFOOD signing key not configured.");
  }

  const bodyHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
  const message = `v1\n${timestamp}\n${nonce}\n${bodyHash}`;
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

/**
 * Cryptographic proof only: the future receiver MUST atomically reserve
 * (source_application, nonce) in a durable replay store before any write.
 * A matching signature alone is never sufficient for event ingestion.
 */
export function verifyCubafoodSignature(
  request: CubafoodSignedRequest,
  secret: string | null | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): CubafoodSignatureProof {
  const invalid: CubafoodSignatureProof = {
    ok: false,
    code: "invalid_signature",
  };

  if (
    typeof secret !== "string" ||
    Buffer.byteLength(secret, "utf8") < 32 ||
    !Number.isSafeInteger(nowSeconds) ||
    !/^[1-9]\d{9,}$/.test(request.timestamp) ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(request.nonce) ||
    !/^[a-f0-9]{64}$/i.test(request.signature)
  ) {
    return invalid;
  }

  const timestamp = Number(request.timestamp);
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(nowSeconds - timestamp) > CUBAFOOD_REQUEST_TTL_SECONDS
  ) {
    return invalid;
  }

  const expected = Buffer.from(
    signCubafoodRequest(secret, request.timestamp, request.nonce, request.rawBody),
    "hex",
  );
  const received = Buffer.from(request.signature, "hex");
  if (received.length !== expected.length || !timingSafeEqual(expected, received)) {
    return invalid;
  }

  return {
    ok: true,
    nonce: request.nonce,
    timestamp,
    payloadHash: createHash("sha256").update(request.rawBody, "utf8").digest("hex"),
  };
}
