// The order pipeline: every channel's webhook ends here.
//   receive → dedupe → map to store/brand → inject into Clover → print in kitchen → auto-accept → log
// Every step is timestamped on the order (timeline) for the status-transitions report and analytics.
import { logActivity, type Actor } from './activity';
import { getAdapter } from './adapters';
import { CHANNEL_LABELS, nowIso } from './config';
import { cloverAutoPrintEnabled, injectOrder, printCloverOrder } from './pos/clover';
import { cloverOrderTypeFor } from './pos/clover-books';
import { settleInClover } from './clover-settle';
import { reportSkipMissingItems } from './adapters/skip';
import { prepFor } from './prep';
import { isWaitingScheduled, scheduledInfo } from './scheduling';
import { getRepo } from './repo';
import { CANCEL_REASON_LABELS, type CancelReason, type ChannelKey, type ChannelResult, type NormalizedOrder, type OrderStatus, type OrderTimeline, type StoredOrder } from './types';

export interface PipelineOutcome {
  order: StoredOrder;
  duplicate: boolean;
  pos?: { ok: boolean; posOrderId?: string; error?: string; skipped?: boolean };
  accept?: ChannelResult;
}

function autoAcceptDefault() {
  return process.env.FOODHUB_AUTO_ACCEPT_DEFAULT !== 'false';
}

async function patchTimeline(order: StoredOrder, patch: OrderTimeline, extra: Partial<StoredOrder> = {}): Promise<StoredOrder> {
  const timeline = { ...(order.timeline ?? {}), ...patch };
  return (await getRepo().updateOrder(order.id, { ...extra, timeline })) ?? { ...order, ...extra, timeline };
}

async function autoPrint(order: StoredOrder, merchantId?: string | null): Promise<StoredOrder> {
  if (!order.posOrderId || !cloverAutoPrintEnabled()) return order;
  // Scheduled orders print at their fire time (see scheduling.ts), not when they arrive.
  if (isWaitingScheduled(order)) return order;
  const p = await printCloverOrder(order.posOrderId, merchantId);
  await getRepo().addEvent(order.id, p.ok ? 'printed' : 'print_failed', { message: p.message, printEventId: p.printEventId });
  return p.ok ? patchTimeline(order, { printedAt: nowIso() }) : order;
}

