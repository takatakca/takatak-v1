import { scopeFilter, withPerm } from '@/lib/food-hub/auth';
import { fail, ok } from '@/lib/food-hub/http';
import { parseRange } from '@/lib/food-hub/report-filter';
import { getRepo } from '@/lib/food-hub/repo';
import type { ActivityKind } from '@/lib/food-hub/types';

export const dynamic = 'force-dynamic';

// Activity log (Atlas "Store Action Report"): who did what, when, where, and the result.
export const GET = withPerm('analytics:view', async (req, _ctx, actor) => {
  const q = new URL(req.url).searchParams;
  const kinds = (q.get('kinds') || '').split(',').filter(Boolean) as ActivityKind[];
  let since: string | undefined; let until: string | undefined;
  if (q.get('from') || q.get('to')) {
    try { const r = parseRange(q, 1); since = r.from; until = r.to; } catch (e) { return fail(e instanceof Error ? e.message : String(e)); }
  }
  const entries = await getRepo().listActivity({
    since, until, kinds,
    locationCodes: scopeFilter(actor, (q.get('locations') || '').split(',').filter(Boolean)), limit: Math.min(Number(q.get('limit') || 500), 5000),
  });
  const search = (q.get('q') || '').toLowerCase();
  return ok({ entries: search ? entries.filter((e) => `${e.summary} ${e.actor}`.toLowerCase().includes(search)) : entries });
});
