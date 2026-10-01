import type {
  OneLvAggregateType,
  OneLvEvent,
  OneLvEventType,
} from "./types";

const eventTypes = new Set<OneLvEventType>([
  "customer.created",
  "customer.updated",
  "merchant.application.created",
  "merchant.approved",
  "merchant.suspended",
  "merchant.updated",
  "customer.vendor.first_order",
  "customer.vendor.order_completed",
  "customer.vendor.dispute_opened",
  "order.created",
  "order.paid",
  "order.fulfilled",
  "order.refunded",
]);

const aggregateTypes = new Set<OneLvAggregateType>([
  "customer",
  "merchant",
  "order",
  "relationship",
]);

const forbiddenFields = new Set([
  "password",
  "passwordHash",
  "otp",
  "otpCode",
  "session",
  "sessionToken",
  "accessToken",
  "refreshToken",
  "authorization",
  "serviceRoleKey",
  "stripeSecretKey",
  "clientSecret",
  "cardNumber",
  "cvc",
  "cvv",
]);

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function containsForbiddenField(
  value: unknown,
): boolean {
  if (Array.isArray(value)) {
    return value.some(containsForbiddenField);
  }

  if (!isObject(value)) {
    return false;
  }

  return Object.entries(value).some(
    ([key, nestedValue]) =>
      forbiddenFields.has(key) ||
      containsForbiddenField(nestedValue),
  );
}

function validString(
  value: unknown,
  maximumLength = 500,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximumLength
  );
}

export function parseOneLvEvent(
  rawBody: string,
):
  | { valid: true; event: OneLvEvent }
  | { valid: false; error: string } {
  let body: unknown;

  try {
    body = JSON.parse(rawBody);
  } catch {
    return {
      valid: false,
      error: "Invalid JSON body.",
    };
  }

  if (!isObject(body)) {
    return {
      valid: false,
      error: "Body must be a JSON object.",
    };
  }

  if (containsForbiddenField(body)) {
    return {
      valid: false,
      error: "Payload contains a forbidden field.",
    };
  }

  if (
    !validString(body.event_id, 200) ||
    !validString(body.event_type, 100) ||
    !eventTypes.has(body.event_type as OneLvEventType) ||
    !validString(body.aggregate_type, 50) ||
    !aggregateTypes.has(
      body.aggregate_type as OneLvAggregateType,
    ) ||
    !validString(body.aggregate_id, 250) ||
    body.source_application !== "1lv" ||
    !isObject(body.payload)
  ) {
    return {
      valid: false,
      error: "Required event fields are invalid.",
    };
  }

  const expectedAggregate: Record<
    OneLvEventType,
    OneLvAggregateType
  > = {
    "customer.created": "customer",
    "customer.updated": "customer",
    "merchant.application.created": "merchant",
    "merchant.approved": "merchant",
    "merchant.suspended": "merchant",
    "merchant.updated": "merchant",
    "customer.vendor.first_order": "relationship",
    "customer.vendor.order_completed": "relationship",
    "customer.vendor.dispute_opened": "relationship",
    "order.created": "order",
    "order.paid": "order",
    "order.fulfilled": "order",
    "order.refunded": "order",
  };

  const eventType =
    body.event_type as OneLvEventType;
  const aggregateType =
    body.aggregate_type as OneLvAggregateType;

  if (expectedAggregate[eventType] !== aggregateType) {
    return {
      valid: false,
      error:
        "Event type does not match aggregate type.",
    };
  }

  return {
    valid: true,
    event: {
      event_id: body.event_id.trim(),
      event_type: eventType,
      aggregate_type: aggregateType,
      aggregate_id: body.aggregate_id.trim(),
      source_application: "1lv",
      payload: body.payload,
    },
  };
}