export async function processIncomingOrder(n: NormalizedOrder): Promise<PipelineOutcome> {
  const repo = getRepo();
  const store = n.channelStoreId ? await repo.findStore(n.channel, n.channelStoreId) : null;
  const brandName = store?.brandName || n.brandName;

  // Map platform item refs back to Clover inventory ids using the brand's master menu.
  if (brandName) {
    const menu = await repo.getMenu(brandName);
    if (menu) {
      const byRef = new Map(menu.items.map((i) => [i.ref, i]));
      const byName = new Map(menu.items.map((i) => [i.name.trim().toLowerCase(), i]));
      n.lines = n.lines.map((l) => {
        const item = (l.externalId && byRef.get(l.externalId)) || byName.get(l.name.trim().toLowerCase());
        return item?.posItemRef ? { ...l, posItemRef: item.posItemRef } : l;
      });
    }
  }

  const { order, isNew } = await repo.insertOrderIfNew({ ...n, brandName, locationCode: store?.locationCode });
  if (!isNew) {
    await repo.addEvent(order.id, 'duplicate_delivery', { note: 'Webhook delivered again; ignored.' });
    return { order, duplicate: true };
  }

  await repo.addEvent(order.id, 'received', { channel: n.channel, marketplace: n.marketplace, total: n.total, lines: n.lines.length });
  if (!store) {
    await repo.addEvent(order.id, 'unmapped_store', { channelStoreId: n.channelStoreId, hint: 'Map this store in Food Hub → Stores so orders route to the right brand, location and Clover merchant.' });
  }

  // 0) Prep time (normal / busy), scheduled orders, courier details sent with the order
  const prep = await prepFor(store?.locationCode);
  const scheduled = scheduledInfo(n, prep.minutes);
  let current: StoredOrder = await patchTimeline(order, {
    readyTarget: scheduled?.scheduledFor ?? new Date(Date.now() + prep.minutes * 60_000).toISOString(),
    ...(scheduled ?? {}),
    ...(n.courier?.status ? { courier: { ...n.courier, status: n.courier.status, updatedAt: nowIso(), source: n.channel } } : {}),
  });
  if (scheduled) await repo.addEvent(order.id, 'scheduled', { message: `Scheduled for ${new Date(scheduled.scheduledFor).toLocaleString('fr-CA')} — kitchen ticket at ${new Date(scheduled.fireAt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}` });

  // 1) POS injection (+ order type, payment record, kitchen ticket)
  const pos = await injectOrder(current, store?.cloverMerchantId, { orderTypeId: await cloverOrderTypeFor(store?.cloverMerchantId || process.env.CLOVER_MERCHANT_ID, n.channel) });
  if (pos.ok) {
    current = (await repo.updateOrder(order.id, { posOrderId: pos.posOrderId })) ?? current;
    await repo.addEvent(order.id, 'pos_injected', { posOrderId: pos.posOrderId });
    current = await autoPrint(current, store?.cloverMerchantId);
  } else {
    current = (await repo.updateOrder(order.id, { posError: pos.error })) ?? current;
    await repo.addEvent(order.id, pos.skipped ? 'pos_skipped' : 'pos_failed', { error: pos.error });
  }

  // 3) Auto-accept — never accept an order the kitchen did not receive.
  const wantsAuto = store ? store.autoAccept : autoAcceptDefault();
  const posBlocksAccept = !pos.ok && !pos.skipped;
  let accept: ChannelResult | undefined;
  if (wantsAuto && !posBlocksAccept) {
    accept = await getAdapter(n.channel).acceptOrder(current, pos.ok ? pos.posOrderId : undefined);
    if (accept.ok) {
      current = await patchTimeline(current, { acceptedAt: nowIso(), acceptedBy: 'auto' }, { status: 'accepted', channelError: undefined });
      await repo.addEvent(order.id, 'accepted', { auto: true, response: summarize(accept) });
    } else {
      current = (await repo.updateOrder(order.id, { channelError: accept.message })) ?? current;
      await repo.addEvent(order.id, 'accept_failed', { auto: true, status: accept.status, message: accept.message });
    }
  } else if (posBlocksAccept) {
    if (n.channel === 'skip') {
      // Skip/JET Connect: tell JET right away so the order falls back to the Skip tablet
      // instead of waiting out the 5-minute timeout. 'failed' = handed back to the platform (still a sale).
      const fallback = await getAdapter('skip').denyOrder(current, 'Clover did not receive the order');
      await repo.addEvent(order.id, 'routed_to_skip_tablet', { status: fallback.status, message: fallback.message });
      current = (await repo.updateOrder(order.id, { status: 'failed', channelError: 'Clover failed — order sent to the Skip tablet (backup flow).' })) ?? current;
      await logActivity({ actor: 'TAKATAK automation', source: 'automation', kind: 'order', action: 'skip_tablet_fallback', status: 'info', channel: 'skip', brandName, locationCode: store?.locationCode, orderId: order.id,
        summary: `Skip #${order.displayId || order.externalOrderId.slice(0, 8)} sent to the Skip tablet (Clover did not receive it)` });
    } else {
      await repo.addEvent(order.id, 'needs_attention', { reason: 'Clover injection failed — accept manually after entering the order.' });
    }
  }

  return { order: current, duplicate: false, pos: pos.ok ? { ok: true, posOrderId: pos.posOrderId } : { ok: false, error: pos.error, skipped: pos.skipped }, accept };
}

function summarize(r: ChannelResult) {
  return { status: r.status, httpStatus: r.httpStatus, message: r.message };
}

