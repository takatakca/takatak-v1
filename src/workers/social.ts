import { UnrecoverableError, Worker, type Job } from "bullmq";

import { QUEUE_NAMES, queuePrefix } from "@/lib/queue/names";
import {
  isPermanentUnauthorized,
  parseJobPayload,
  type JobPayload,
} from "@/lib/queue/payloads";
import { bullmqConnection } from "@/lib/queue/redis";
import { installShutdown } from "@/workers/shutdown";

async function runPageSync(payload: JobPayload): Promise<void> {
  if (!payload.workspaceId) {
    throw new UnrecoverableError("missing_workspace");
  }
  const { runFacebookPageSyncWorkerTick } = await import(
    "@/lib/social/sync/facebook-page-sync-job"
  );
  await runFacebookPageSyncWorkerTick({
    clientId: payload.workspaceId,
    limit: 1,
    processJobs: true,
  });
}

async function runAnalytics(payload: JobPayload): Promise<void> {
  if (!payload.workspaceId) {
    throw new UnrecoverableError("missing_workspace");
  }
  const { getPrisma } = await import("@/lib/db/prisma");
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("database_unavailable");
  }
  const row = await prisma.job.findFirst({
    where: {
      id: payload.eventId,
      clientId: payload.workspaceId,
    },
    select: { id: true },
  });
  if (!row) {
    throw new UnrecoverableError("job_not_in_workspace");
  }
  const { processFacebookCompetitorJob } = await import(
    "@/lib/social/sync/facebook-competitor-sync-job"
  );
  await processFacebookCompetitorJob(payload.eventId);
}

async function processJob(
  name: typeof QUEUE_NAMES.socialSync | typeof QUEUE_NAMES.analyticsSync,
  job: Job,
): Promise<void> {
  const payload = parseJobPayload(job.data);
  try {
    if (name === QUEUE_NAMES.analyticsSync) {
      await runAnalytics(payload);
      return;
    }
    await runPageSync(payload);
  } catch (error) {
    if (error instanceof UnrecoverableError) {
      throw error;
    }
    if (isPermanentUnauthorized(error)) {
      throw new UnrecoverableError("permanent_unauthorized");
    }
    throw error;
  }
}

function start(name: typeof QUEUE_NAMES.socialSync | typeof QUEUE_NAMES.analyticsSync) {
  const worker = new Worker(name, (job) => processJob(name, job), {
    connection: bullmqConnection(),
    prefix: queuePrefix(),
    concurrency: 1,
    limiter: { max: 5, duration: 10_000 },
  });
  worker.on("error", (error) => {
    console.error(
      JSON.stringify({
        worker: "social",
        queue: name,
        outcome: "error",
        error: error.name,
      }),
    );
  });
  worker.on("failed", (job, error) => {
    console.error(
      JSON.stringify({
        worker: "social",
        queue: name,
        outcome: "failed",
        jobId: job?.id ?? null,
        error: error.name,
        permanent: error instanceof UnrecoverableError,
      }),
    );
  });
  return worker;
}

try {
  const workers = [
    start(QUEUE_NAMES.socialSync),
    start(QUEUE_NAMES.analyticsSync),
  ];
  console.log(
    JSON.stringify({
      worker: "social",
      outcome: "started",
      queues: [QUEUE_NAMES.socialSync, QUEUE_NAMES.analyticsSync],
    }),
  );
  installShutdown(async () => {
    await Promise.all(workers.map((worker) => worker.close()));
  });
} catch (error) {
  console.error(
    JSON.stringify({
      worker: "social",
      outcome: "refused",
      error: error instanceof Error ? error.message : "error",
    }),
  );
  process.exit(1);
}
