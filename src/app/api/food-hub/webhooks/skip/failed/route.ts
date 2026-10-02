import { NextResponse, type NextRequest } from 'next/server';
import { logActivity } from '@/lib/food-hub/activity';
import { parseSkipFailedOrder, skipAdapter } from '@/lib/food-hub/adapters/skip';
import { getRepo } from '@/lib/food-hub/repo';
import { background, keepUnparsed, parseJson, unauthorized } from '@/lib/food-hub/webhook-utils';

export const dynamic = 'force-dynamic';

// JET Connect "Failed Order For Backup Flow": the order failed JET's validation (e.g. an unknown item
// reference) and went straight to the Skip tablet. Food Hub records it so it is never invisible:
// it shows on the Command Center as "on the Skip tablet" and counts in sales and reconciliation.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!skipAdapter.verifyWebhook(req.headers, raw)) return unauthorized('skip');
  const body = parseJson(raw);
  const parsed = parseSkipFailedOrder(body);
  if (!parsed) {
    background('keep unparsed skip failed order', () => keepUnparsed('skip', body, 'Skip failed-order notice without order details'));
    return NextResponse.json({ ok: false, error: 'order.orderId missing' }, { status: 400 });
  }
  background(`skip failed order ${parsed.externalOrderId}`, async () => {
    const repo = getRepo();
    const { failure, ...n } = parsed;
    const store = n.channelStoreId ? await repo.findStore('skip', n.channelStoreId) : null;
    const { order, isNew } = await repo.insertOrderIfNew({ ...n, brandName: store?.brandName, locationCode: store?.locationCode });
    const message = `Skip sent this order to the tablet: ${failure}. Make it from the Skip tablet${failure.includes('unknown item') ? ' and fix the item id in Menu Manager' : ''}.`;
    await repo.updateOrder(order.id, { status: 'failed', channelError: message });
    await repo.addEvent(order.id, 'routed_to_skip_tablet', { message, validationError: body.validationError, unknownReference: body.unknownReference, menuId: body.menuId });
    if (isNew) {
      await logActivity({ actor: 'SkipTheDishes', source: 'platform', kind: 'order', action: 'skip_backup_flow', status: 'failed', channel: 'skip', brandName: store?.brandName, locationCode: store?.locationCode, orderId: order.id,
        summary: `Skip #${n.displayId || n.externalOrderId.slice(0, 8)} failed validation and went to the Skip tablet — ${failure}` });
    }
  });
  return NextResponse.json({ ok: true });
}
