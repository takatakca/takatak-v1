import type { JobsOptions } from "bullmq";

/** Three attempts, exponential backoff. Permanent auth failures opt out. */
export function defaultJobOptions(): JobsOptions {
  return {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2_000,
    },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  };
}