export type OrderAction = 'accept' | 'deny' | 'ready' | 'dispatch' | 'complete' | 'cancel' | 'retry_pos' | 'print' | 'report_missing';
export const ORDER_ACTIONS: OrderAction[] = ['accept', 'deny', 'ready', 'dispatch', 'complete', 'cancel', 'retry_pos', 'print', 'report_missing'];

const NEXT_STATUS: Partial<Record<OrderAction, OrderStatus>> = { accept: 'accepted', deny: 'cancelled', ready: 'ready', dispatch: 'dispatched', complete: 'completed', cancel: 'cancelled' };

/** Which actions make sense for an order right now (the UI shows only these buttons). */
export function allowedActions(order: StoredOrder): OrderAction[] {
  const a: OrderAction[] = [];
  if (order.status === 'new') a.push('accept', 'deny');
  // Only Uber Eats lets a store cancel an accepted order by API; DoorDash/Skip cancellations are done
  // in their merchant portal / tablet and arrive back here through their webhooks.
  const canCancel = order.channel === 'uber_eats';
  if (order.status === 'accepted') a.push('ready', ...(canCancel ? (['cancel'] as const) : []));
  if (order.status === 'ready') a.push('dispatch', 'complete', ...(canCancel ? (['cancel'] as const) : []));
  if (order.status === 'dispatched') a.push('complete');
  if (!order.posOrderId && order.status !== 'cancelled') a.push('retry_pos');
  if (order.posOrderId) a.push('print');
  // SkipTheDishes (JET Connect) lets the store report an out-of-stock item after accepting; Skip adjusts the customer's bill.
  if (order.channel === 'skip' && ['accepted', 'ready'].includes(order.status)) a.push('report_missing');
  return a;
}

const ACTION_LABEL: Record<OrderAction, string> = {
  accept: 'Accepted', deny: 'Rejected', ready: 'Marked ready', dispatch: 'Handed to courier', complete: 'Completed', cancel: 'Cancelled', retry_pos: 'Sent to Clover', print: 'Printed in kitchen',
  report_missing: 'Reported missing items',
};

