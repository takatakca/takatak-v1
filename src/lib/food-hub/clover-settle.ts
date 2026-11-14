// Clover follows each delivery order to the end (what UrbanPiper's POS integration does):
//   order arrives      → created in Clover (open, platform order type, kitchen ticket)
//   leaves the kitchen → recorded as PAID with the platform tender ("Uber Eats", "DoorDash"…) — picked up,
//                        completed, delivered, or auto-completed
//   cancelled before   → removed from the Clover register (or renamed "CANCELLED" if Clover refuses)
// Payments cannot be deleted or refunded through Clover's REST API, so they are only recorded once the
// order can no longer be cancelled by the restaurant — that keeps Clover's sales equal to the real sales.
import { logActivity } from './activity';
import { CHANNEL_LABELS, nowIso } from './config';
import { closeCancelledCloverOrder, recordCloverPayment } from './pos/clover-books';
import { getRepo } from './repo';
import type { OrderTimeline, StoredOrder } from './types';

async function patch(order: StoredOrder, t: OrderTimeline): Promise<StoredOrder> {
  const timeline = { ...(order.timeline ?? {}), ...t };
  return (await getRepo().updateOrder(order.id, { timeline })) ?? { ...order, timeline };
}

export async function settleInClover(order: StoredOrder | null): Promise<StoredOrder | null> {
  if (!order?.posOrderId) return order;
  const repo = getRepo();
  const tag = `${CHANNEL_LABELS[order.channel]} #${order.displayId || order.externalOrderId.slice(0, 8)}`;
  try {
    if ((order.status === 'dispatched' || order.status === 'completed') && !order.timeline?.posPaymentId) {
      const store = await repo.findStore(order.channel, order.channelStoreId);
      const r = await recordCloverPayment(order, store?.cloverMerchantId);
      if (r.ok) {
        await repo.addEvent(order.id, 'pos_paid', { message: `Recorded as paid in Clover (${r.amount.toFixed(2)} $, ${CHANNEL_LABELS[order.channel]} tender)`, paymentId: r.paymentId });
        return patch(order, { posPaymentId: r.paymentId, posPaymentError: undefined });
      }
      if ('skipped' in r && r.skipped) return order;
      await repo.addEvent(order.id, 'pos_payment_failed', { error: r.error });
      return patch(order, { posPaymentError: r.error });
    }
    if (order.status === 'cancelled' && !order.timeline?.posClosedAt) {
      if (order.timeline?.posPaymentId) {
        await repo.addEvent(order.id, 'pos_paid_then_cancelled', { message: 'Cancelled after it was recorded as paid in Clover — refund it in the Clover app if the platform did not pay you.' });
        await logActivity({ actor: 'Food Hub', source: 'automation', kind: 'order', action: 'clover_paid_cancelled', status: 'failed', channel: order.channel, brandName: order.brandName, locationCode: order.locationCode, orderId: order.id,
          summary: `${tag} was cancelled after it was recorded as paid in Clover — check the payout; refund it in Clover if the platform did not pay you.` });
        return patch(order, { posClosedAt: nowIso() });
      }
      const store = await repo.findStore(order.channel, order.channelStoreId);
      const r = await closeCancelledCloverOrder(order, store?.cloverMerchantId);
      if (r.skipped) return order;
      await repo.addEvent(order.id, r.ok ? 'pos_cancelled' : 'pos_cancel_failed', { message: r.message });
      if (!r.ok) {
        await logActivity({ actor: 'Food Hub', source: 'automation', kind: 'order', action: 'clover_cancel_failed', status: 'failed', channel: order.channel, brandName: order.brandName, locationCode: order.locationCode, orderId: order.id, summary: `${tag} cancelled, but Clover still has the order: ${r.message}` });
      }
      return r.ok ? patch(order, { posClosedAt: nowIso() }) : order;
    }
  } catch (error) {
    await repo.addEvent(order.id, 'pos_settle_failed', { error: error instanceof Error ? error.message : String(error) }).catch(() => undefined);
  }
  return order;
}
