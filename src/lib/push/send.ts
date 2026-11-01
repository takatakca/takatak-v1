// Sends one payload-less push to each target (RFC 8030 + VAPID). The service
// worker then fetches the live campaign itself, so nothing here can promise
// an offer the server does not have.

import { pushOutcome, vapidAuthorization, type VapidKeys } from "./subscription";

export type PushFetch = (url: string, init: { method: "POST"; headers: Record<string, string>; signal: AbortSignal }) => Promise<{ status: number }>;

export interface PushSendReport {
  sent: number;
  gone: string[];
  failed: number;
}

const TIMEOUT_MS = 10_000;
const CONCURRENCY = 8;

export async function sendPushToAll(
  targets: ReadonlyArray<{ id: string; endpoint: string }>,
  vapid: VapidKeys,
  fetchImpl: PushFetch = fetch as unknown as PushFetch,
): Promise<PushSendReport> {
  const report: PushSendReport = { sent: 0, gone: [], failed: 0 };
  const auth = new Map<string, string>();
  let next = 0;

  async function one(target: { id: string; endpoint: string }) {
    const origin = new URL(target.endpoint).origin;
    if (!auth.has(origin)) auth.set(origin, await vapidAuthorization(target.endpoint, vapid));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetchImpl(target.endpoint, {
        method: "POST",
        headers: { Authorization: auth.get(origin)!, TTL: "86400", Urgency: "normal", "Content-Length": "0" },
        signal: controller.signal,
      });
      const outcome = pushOutcome(res.status);
      if (outcome === "sent") report.sent += 1;
      else if (outcome === "gone") report.gone.push(target.endpoint);
      else report.failed += 1;
    } catch {
      report.failed += 1;
    } finally {
      clearTimeout(timer);
    }
  }

  async function worker() {
    while (next < targets.length) {
      const target = targets[next++];
      await one(target);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
  return report;
}
