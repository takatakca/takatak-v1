import { UnrecoverableError, Worker, type Job } from "bullmq";

import { QUEUE_NAMES, queuePrefix } from "@/lib/queue/names";
import {
  isPermanentUnauthorized,
  parseJobPayload,
} from "@/lib/queue/payloads";
import { bullmqConnection } from "@/lib/queue/redis";
import { ServiceError } from "@/lib/services/service-error";
import { installShutdown } from "@/workers/shutdown";

function statusCode(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("statusCode" in error)) {
    return null;
  }
  const status = (error as { statusCode?: unknown }).statusCode;
  return typeof status === "number" ? status : null;
}

function asPermanent(error: unknown): UnrecoverableError | null {
  if (error instanceof UnrecoverableError) {
    return error;
  }
  if (error instanceof ServiceError && (error.status === 401 || error.status === 403)) {
    return new UnrecoverableError("permanent_unauthorized");
  }
  const status = statusCode(error);
  if (status === 401 || status === 403 || status === 404) {
    return new UnrecoverableError("permanent_unauthorized");
  }
  if (isPermanentUnauthorized(error)) {
    return new UnrecoverableError("permanent_unauthorized");
  }
  return null;
}

async function processWebhook(job: Job): Promise<void> {
  const payload = parseJobPayload(job.data);
  try {
    if (payload.provider === "stripe") {
      const { getStripe } = await import("@/lib/billing/social/stripe-client");
      const { applySocialStripeWebhookEvent } = await import(
        "@/lib/billing/social/stripe-webhook-apply"
      );
      const event = await getStripe().events.retrieve(payload.eventId);
      await applySocialStripeWebhookEvent(event);
      return;
    }
    if (payload.provider === "stripe_hockey") {
      const { getHockeyStripe } = await import("@/lib/billing/hockey/stripe-client");
      const { applyHockeyStripeWebhookEvent } = await import(
        "@/lib/billing/hockey/stripe-webhook-apply"
      );
      const event = await getHockeyStripe().events.retrieve(payload.eventId);
      await applyHockeyStripeWebhookEvent(event);
      return;
    }
    throw new UnrecoverableError("unsupported_provider");
  } catch (error) {
    const permanent = asPermanent(error);
    if (permanent) {
      throw permanent;
    }
    throw error;
  }
}

try {
  const worker = new Worker(QUEUE_NAMES.webhooks, processWebhook, {
    connection: bullmqConnection(),
    prefix: queuePrefix(),
    concurrency: 2,
    limiter: { max: 20, duration: 1_000 },
  });
  worker.on("error", (error) => {
    console.error(
      JSON.stringify({
        worker: "webhooks",
        outcome: "error",
        error: error.name,
      }),
    );
  });
  worker.on("failed", (job, error) => {
    console.error(
      JSON.stringify({
        worker: "webhooks",
        outcome: "failed",
        jobId: job?.id ?? null,
        error: error.name,
        permanent: error instanceof UnrecoverableError,
      }),
    );
  });
  console.log(
    JSON.stringify({
      worker: "webhooks",
      outcome: "started",
      queues: [QUEUE_NAMES.webhooks],
    }),
  );
  installShutdown(async () => {
    await worker.close();
  });
} catch (error) {
  console.error(
    JSON.stringify({
      worker: "webhooks",
      outcome: "refused",
      error: error instanceof Error ? error.message : "error",
    }),
  );
  process.exit(1);
}
