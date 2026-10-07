const IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;

export const QUEUE_PROVIDERS = [
  "meta",
  "google",
  "instagram",
  "threads",
  "tiktok",
  "x",
  "youtube",
  "stripe",
  "stripe_hockey",
  "internal",
] as const;

export type QueueProvider = (typeof QUEUE_PROVIDERS)[number];

export type JobPayload = {
  workspaceId: string | null;
  connectionId: string | null;
  provider: QueueProvider;
  eventId: string;
};

const ALLOWED_KEYS = new Set([
  "workspaceId",
  "connectionId",
  "provider",
  "eventId",
]);

function identifier(value: unknown, field: string): string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    throw new Error(`invalid_${field}`);
  }
  return value;
}

function optionalIdentifier(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return identifier(value, field);
}

export function parseJobPayload(value: unknown): JobPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_payload");
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new Error("invalid_payload");
    }
  }

  const provider = record.provider;
  if (
    typeof provider !== "string" ||
    !QUEUE_PROVIDERS.includes(provider as QueueProvider)
  ) {
    throw new Error("invalid_provider");
  }

  return {
    workspaceId: optionalIdentifier(record.workspaceId, "workspace"),
    connectionId: optionalIdentifier(record.connectionId, "connection"),
    provider: provider as QueueProvider,
    eventId: identifier(record.eventId, "event"),
  };
}

export function isPermanentUnauthorized(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (
    /timeout|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|ECONNRESET|redis|429|rate limit|502|503|504/i.test(
      message,
    )
  ) {
    return false;
  }
  return /\b401\b|unauthorized|invalid_grant|authentication credentials/i.test(
    message,
  );
}
