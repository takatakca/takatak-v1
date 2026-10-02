import { NextResponse, type NextRequest } from 'next/server';
import { skipAdapter } from '@/lib/food-hub/adapters/skip';
import { logActivity } from '@/lib/food-hub/activity';
import { nowIso } from '@/lib/food-hub/config';
import { getRepo } from '@/lib/food-hub/repo';
import type { PlatformStatus } from '@/lib/food-hub/types';
import { background, parseJson, unauthorized } from '@/lib/food-hub/webhook-utils';

export const dynamic = 'force-dynamic';

// JET Connect "Restaurant Temporarily Offline Notification":
// { restaurantId, lastChangedTimeStampUtc, delivery: { isOffline }, collection: { isOffline } }
// Skip can take a store offline on its side (e.g. too many missed orders) — this keeps Food Hub in sync.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!skipAdapter.verifyWebhook(req.headers, raw)) return unauthorized('skip');
  const body = parseJson(raw);
  if (!body?.restaurantId) return NextResponse.json({ error: 'restaurantId missing' }, { status: 400 });
  background(`skip offline ${body.restaurantId}`, async () => {
    const repo = getRepo();
    const store = await repo.findStore('skip', String(body.restaurantId));
    if (!store) return;
    const offline = Boolean(body.delivery?.isOffline) && body.collection?.isOffline !== false;
    await repo.updateStore(store.id, {
      online: !offline,
      lastStatusSource: 'skip:platform',
      meta: {
        ...store.meta,
        platformStatus: { state: offline ? 'paused' : 'online', detail: offline ? 'Taken offline by SkipTheDishes' : undefined, until: null, checkedAt: nowIso(), source: 'webhook' } satisfies PlatformStatus,
        skipOfflineNotice: body,
      },
    });
    if (store.online === offline) {
      await logActivity({ actor: 'SkipTheDishes', source: 'platform', kind: 'store_status', action: offline ? 'platform_paused' : 'platform_online', status: offline ? 'info' : 'success',
        channel: 'skip', brandName: store.brandName, locationCode: store.locationCode, storeId: store.id,
        summary: `${store.brandName} · ${store.locationCode} on SkipTheDishes ${offline ? 'taken offline by Skip' : 'back online'}` });
    }
  });
  return new NextResponse(null, { status: 200 });
}
