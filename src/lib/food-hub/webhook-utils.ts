import { after, NextResponse } from 'next/server';
import { getRepo } from './repo';
import { processIncomingOrder } from './pipeline';
import type { ChannelKey, NormalizedOrder } from './types';

/** Run work after the HTTP response is sent (platforms need a fast 200), and never let it crash silently. */
export function background(label: string, work: () => Promise<unknown>) {
  after(async () => {
    try {
      await work();
    } catch (error) {
      console.error(`[foodhub] ${label} failed:`, error);
    }
  });
}

export function unauthorized(channel: ChannelKey) {
  return NextResponse.json({ ok: false, error: `Webhook signature/token check failed for ${channel}.` }, { status: 401 });
}

export function parseJson(raw: string): any | undefined {
  try { return raw ? JSON.parse(raw) : {}; } catch { return undefined; }
}

export function queueOrder(order: NormalizedOrder) {
  background(`order ${order.channel}:${order.externalOrderId}`, () => processIncomingOrder(order));
}

/** Keep payloads we could not parse so nothing is silently lost. */
export async function keepUnparsed(channel: ChannelKey, body: unknown, reason: string) {
  await getRepo().addJob({ kind: 'webhook_unparsed', channel, reference: null, status: 'error', request: { body: body as Record<string, unknown> }, result: { reason } });
}
