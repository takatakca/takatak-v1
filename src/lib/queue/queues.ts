import { Queue } from "bullmq";

import { defaultJobOptions } from "@/lib/queue/job-options";
import {
  queuePrefix,
  type UsedQueueName,
} from "@/lib/queue/names";
import { parseJobPayload, type JobPayload } from "@/lib/queue/payloads";
import { bullmqConnection } from "@/lib/queue/redis";

const queues = new Map<UsedQueueName, Queue>();

export function getQueue(name: UsedQueueName): Queue {
  const existing = queues.get(name);
  if (existing) {
    return existing;
  }

  const queue = new Queue(name, {
    connection: bullmqConnection(),
    prefix: queuePrefix(),
    defaultJobOptions: defaultJobOptions(),
  });
  queues.set(name, queue);
  return queue;
}

function bullJobId(queue: UsedQueueName, eventId: string): string {
  return `${queue}_${eventId}`;
}

function isDuplicateJob(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /already exists|jobid|duplicate/i.test(message);
}

export async function enqueueIdentifierJob(input: {
  queue: UsedQueueName;
  payload: JobPayload;
}): Promise<"queued" | "duplicate"> {
  const payload = parseJobPayload(input.payload);
  const queue = getQueue(input.queue);
  try {
    await queue.add(input.queue, payload, {
      ...defaultJobOptions(),
      jobId: bullJobId(input.queue, payload.eventId),
    });
    return "queued";
  } catch (error) {
    if (isDuplicateJob(error)) {
      return "duplicate";
    }
    throw error;
  }
}

export async function closeQueues(): Promise<void> {
  const open = [...queues.values()];
  queues.clear();
  await Promise.all(open.map((queue) => queue.close()));
}
