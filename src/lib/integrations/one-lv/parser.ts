import { ONE_LV_EVENTS, type OneLvEnvelope } from "./types";

const forbidden = new Set([
  "password", "password_hash", "passwordHash", "otp", "otp_code", "otpCode",
  "session", "session_token", "sessionToken", "access_token", "refresh_token",
  "card_number", "cardNumber", "cvc", "cvv", "client_secret", "clientSecret",
]);

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasForbidden(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbidden);
  if (!object(value)) return false;
  return Object.entries(value).some(([key, nested]) => forbidden.has(key) || hasForbidden(nested));
}

function text(value: unknown, max = 200): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

export function parseOneLvEvent(raw: string):
  | { valid: true; event: OneLvEnvelope }
  | { valid: false; error: string } {
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return { valid: false, error: "Invalid JSON body." }; }
  if (!object(body)) return { valid: false, error: "Body must be a JSON object." };
  if (hasForbidden(body)) return { valid: false, error: "Payload contains a forbidden field." };
  if (
    !text(body.event_id) ||
    !text(body.event_type, 100) ||
    !(ONE_LV_EVENTS as readonly string[]).includes(body.event_type) ||
    !text(body.aggregate_type, 50) ||
    !["customer", "merchant", "order", "relationship"].includes(body.aggregate_type) ||
    !text(body.aggregate_id) ||
    body.source_application !== "1lv" ||
    !object(body.payload)
  ) return { valid: false, error: "Invalid 1LV event envelope." };
  if (JSON.stringify(body.payload).length > 75_000) {
    return { valid: false, error: "Event payload is too large." };
  }
  return { valid: true, event: body as OneLvEnvelope };
}
