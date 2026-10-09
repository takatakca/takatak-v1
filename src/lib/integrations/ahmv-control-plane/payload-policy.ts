const FORBIDDEN_KEY_PARTS = [
  "authorization",
  "cookie",
  "password",
  "passwd",
  "secret",
  "apikey",
  "privatekey",
  "accesstoken",
  "refreshtoken",
  "authtoken",
  "twilioauth",
  "stripesecret",
] as const;

const MAX_DEPTH = 8;
const MAX_JSON_BYTES = 64 * 1024;
const MAX_ARRAY_ITEMS = 500;
const MAX_OBJECT_KEYS = 250;

function isForbiddenKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return FORBIDDEN_KEY_PARTS.some((part) => normalized.includes(part));
}

export function assertSafeAhmvControlPayload(payload: unknown): void {
  const json = JSON.stringify(payload);
  if (Buffer.byteLength(json, "utf8") > MAX_JSON_BYTES) {
    throw new Error("ahmv_control_payload_too_large");
  }
  inspect(payload, 0);
}

function inspect(value: unknown, depth: number): void {
  if (depth > MAX_DEPTH) throw new Error("ahmv_control_payload_too_deep");
  if (value === null || typeof value !== "object") return;

  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) {
      throw new Error("ahmv_control_payload_too_many_items");
    }
    for (const item of value) inspect(item, depth + 1);
    return;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_OBJECT_KEYS) {
    throw new Error("ahmv_control_payload_too_many_keys");
  }

  for (const [key, child] of entries) {
    if (isForbiddenKey(key)) {
      throw new Error(`ahmv_control_payload_forbidden_key:${key}`);
    }
    inspect(child, depth + 1);
  }
}
