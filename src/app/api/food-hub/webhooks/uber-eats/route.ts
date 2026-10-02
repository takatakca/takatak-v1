import { NextResponse, type NextRequest } from 'next/server';
import { fetchUberOrder, parseUberOrder, uberEatsAdapter } from '@/lib/food-hub/adapters/uber-eats';
import { applyExternalStatus, processIncomingOrder } from '@/lib/food-hub/pipeline';
import { logActivity } from '@/lib/food-hub/activity';
import { nowIso } from '@/lib/food-hub/config';
import { handleUberReportWebhook } from '@/lib/food-hub/recon/automation';
import { getRepo } from '@/lib/food-hub/repo';
import type { PlatformStatus } from '@/lib/food-hub/types';
import { background, keepUnparsed, parseJson, unauthorized } from '@/lib/food-hub/webhook-utils';

export const dynamic = 'force-dynamic';

// Uber Eats Primary Webhook URL. Uber signs every request with X-Uber-Signature
// (HMAC-SHA256 of the raw body, keyed with the app client secret) and expects a fast 200.
// Orders must be accepted/denied within 11.5 minutes — Food Hub does it automatically.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!uberEatsAdapter.verifyWebhook(req.headers, raw)) return unauthorized('uber_eats');
  const body = parseJson(raw);
  if (body === undefined) return NextResponse.json({ ok: false }, { status: 400 });

  const event = String(body.event_type || '');
  const orderId = String(body.meta?.resource_id || '');

  if (event === 'orders.notification' || event === 'orders.scheduled.notification') {
    background(`uber order ${orderId}`, async () => {
      const details = await fetchUberOrder(body.resource_href || orderId);
      const order = parseUberOrder(details, body.meta?.user_id);
      if (!order) return keepUnparsed('uber_eats', details, 'Uber order details could not be parsed');
      await processIncomingOrder(order);
    });
  } else if (event === 'orders.cancel' || event === 'orders.failure') {
    background(`uber cancel ${orderId}`, () => applyExternalStatus('uber_eats', orderId, 'cancelled', { event }));
  } else if (event.startsWith('eats.report') || event.includes('report')) {
    // Reporting API: the requested payment report is ready → download, import, reconcile.
    if (/fail|error/i.test(event)) {
      background('uber report failed', () => logActivity({ actor: 'Uber Eats', source: 'platform', kind: 'settings', action: 'uber_report_failed', status: 'failed', channel: 'uber_eats', summary: `Uber could not build the requested report (${event})` }));
    } else background('uber report', () => handleUberReportWebhook(body));
  } else if (event === 'store.provisioned' || event === 'store.deprovisioned') {
    background(`uber ${event}`, async () => {
      const repo = getRepo();
      const storeId = String(body.meta?.resource_id || body.store_id || body.meta?.store_id || '');
      const store = storeId ? await repo.findStore('uber_eats', storeId) : null;
      const off = event === 'store.deprovisioned';
      if (store) await repo.updateStore(store.id, { meta: { ...store.meta, provisioned: !off, provisionChangedAt: nowIso() } });
      await logActivity({ actor: 'Uber Eats', source: 'platform', kind: 'store_status', action: off ? 'platform_deprovisioned' : 'platform_provisioned', status: off ? 'failed' : 'success', channel: 'uber_eats',
        brandName: store?.brandName, locationCode: store?.locationCode, storeId: store?.id,
        summary: off ? `Uber Eats disconnected store ${store ? `${store.brandName} · ${store.locationCode}` : storeId} from Food Hub — orders will no longer arrive here. Reconnect it under Stores.` : `Uber Eats connected store ${store ? `${store.brandName} · ${store.locationCode}` : storeId} to Food Hub` });
    });
  } else if (event === 'store.status.changed') {
    background('uber store status', async () => {
      const repo = getRepo();
      const store = await repo.findStore('uber_eats', String(body.meta?.resource_id || body.store_id || ''));
      if (!store) return;
      const online = String(body.meta?.status || '').toUpperCase() === 'ONLINE';
      const platformStatus: PlatformStatus = { state: online ? 'online' : 'paused', detail: online ? undefined : String(body.meta?.status || 'Changed on Uber Eats'), until: null, checkedAt: nowIso(), source: 'webhook' };
      await repo.updateStore(store.id, { online, lastStatusSource: 'uber_eats:webhook', meta: { ...store.meta, platformStatus } });
      if (store.online !== online) {
        await logActivity({ actor: 'Uber Eats', source: 'platform', kind: 'store_status', action: online ? 'platform_online' : 'platform_paused', status: online ? 'success' : 'info',
          channel: 'uber_eats', brandName: store.brandName, locationCode: store.locationCode, storeId: store.id, summary: `${store.brandName} · ${store.locationCode} on Uber Eats is now ${online ? 'online' : 'paused'}` });
      }
    });
  }
  return new NextResponse(null, { status: 200 });
}
