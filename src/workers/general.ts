import { SKIPPED_QUEUES } from "@/lib/queue/names";
import { startWorkerHeartbeat } from "@/workers/heartbeat";
import { installShutdown } from "@/workers/shutdown";

/**
 * General worker has no queue callers yet. It stays idle so a Coolify
 * service can be configured without competing with MochaHost work.
 * Do not start it in production while MochaHost workers are still running.
 */
console.log(
  JSON.stringify({
    worker: "general",
    outcome: "idle",
    queues: [],
    skipped: SKIPPED_QUEUES,
  }),
);

const stopHeartbeat = startWorkerHeartbeat();
installShutdown(async () => {
  stopHeartbeat();
});
