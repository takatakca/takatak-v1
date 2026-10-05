import {
  QUEUE_NAMES,
  queueEnabled,
  webhookQueueEnabled,
  type UsedQueueName,
} from "@/lib/queue/names";
import { parseJobPayload, type JobPayload } from "@/lib/queue/payloads";

/**
 * Wake a Redis worker after the Postgres social job is already durable.
 * Missing Redis, a disabled flag, or a slow broker must not fail the request.
 * The existing cron and `worker:social-sync` remain the MochaHost consumers.
 */
export async function signalQueueJob(input: {
  queue: UsedQueueName;
  payload: JobPayload;
}): Promise<void> {
  if (!queueEnabled()) {
    return;
  }

  let parsed: JobPayload;
  try {
    parsed = parseJobPayload(input.payload);
  } catch {
    return;
  }

  const work = import("@/lib/queue/queues")
    .then(({ enqueueIdentifierJob }) =>
      enqueueIdentifierJob({ queue: input.queue, payload: parsed }),
    )
    .then(() => undefined)
    .catch(() => undefined);

  await Promise.race([
    work,
    new Promise<void>((resolve) => {
      setTimeout(resolve, 1_500);
    }),
  ]);
}

/**
 * Signature checks stay in the HTTP route. This only runs after that check.
 * Returns false unless webhook queueing is explicitly enabled, so MochaHost
 * keeps applying Stripe events inline.
 */
export async function deferProviderWebhook(payload: JobPayload): Promise<boolean> {
  if (!webhookQueueEnabled()) {
    return false;
  }
  if (payload.provider !== "stripe" && payload.provider !== "stripe_hockey") {
    return false;
  }

  try {
    const parsed = parseJobPayload(payload);
    const { enqueueIdentifierJob } = await import("@/lib/queue/queues");
    await enqueueIdentifierJob({
      queue: QUEUE_NAMES.webhooks,
      payload: parsed,
    });
    return true;
  } catch {
    return false;
  }
}
