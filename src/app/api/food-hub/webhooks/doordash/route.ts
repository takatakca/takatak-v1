import { NextResponse, type NextRequest } from 'next/server';
import { doorDashAdapter, parseDoorDashOrder } from '@/lib/food-hub/adapters/doordash';
import { applyCourierUpdate, doorDashCourierDetails, doorDashCourierStatus } from '@/lib/food-hub/courier';
import { applyExternalStatus } from '@/lib/food-hub/pipeline';
import { getRepo } from '@/lib/food-hub/repo';
import { background, keepUnparsed, parseJson, queueOrder, unauthorized } from '@/lib/food-hub/webhook-utils';

export const dynamic = 'force-dynamic';

// DoorDash webhook subscriptions (Developer Portal): Order Create, Order Cancel, Menu Status, Dasher Status.
// Point all of them at this URL with Authorization header = DOORDASH_WEBHOOK_SECRET.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!doorDashAdapter.verifyWebhook(req.headers, raw)) return unauthorized('doordash');
  const body = parseJson(raw);
  if (body === undefined) return NextResponse.json({ ok: false }, { status: 400 });

  const eventType = String(body.event?.type || body.event_type || body.type || '').toLowerCase();

  // Menu Status webhook → remember the DoorDash menu id so later pushes PATCH instead of POST.
  if (eventType.includes('menu') || (body.reference && (body.menu?.id || body.menu_id))) {
    background('doordash menu status', async () => {
      const reference = String(body.reference || '');
      const msid = reference.startsWith('takatak-') ? reference.slice('takatak-'.length).replace(/-\d+$/, '') : String(body.store?.merchant_supplied_id || '');
      const menuId = body.menu?.id || body.menu_id;
      const repo = getRepo();
      const store = msid ? await repo.findStore('doordash', msid) : null;
      if (store && menuId) await repo.updateStore(store.id, { meta: { ...store.meta, doordashMenuId: String(menuId), lastMenuStatus: body } });
      // Close the queued "menu push" job so the dashboard shows the real outcome.
      const job = reference ? await repo.findJobByReference(reference) : null;
      if (job && job.status === 'queued') {
        const failed = /fail|error|reject/i.test(JSON.stringify(body.status ?? body.menu?.status ?? body.event?.status ?? ''));
        await repo.updateJob(job.id, { status: failed ? 'error' : 'done', result: { ...(job.result ?? {}), callback: body } });
      }
    });
    return NextResponse.json({ ok: true });
  }

  // Dasher Status webhooks (dasher assigned, arriving at store, picked up, dropped off).
  const courierStatus = doorDashCourierStatus(eventType);
  if (courierStatus) {
    const id = String(body.order?.id || body.order_id || body.external_order_id || body.id || '');
    background(`doordash dasher ${id}`, () => applyCourierUpdate('doordash', id, { status: courierStatus, ...doorDashCourierDetails(body) }, `doordash:${eventType}`));
    return NextResponse.json({ ok: true });
  }

  if (eventType.includes('cancel')) {
    const id = String(body.order?.id || body.order_id || body.id || '');
    background(`doordash cancel ${id}`, () => applyExternalStatus('doordash', id, 'cancelled', { event: eventType }));
    return NextResponse.json({ ok: true });
  }

  const order = parseDoorDashOrder(body);
  if (!order) {
    background('keep unparsed doordash', () => keepUnparsed('doordash', body, 'Unrecognized DoorDash payload'));
    return NextResponse.json({ ok: false, error: 'Unrecognized payload' }, { status: 422 });
  }
  queueOrder(order);
  return NextResponse.json({ ok: true });
}
