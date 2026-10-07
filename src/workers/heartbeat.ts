import { writeFileSync } from "node:fs";

const HEARTBEAT_PATH = "/tmp/takatak-worker-heartbeat";

/** Coolify's container health check reads this file for non-web processes. */
export function startWorkerHeartbeat(): () => void {
  const beat = () => {
    try {
      writeFileSync(HEARTBEAT_PATH, String(Date.now()));
    } catch {
      return;
    }
  };
  beat();
  const timer = setInterval(beat, 10_000);
  timer.unref();
  return () => {
    clearInterval(timer);
  };
}
