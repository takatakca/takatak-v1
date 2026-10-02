// Parses report/analytics filters from a query string and applies the signed-in user's location scope.
import type { AuthUser } from './auth';
import { scopeFilter } from './auth';
import { isChannelKey } from './adapters';
import { startOfLocalDayMs } from './time';
import type { ChannelKey, OrderStatus } from './types';

const list = (v: string | null) => (v || '').split(',').map((x) => x.trim()).filter(Boolean);

/** from/to accept YYYY-MM-DD (local business days, `to` inclusive) or full ISO timestamps. */
export function parseRange(q: URLSearchParams, defaultDays = 1): { from: string; to: string } {
  const now = Date.now();
  const day = (s: string) => startOfLocalDayMs(Date.parse(`${s}T12:00:00Z`));
  const fromQ = q.get('from'); const toQ = q.get('to');
  const from = fromQ ? (/^\d{4}-\d{2}-\d{2}$/.test(fromQ) ? day(fromQ) : Date.parse(fromQ)) : startOfLocalDayMs(now - (defaultDays - 1) * 86400_000);
  const to = toQ ? (/^\d{4}-\d{2}-\d{2}$/.test(toQ) ? startOfLocalDayMs(day(toQ) + 36 * 3600_000) : Date.parse(toQ)) : startOfLocalDayMs(startOfLocalDayMs(now) + 36 * 3600_000);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) throw new Error('Invalid date range.');
  if (to - from > 400 * 86400_000) throw new Error('Pick a range of 400 days or less.');
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
}

export function parseFilters(q: URLSearchParams, actor: AuthUser) {
  return {
    locationCodes: scopeFilter(actor, list(q.get('locations'))),
    channels: list(q.get('channels')).filter(isChannelKey) as ChannelKey[],
    brands: list(q.get('brands')),
    statuses: list(q.get('statuses')) as OrderStatus[],
  };
}
