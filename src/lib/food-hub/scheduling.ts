// Scheduled (advance) orders: the platform sends them early; the kitchen must start at the right time.
// Food Hub still puts them in Clover and accepts them right away (platform rule), but the kitchen ticket
// prints at "fire time" = customer time − prep time, and they wait in a "Scheduled" lane until then.
import { logActivity } from './activity';
import { CHANNEL_LABELS, nowIso } from './config';
import { cloverAutoPrintEnabled, printCloverOrder } from './pos/clover';
import { getRepo } from './repo';
import type { NormalizedOrder, StoredOrder } from './types';

/** An order counts as scheduled when the customer wants it this many minutes after it arrives (default 60). */
export function scheduledThresholdMin() {
  const v = Number(process.env.FOODHUB_SCHEDULED_AFTER_MIN);
  return Number.isFinite(v) && v > 0 ? v : 60;
}

export function scheduledInfo(n: Pick<NormalizedOrder, 'readyBy'>, prepMinutes: number, now = Date.now()): { scheduledFor: string; fireAt: string } | null {
  if (!n.readyBy) return null;
  const due = Date.parse(n.readyBy);
  if (!Number.isFinite(due) || due - now < scheduledThresholdMin() * 60_000) return null;
  return { scheduledFor: new Date(due).toISOString(), fireAt: new Date(Math.max(now, due - prepMinutes * 60_000)).toISOString() };
}

export function isWaitingScheduled(o: Pick<StoredOrder, 'timeline' | 'status'>, now = Date.now()) {
  return Boolean(o.timeline?.fireAt && !o.timeline.firedAt && Date.parse(o.timeline.fireAt) > now && ['new', 'accepted'].includes(o.status));
}

/** Housekeeping: print the kitchen ticket of every scheduled order whose fire time has come. */
export async function fireDueScheduled(now = Date.now()): Promise<number> {
  const repo = getRepo();
  const recent = await repo.listOrders({ since: new Date(now - 7 * 86400_000).toISOString(), limit: 5000, statuses: ['new', 'accepted'] });
  const due = recent.filter((o) => o.timeline?.fireAt && !o.timeline.firedAt && Date.parse(o.timeline.fireAt) <= now);
  let fired = 0;
  for (const o of due) {
    const store = await repo.findStore(o.channel, o.channelStoreId);
    let printedAt: string | undefined;
    if (o.posOrderId && cloverAutoPrintEnabled()) {
      const p = await printCloverOrder(o.posOrderId, store?.cloverMerchantId);
      await repo.addEvent(o.id, p.ok ? 'printed' : 'print_failed', { message: `${p.message} (scheduled order — fire time)` });
      if (p.ok) printedAt = nowIso();
    }
    await repo.updateOrder(o.id, { timeline: { ...(o.timeline ?? {}), firedAt: nowIso(), ...(printedAt ? { printedAt } : {}) } });
    await repo.addEvent(o.id, 'fired', { message: 'Scheduled order sent to the kitchen' });
    await logActivity({ actor: 'TAKATAK automation', source: 'automation', kind: 'order', action: 'scheduled_fire', status: 'info', channel: o.channel, brandName: o.brandName, locationCode: o.locationCode, orderId: o.id,
      summary: `Scheduled ${CHANNEL_LABELS[o.channel]} #${o.displayId || o.externalOrderId.slice(0, 8)} sent to the kitchen (due ${new Date(o.timeline!.scheduledFor ?? o.timeline!.fireAt!).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })})` });
    fired++;
  }
  return fired;
}
