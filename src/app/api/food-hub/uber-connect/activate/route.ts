import { uberEatsAdapter } from '@/lib/food-hub/adapters/uber-eats';
import { activateUberStores } from '@/lib/food-hub/adapters/uber-provision';
import { logActivity } from '@/lib/food-hub/activity';
import { withPerm } from '@/lib/food-hub/auth';
import { fail, ok, readJson } from '@/lib/food-hub/http';
import { getRepo } from '@/lib/food-hub/repo';

export const dynamic = 'force-dynamic';

// Activates the chosen Uber stores for this app and saves each store mapping in one click.
export const POST = withPerm('stores:map', async (req, _ctx, actor) => {
  const b = await readJson(req);
  const picks: Array<{ storeId: string; brandName: string; locationCode: string; cloverMerchantId?: string }> = Array.isArray(b.stores) ? b.stores : [];
  if (!b.id || !picks.length) return fail('id and at least one store are required');
  if (picks.some((p) => !p.storeId || !p.brandName || !p.locationCode)) return fail('Every store needs a brand and a location');
  const r = uberEatsAdapter.readiness();
  if (!r.canSend) return fail(`Activation changes your Uber stores, so it needs the live switch: ${r.note}`, 409);
  const results = await activateUberStores(String(b.id), picks);
  const repo = getRepo();
  for (const { storeId, result } of results) {
    if (!result.ok) continue;
    const p = picks.find((x) => x.storeId === storeId)!;
    const existing = await repo.findStore('uber_eats', storeId);
    await repo.upsertStore({
      id: existing?.id, channel: 'uber_eats', channelStoreId: storeId, brandName: p.brandName, locationCode: p.locationCode,
      cloverMerchantId: p.cloverMerchantId || existing?.cloverMerchantId || null, autoAccept: existing?.autoAccept ?? true,
      online: existing?.online ?? true, pausedUntil: existing?.pausedUntil ?? null, lastStatusSource: existing?.lastStatusSource ?? null,
      meta: { ...(existing?.meta ?? {}), provisionedAt: new Date().toISOString() },
    });
  }
  await logActivity({ actor: actor.name, source: actor.source, kind: 'settings', action: 'uber_activate', status: results.every((r) => r.result.ok) ? 'success' : 'failed', channel: 'uber_eats',
    summary: `Uber Eats store activation: ${results.filter((r) => r.result.ok).length}/${results.length} activated (${picks.map((p) => `${p.brandName} · ${p.locationCode}`).join(', ')})` });
  return ok({ results: results.map(({ storeId, result }) => ({ storeId, ok: result.ok, message: result.ok ? 'Activated and mapped' : result.message })) });
});
