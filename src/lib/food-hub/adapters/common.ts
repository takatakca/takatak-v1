import { liveConnectorsGloballyEnabled, missingEnv, result, CHANNEL_LABELS } from '../config';
import type { ChannelKey, ChannelReadiness, ChannelResult } from '../types';

export function buildReadiness(channel: ChannelKey, required: string[], opts: { specConfirmed?: boolean; note?: string; extraMissing?: string[]; extraWebhooks?: Array<{ label: string; path: string }>; handoff?: Array<{ label: string; envKey: string }> } = {}): ChannelReadiness {
  const missing = [...missingEnv(required), ...(opts.extraMissing ?? [])];
  const configured = missing.length === 0;
  const live = liveConnectorsGloballyEnabled();
  const specConfirmed = opts.specConfirmed !== false;
  let note = opts.note ?? '';
  if (!configured) note = `Missing: ${missing.join(', ')}. ${note}`.trim();
  else if (!specConfirmed) note = note || 'Credentials present, but the partner API spec is not confirmed yet. Outbound calls stay blocked.';
  else if (!live) note = 'Credentials present. Set LIVE_CONNECTORS_GLOBAL_ENABLED=true to allow outbound calls.';
  else note = note || 'Live.';
  return {
    channel,
    label: CHANNEL_LABELS[channel],
    configured,
    canSend: configured && specConfirmed && live,
    missing,
    note,
    webhookPath: WEBHOOK_PATHS[channel],
    extraWebhooks: opts.extraWebhooks,
    handoff: opts.handoff,
  };
}

export const WEBHOOK_PATHS: Record<ChannelKey, string> = {
  uber_eats: '/api/food-hub/webhooks/uber-eats',
  doordash: '/api/food-hub/webhooks/doordash',
  skip: '/api/food-hub/webhooks/skip/orders',
  tgtg: '/api/food-hub/webhooks/tgtg',
};

export function blockedResult(channel: ChannelKey, readiness: ChannelReadiness): ChannelResult {
  return result(channel, 'blocked', readiness.note || 'Channel not ready for outbound calls.');
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
