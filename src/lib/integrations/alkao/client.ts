import { createHmac, randomUUID } from "node:crypto";

import type { AlkaoState, PlannedEvent } from "./plan";

/**
 * Signed alkao.control.v1 calls (HMAC-SHA256 over "<timestamp>.<raw body>"), exactly as
 * documented in ALKAO's docs/ALKAO_CONTROL_CONTRACT_V1.md.
 */
export interface AlkaoTarget {
  url: string;
  keyId: string;
  secret: string;
}

const CONTRACT = "alkao.control.v1";

async function signedPost(target: AlkaoTarget, path: string, body: string, fetchImpl: typeof fetch) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = `v1=${createHmac("sha256", target.secret).update(`${timestamp}.${body}`).digest("hex")}`;
  return fetchImpl(`${target.url.replace(/\/+$/, "")}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-alkao-key-id": target.keyId,
      "x-alkao-timestamp": String(timestamp),
      "x-alkao-signature": signature,
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
}

export async function fetchAlkaoState(target: AlkaoTarget, fetchImpl: typeof fetch = fetch): Promise<AlkaoState[]> {
  const res = await signedPost(target, "/v1/control/state", JSON.stringify({ contract: CONTRACT }), fetchImpl);
  if (!res.ok) throw new Error(`ALKAO state request failed: ${res.status}`);
  const data = (await res.json()) as { clients?: AlkaoState[] };
  return data.clients ?? [];
}

export interface SendOutcome {
  label: string;
  status: number;
  outcome: string;
}

/** Send events in order; a refused event stops the rest (a child needs its parent). */
export async function sendAlkaoEvents(target: AlkaoTarget, events: PlannedEvent[], fetchImpl: typeof fetch = fetch): Promise<SendOutcome[]> {
  const results: SendOutcome[] = [];
  for (const e of events) {
    const body = JSON.stringify({ contract: CONTRACT, eventId: randomUUID(), issuedAt: new Date().toISOString(), type: e.type, data: e.data });
    let last: SendOutcome = { label: e.label, status: 0, outcome: "not_sent" };
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await signedPost(target, "/v1/control/events", body, fetchImpl);
        const data = (await res.json().catch(() => ({}))) as { outcome?: string; error?: { code?: string } };
        last = { label: e.label, status: res.status, outcome: data.outcome ?? data.error?.code ?? "error" };
        if (res.status < 500) break;
      } catch (error) {
        last = { label: e.label, status: 0, outcome: `network: ${(error as Error).message}` };
      }
    }
    results.push(last);
    if (last.status !== 200) break;
  }
  return results;
}
