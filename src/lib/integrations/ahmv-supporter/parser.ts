export type AhmvSupporterCreditEvent = {
  eventId: string;
  type: "supporter.credit.granted";
  occurredAt: string;
  identityId: string;
  sourcePaymentId: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseAhmvSupporterCreditEvent(rawBody: string):
  | { valid: true; event: AhmvSupporterCreditEvent }
  | { valid: false; error: string } {
  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch {
    return { valid: false, error: "Payload must be valid JSON." };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, error: "Payload must be a JSON object." };
  }

  const body = value as Record<string, unknown>;
  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  const type = body.type;
  const occurredAt =
    typeof body.occurredAt === "string" ? body.occurredAt.trim() : "";
  const identityId =
    typeof body.identityId === "string" ? body.identityId.trim() : "";
  const sourcePaymentId =
    typeof body.sourcePaymentId === "string" ? body.sourcePaymentId.trim() : "";

  if (!eventId || eventId.length > 160) {
    return { valid: false, error: "A valid eventId is required." };
  }
  if (type !== "supporter.credit.granted") {
    return { valid: false, error: "Unsupported supporter event type." };
  }
  if (!Number.isFinite(Date.parse(occurredAt))) {
    return { valid: false, error: "A valid occurredAt timestamp is required." };
  }
  if (!UUID_RE.test(identityId)) {
    return { valid: false, error: "A valid TAKATAK identityId is required." };
  }
  if (!sourcePaymentId || sourcePaymentId.length > 200) {
    return { valid: false, error: "A valid sourcePaymentId is required." };
  }

  return {
    valid: true,
    event: {
      eventId,
      type,
      occurredAt,
      identityId,
      sourcePaymentId,
    },
  };
}
