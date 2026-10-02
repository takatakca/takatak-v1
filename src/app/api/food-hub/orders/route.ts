import { scopeFilter, withPerm } from '@/lib/food-hub/auth';
import { fail, ok } from '@/lib/food-hub/http';
import { allowedActions } from '@/lib/food-hub/pipeline';
import { parseRange } from '@/lib/food-hub/report-filter';
import { getRepo } from '@/lib/food-hub/repo';
import type { OrderStatus } from '@/lib/food-hub/types';

export const dynamic = 'force-dynamic';

const list = (v: string | null) => (v || '').split(',').map((x) => x.trim()).filter(Boolean);

// Orders list (Atlas "Orders"): date range, locations, platforms, brands, statuses, search by id/customer.
export const GET = withPerm('view', async (req, _ctx, actor) => {
  const q = new URL(req.url).searchParams;
  const statuses = list(q.get('status')) as OrderStatus[];
  const limit = Math.min(Number(q.get('limit') || 100), 5000);
  let since = q.get('since') || undefined;
  let until = q.get('until') || undefined;
  // from/to = local business days (YYYY-MM-DD, `to` inclusive) like the reports.
  if (q.get('from') || q.get('to')) {
    try { const r = parseRange(q, 1); since = r.from; until = r.to; } catch (e) { return fail(e instanceof Error ? e.message : String(e)); }
  }
  const repo = getRepo();
  let orders = await repo.listOrders({ statuses, limit, since, until, locationCodes: scopeFilter(actor, list(q.get('locations'))) });
  const channels = list(q.get('channels'));
  const brands = list(q.get('brands'));
  const search = (q.get('q') || '').trim().toLowerCase();
  if (channels.length) orders = orders.filter((o) => channels.includes(o.channel));
  if (brands.length) orders = orders.filter((o) => o.brandName && brands.includes(o.brandName));
  if (search) orders = orders.filter((o) => [o.id, o.externalOrderId, o.displayId, o.customerName, o.posOrderId].some((v) => v && String(v).toLowerCase().includes(search)));
  return ok({ mode: repo.mode, orders: orders.map((o) => ({ ...o, actions: allowedActions(o) })) });
});
