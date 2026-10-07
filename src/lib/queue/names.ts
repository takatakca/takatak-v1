export const QUEUE_NAMES = {
  socialSync: "social-sync",
  analyticsSync: "analytics-sync",
  webhooks: "webhooks",
} as const;

export type UsedQueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Named in the platform plan, with no background caller in this repository.
 * Do not create Redis queues for them until a real enqueue site exists.
 */
export const SKIPPED_QUEUES = [
  "email",
  "notifications",
  "site-sync",
  "imports",
  "reports",
] as const;

const PREFIX_PATTERN = /^[a-z0-9_-]{1,32}$/;

export function queuePrefix(): string {
  const raw = process.env.TAKATAK_QUEUE_PREFIX?.trim() || "takatak";
  if (!PREFIX_PATTERN.test(raw)) {
    throw new Error("TAKATAK_QUEUE_PREFIX is invalid");
  }
  return raw;
}

export function queueEnabled(): boolean {
  return (
    process.env.TAKATAK_QUEUE_ENABLED === "true" &&
    Boolean(process.env.REDIS_URL?.trim())
  );
}

export function webhookQueueEnabled(): boolean {
  return (
    process.env.TAKATAK_QUEUE_WEBHOOKS === "true" &&
    Boolean(process.env.REDIS_URL?.trim())
  );
}
