import { isChannelKey } from '@/lib/food-hub/adapters';
import { logActivity } from '@/lib/food-hub/activity';
import { inScope, withPerm } from '@/lib/food-hub/auth';
import { fail, ok, readJson } from '@/lib/food-hub/http';
import { getRepo } from '@/lib/food-hub/repo';

export const dynamic = 'force-dynamic';

export const GET = withPerm('view', async (_req, _ctx, actor) => {
  const repo = getRepo();
  return ok({ mode: repo.mode, stores: (await repo.listStores()).filter((s) => inScope(actor, s.locationCode)) });
});

// Create or update a store mapping (channel store id → brand + location + Clover merchant).
export const POST = withPerm('stores:map', async (req, _ctx, actor) => {
  const b = await readJson(req);
  if (!isChannelKey(String(b.channel))) return fail('channel must be one of uber_eats, doordash, skip, tgtg');
  if (!b.channelStoreId || !b.brandName || !b.locationCode) return fail('channelStoreId, brandName and locationCode are required');
  const repo = getRepo();
  const existing = b.id ? await repo.getStore(String(b.id)) : await repo.findStore(b.channel, String(b.channelStoreId).trim());
  const store = await repo.upsertStore({
    id: existing?.id,
    channel: b.channel,
    channelStoreId: String(b.channelStoreId).trim(),
    brandName: String(b.brandName),
    locationCode: String(b.locationCode),
    cloverMerchantId: b.cloverMerchantId ? String(b.cloverMerchantId).trim() : existing?.cloverMerchantId ?? null,
    autoAccept: b.autoAccept === undefined ? existing?.autoAccept ?? true : Boolean(b.autoAccept),
    online: existing?.online ?? true,
    pausedUntil: existing?.pausedUntil ?? null,
    lastStatusSource: existing?.lastStatusSource ?? null,
    meta: existing?.meta ?? {},
  });
  await logActivity({ actor: actor.name, source: actor.source, kind: 'settings', action: existing ? 'store_mapping_updated' : 'store_mapped', status: 'success', channel: store.channel, brandName: store.brandName, locationCode: store.locationCode, storeId: store.id,
    summary: `${existing ? 'Updated' : 'Mapped'} ${store.channel} store ${store.channelStoreId} → ${store.brandName} · ${store.locationCode}` });
  return ok({ store });
});

export const DELETE = withPerm('stores:map', async (req, _ctx, actor) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail('id is required');
  const store = await getRepo().getStore(id);
  await getRepo().deleteStore(id);
  if (store) await logActivity({ actor: actor.name, source: actor.source, kind: 'settings', action: 'store_unmapped', status: 'success', channel: store.channel, brandName: store.brandName, locationCode: store.locationCode, summary: `Removed ${store.channel} store ${store.channelStoreId} (${store.brandName} · ${store.locationCode})` });
  return ok();
});
