import { inScope, withPerm } from '@/lib/food-hub/auth';
import { fail, ok, readJson } from '@/lib/food-hub/http';
import { setStoresOnline } from '@/lib/food-hub/ops';
import { getRepo } from '@/lib/food-hub/repo';

export const dynamic = 'force-dynamic';

// Pause / resume one or many stores on every channel. minutes = timed pause.
export const POST = withPerm('stores:toggle', async (req, _ctx, actor) => {
  const b = await readJson(req);
  const storeIds: string[] = Array.isArray(b.storeIds) ? b.storeIds.map(String) : [];
  if (!storeIds.length) return fail('storeIds is required');
  const stores = (await getRepo().listStores()).filter((s) => storeIds.includes(s.id));
  const outside = stores.filter((s) => !inScope(actor, s.locationCode));
  if (outside.length) return fail(`You can only pause stores at your locations (${actor.locations.join(', ')}).`, 403);
  const minutes = Number(b.minutes || 0);
  const results = await setStoresOnline(storeIds, Boolean(b.online), {
    untilMs: !b.online && minutes > 0 ? Date.now() + minutes * 60_000 : undefined,
    reason: b.reason ? String(b.reason) : undefined,
    actor,
  });
  return ok({ results });
});