export async function runOrderAction(orderId: string, action: OrderAction, opts: { reason?: string; reasonCode?: CancelReason; actor?: Actor; missing?: Array<{ line: number; quantity: number }> } = {}): Promise<{ order: StoredOrder | null; result: ChannelResult | { ok: boolean; message: string } }> {
  const repo = getRepo();
  const order = await repo.getOrder(orderId);
  if (!order) return { order: null, result: { ok: false, message: 'Order not found.' } };
  const actor = opts.actor ?? { username: 'owner', name: 'Owner', source: 'dashboard' as const };
  const adapter = getAdapter(order.channel);
  const tag = `${CHANNEL_LABELS[order.channel]} #${order.displayId || order.externalOrderId.slice(0, 8)}`;
  const log = (status: 'success' | 'failed' | 'info', message: string) => logActivity({
    actor: actor.name, source: actor.source, kind: 'order', action, status, channel: order.channel, brandName: order.brandName, locationCode: order.locationCode, orderId: order.id,
    summary: `${ACTION_LABEL[action]}: ${tag}${opts.reasonCode ? ` — ${CANCEL_REASON_LABELS[opts.reasonCode]}` : opts.reason ? ` — ${opts.reason}` : ''}${status === 'failed' ? ` (failed: ${message})` : ''}`,
  });

  if (!allowedActions(order).includes(action)) {
    return { order, result: { ok: false, message: `"${ACTION_LABEL[action]}" is not possible while the order is ${order.status}.` } };
  }

  if (action === 'report_missing') {
    const picks = (opts.missing ?? []).map((m) => ({ line: order.lines[m.line], quantity: Math.max(1, Math.round(m.quantity)) }))
      .filter((m) => m.line && m.quantity <= m.line.quantity);
    if (!picks.length) return { order, result: { ok: false, message: 'Choose the missing item(s) and quantity.' } };
    const noPlu = picks.find((m) => !m.line.externalId);
    if (noPlu) return { order, result: { ok: false, message: `"${noPlu.line.name}" has no Skip item reference (PLU), so it cannot be reported by API — use the Skip tablet.` } };
    const res = await reportSkipMissingItems(order, picks.map((m) => ({ plu: m.line.externalId!, missingQuantity: m.quantity })));
    const now = nowIso();
    const updated = res.ok
      ? await patchTimeline(order, { missingItems: [...(order.timeline?.missingItems ?? []), ...picks.map((m) => ({ name: m.line.name, ref: m.line.externalId, quantity: m.quantity, at: now }))] })
      : await repo.updateOrder(order.id, { channelError: res.message });
    const label = picks.map((m) => `${m.quantity}× ${m.line.name}`).join(', ');
    await repo.addEvent(order.id, res.ok ? 'report_missing' : 'report_missing_failed', { message: `${label}: ${res.message}`, by: actor.name });
    await logActivity({ actor: actor.name, source: actor.source, kind: 'order', action, status: res.ok ? 'success' : 'failed', channel: order.channel, brandName: order.brandName, locationCode: order.locationCode, orderId: order.id,
      summary: `Missing items reported to SkipTheDishes for ${tag}: ${label}${res.ok ? '' : ` (failed: ${res.message})`}` });
    return { order: updated, result: res };
  }

  if (action === 'retry_pos' || action === 'print') {
    const store = await repo.findStore(order.channel, order.channelStoreId);
    if (action === 'print') {
      const p = await printCloverOrder(order.posOrderId!, store?.cloverMerchantId);
      await repo.addEvent(order.id, p.ok ? 'printed' : 'print_failed', { message: p.message, manual: true, by: actor.name });
      const updated = p.ok ? await patchTimeline(order, { printedAt: nowIso() }) : order;
      await log(p.ok ? 'success' : 'failed', p.message);
      return { order: updated, result: { ok: p.ok, message: p.message } };
    }
    const pos = await injectOrder(order, store?.cloverMerchantId, { orderTypeId: await cloverOrderTypeFor(store?.cloverMerchantId || process.env.CLOVER_MERCHANT_ID, order.channel) });
    let updated = await repo.updateOrder(order.id, pos.ok ? { posOrderId: pos.posOrderId, posError: undefined } : { posError: pos.error });
    await repo.addEvent(order.id, pos.ok ? 'pos_injected' : 'pos_failed', pos.ok ? { posOrderId: pos.posOrderId, manual: true, by: actor.name } : { error: pos.error, manual: true, by: actor.name });
    if (pos.ok && updated) updated = await autoPrint(updated, store?.cloverMerchantId);
    if (pos.ok && updated) updated = await settleInClover(updated);
    await log(pos.ok ? 'success' : 'failed', pos.ok ? '' : pos.error);
    return { order: updated, result: { ok: pos.ok, message: pos.ok ? `Created in Clover (${pos.posOrderId}).` : pos.error } };
  }

  const reasonText = opts.reasonCode ? `${CANCEL_REASON_LABELS[opts.reasonCode]}${opts.reason?.trim() ? ` — ${opts.reason.trim()}` : ''}` : opts.reason || 'Rejected by restaurant';
  let res: ChannelResult | { ok: boolean; message: string };
  if (action === 'accept') res = await adapter.acceptOrder(order, order.posOrderId);
  else if (action === 'deny') res = await adapter.denyOrder(order, reasonText);
  else if (action === 'cancel') res = await adapter.cancelOrder(order, opts.reasonCode ?? 'other', opts.reason);
  else if (action === 'ready') res = await adapter.markReady(order, order.posOrderId);
  else res = { ok: true, message: action === 'dispatch' ? 'Handed to the courier.' : 'Marked completed in Food Hub.' };

  // On Skip, "reject" hands the order to the Skip tablet (JET backup flow) — it is not cancelled for the customer.
  const nextStatus: OrderStatus = action === 'deny' && order.channel === 'skip' ? 'failed' : NEXT_STATUS[action]!;
  const now = nowIso();
  const t: OrderTimeline = {};
  if (res.ok) {
    if (action === 'accept') Object.assign(t, { acceptedAt: now, acceptedBy: actor.username });
    if (action === 'ready') t.readyAt = now;
    if (action === 'dispatch') Object.assign(t, { dispatchedAt: now, readyAt: order.timeline?.readyAt ?? now });
    if (action === 'complete') t.completedAt = now;
    if ((action === 'deny' && nextStatus === 'cancelled') || action === 'cancel') {
      Object.assign(t, { cancelledAt: now, cancelledBy: opts.reasonCode === 'customer_request' ? 'customer' : 'store', cancelStage: order.timeline?.acceptedAt ? 'after_accept' : 'before_accept', cancelReason: reasonText });
    }
  }
  let updated = res.ok
    ? await patchTimeline(order, t, { status: nextStatus, channelError: nextStatus === 'failed' ? 'Sent to the Skip tablet (backup flow).' : undefined })
    : await repo.updateOrder(order.id, { channelError: res.message });
  await repo.addEvent(order.id, res.ok ? action : `${action}_failed`, { message: res.message, reason: reasonText, by: actor.name });
  // Clover follows: paid when it leaves the kitchen, removed from the register when cancelled.
  if (res.ok) updated = await settleInClover(updated);
  await log(res.ok ? 'success' : 'failed', res.message);
  return { order: updated, result: res };
}

