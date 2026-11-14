import crypto from 'node:crypto';
import { liveConnectorsGloballyEnabled, missingEnv, timedFetch } from './env-utils';
import type { ChannelKey, ChannelResult, Marketplace } from './types';

export { liveConnectorsGloballyEnabled, missingEnv, timedFetch };

export const CHANNEL_LABELS: Record<ChannelKey, string> = {
  uber_eats: 'Uber Eats',
  doordash: 'DoorDash',
  skip: 'SkipTheDishes',
  tgtg: 'Too Good To Go',
};

/** Every channel is direct, so the channel IS the marketplace. */
export const CHANNEL_MARKETPLACE: Record<ChannelKey, Marketplace> = {
  uber_eats: 'uber_eats',
  doordash: 'doordash',
  skip: 'skip',
  tgtg: 'tgtg',
};

export const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  uber_eats: 'Uber Eats',
  doordash: 'DoorDash',
  skip: 'SkipTheDishes',
  tgtg: 'Too Good To Go',
  other: 'Other',
};

export const toCents = (n: number) => Math.round((Number(n) || 0) * 100);
export const fromCents = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) / 100 : 0);
export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function nowIso() { return new Date().toISOString(); }

export function stripSlash(url: string) { return url.replace(/\/+$/, ''); }

/** Constant-time string comparison that tolerates different lengths. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Shared-secret header check for webhooks that do not sign payloads (DoorDash, TGTG). */
export function checkSharedSecret(headers: Headers, envKey: string, headerNames: string[]): boolean {
  const expected = process.env[envKey];
  if (!expected) return false;
  for (const name of headerNames) {
    const value = headers.get(name);
    if (!value) continue;
    const token = value.replace(/^(Bearer|Basic|Token)\s+/i, '').trim();
    if (safeEqual(token, expected) || safeEqual(value.trim(), expected)) return true;
  }
  return false;
}

export function result(channel: ChannelKey, status: ChannelResult['status'], message: string, extra: Partial<ChannelResult> = {}): ChannelResult {
  return { channel, ok: status === 'done' || status === 'queued' || status === 'skipped', status, message, ...extra };
}

/** Calls an HTTP API and converts the outcome into a ChannelResult. Never throws. */
export async function callApi(channel: ChannelKey, url: string, init: RequestInit, okStatus: ChannelResult['status'] = 'done'): Promise<ChannelResult> {
  try {
    const res = await timedFetch(url, init);
    const text = await res.text();
    let body: unknown = text;
    try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
    if (!res.ok) {
      return result(channel, 'error', `${init.method || 'GET'} ${new URL(url).pathname} returned HTTP ${res.status}`, { httpStatus: res.status, response: body });
    }
    const reference = typeof body === 'object' && body && ('reference_id' in body || 'reference' in body)
      ? String((body as Record<string, unknown>).reference_id ?? (body as Record<string, unknown>).reference)
      : undefined;
    return result(channel, okStatus, 'OK', { httpStatus: res.status, response: body, reference });
  } catch (error) {
    return result(channel, 'error', `Network error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Public base URL of this deployment, used to show webhook URLs in the dashboard. */
export function publicBaseUrl(): string {
  return stripSlash(process.env.FOODHUB_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'));
}

