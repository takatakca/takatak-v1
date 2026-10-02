import { isChannelKey } from '@/lib/food-hub/adapters';
import { withPerm } from '@/lib/food-hub/auth';
import { getHours } from '@/lib/food-hub/hours';
import { fail, ok, readJson } from '@/lib/food-hub/http';
import { cancelScheduled, listScheduled, schedulePublish } from '@/lib/food-hub/menu/schedule';
import { getMenuLanguages } from '@/lib/food-hub/menu/language';
import { verifyMenu } from '@/lib/food-hub/menu/verify';
import { publishMenu } from '@/lib/food-hub/ops';
import { getRepo } from '@/lib/food-hub/repo';
import type { ChannelKey } from '@/lib/food-hub/types';

export const dynamic = 'force-dynamic';

// Publish status for a brand: verification result, latest result per mapped store, scheduled publishes.
export const GET = withPerm('menu:edit', async (req) => {
  const brand = new URL(req.url).searchParams.get('brand');
  if (!brand) return fail('brand is required');
  const repo = getRepo();
  const [menu, stores, jobs, hours] = await Promise.all([repo.getMenu(brand), repo.listStores(), repo.listJobs(500), getHours()]);
  const mine = stores.filter((s) => s.brandName === brand);
  const status = mine.map((s) => {
    const job = jobs.find((j) => j.kind === 'menu_push' && j.request?.storeId === s.id);
    return { storeId: s.id, channel: s.channel, locationCode: s.locationCode, channelStoreId: s.channelStoreId, status: job?.status ?? 'never', at: job?.updatedAt ?? null, message: (job?.result as { message?: string } | undefined)?.message ?? null };
  });
  return ok({ check: menu ? verifyMenu(menu, { stores, hours, languages: await getMenuLanguages() }) : null, stores: status, scheduled: await listScheduled(brand) });
});

// Publish now, or schedule (body.at = ISO date-time). Verification errors block the publish.
export const POST = withPerm('menu:edit', async (req, _ctx, actor) => {
  const b = await readJson(req);
  if (!b.brand) return fail('brand is required');
  const brand = String(b.brand);
  const repo = getRepo();
  const menu = await repo.getMenu(brand);
  if (!menu) return fail(`No master menu saved for ${brand}. Import from Clover or create items first.`, 409);
  const stores = await repo.listStores();
  const check = verifyMenu(menu, { stores, hours: await getHours() });
  if (!check.ok) return fail(`Fix ${check.errors.length} error(s) before publishing: ${check.errors.slice(0, 3).map((e) => e.message).join(' ')}`, 422, { check });
  const channels = (Array.isArray(b.channels) ? b.channels : []).filter((c: string) => isChannelKey(c)) as ChannelKey[];
  let storeIds: string[] | undefined = Array.isArray(b.storeIds) && b.storeIds.length ? b.storeIds.map(String) : undefined;
  // A manager limited to some locations only publishes to the stores at those locations.
  if (actor.locations.length) {
    storeIds = stores.filter((s) => s.brandName === brand && actor.locations.includes(s.locationCode) && (!storeIds || storeIds.includes(s.id))).map((s) => s.id);
    if (!storeIds.length) return fail(`No ${brand} stores at your locations.`, 403);
  }
  if (!stores.some((s) => s.brandName === brand && (!storeIds || storeIds.includes(s.id)))) return fail(`No stores are mapped for ${brand}. Map them in Food Hub → Stores first.`, 409);
  if (b.at) {
    try {
      const scheduled = await schedulePublish({ brand, storeIds, channels: channels.length ? channels : undefined, at: String(b.at) }, actor);
      return ok({ scheduled, check });
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  }
  const results = await publishMenu(brand, { storeIds, channels, actor });
  return ok({ results, check });
});

export const DELETE = withPerm('menu:edit', async (req, _ctx, actor) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail('id is required');
  if (!(await cancelScheduled(id, actor))) return fail('No scheduled publish with that id (it may already have run).', 404);
  return ok();
});