/** Status changes pushed by a platform (customer cancellation, courier picked up, completed…). */
export async function applyExternalStatus(channel: ChannelKey, externalOrderId: string, platformState: string, detail: Record<string, unknown> = {}) {
  const repo = getRepo();
  const order = await repo.findOrder(channel, externalOrderId);
  if (!order) return null;
  const s = platformState.toLowerCase();
  const status: OrderStatus | null =
    s.includes('cancel') || s.includes('fail') ? 'cancelled'
      : s.includes('complete') || s.includes('deliver') ? 'completed'
        : s.includes('pick') || s.includes('dispatch') ? 'dispatched'
          : s.includes('ready') ? 'ready'
            : s.includes('ack') || s.includes('accept') ? 'accepted'
              : null;
  if (status && status !== order.status) {
    const now = nowIso();
    const t: OrderTimeline = {};
    if (status === 'cancelled') {
      const why = String(detail.reason ?? detail.event ?? '').toLowerCase();
      Object.assign(t, { cancelledAt: now, cancelledBy: why.includes('customer') || why.includes('eater') ? 'customer' : 'platform', cancelStage: order.timeline?.acceptedAt ? 'after_accept' : 'before_accept', cancelReason: String(detail.reason ?? detail.event ?? 'Cancelled on the platform') });
      await logActivity({ actor: CHANNEL_LABELS[channel], source: 'platform', kind: 'order', action: 'platform_cancel', status: 'info', channel, brandName: order.brandName, locationCode: order.locationCode, orderId: order.id,
        summary: `${CHANNEL_LABELS[channel]} cancelled #${order.displayId || order.externalOrderId.slice(0, 8)}${t.cancelReason ? ` — ${t.cancelReason}` : ''}` });
    }
    if (status === 'completed') t.completedAt = now;
    if (status === 'dispatched') t.dispatchedAt = now;
    if (status === 'ready') t.readyAt = now;
    if (status === 'accepted') t.acceptedAt = order.timeline?.acceptedAt ?? now;
    await settleInClover(await patchTimeline(order, t, { status }));
  }
  await repo.addEvent(order.id, 'platform_status', { state: platformState, ...detail, at: nowIso() });
  return order;
}
