// Too Good To Go — what is possible without a public store API (verified Oct 2026: TGTG offers no store API;
// its only POS order feed is through Deliverect, and quantities are set in the TGTG Store app).
//  - Daily bag log per location: bags offered, sold, price → becomes a "Too Good To Go" sale for that day,
//    so the Command Center, analytics, reconciliation and Clover-free reporting include TGTG.
//  - If real TGTG orders arrive by webhook (Deliverect feed) for that day and location, the log is
//    informational only (no double counting).
//  - TGTG payouts are reconciled from their statements in Statement imports.
import { logActivity, type Actor } from './activity';
import { nowIso } from './config';
import { getRepo } from './repo';
import { foodhubTimeZone, startOfLocalDayMs } from './time';
import type { StoredOrder } from './types';

export const BAGS = 'tgtg_bag_days';

export interface BagDay {
  id: string;
  date: string;
  locationCode: string;
  bagsOffered: number;
  bagsSold: number;
  /** What the customer pays per bag (taxes included), e.g. 5.99. */
  pricePerBag: number;
  note?: string;
  by: string;
  at: string;
  orderId: string | null;
  /** True when real TGTG orders exist for that day/location (then the log does not create a sale). */
  feedOrders: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function noonLocal(date: string) {
  return new Date(startOfLocalDayMs(Date.parse(`${date}T12:00:00Z`), foodhubTimeZone()) + 18 * 3600_000).toISOString();
}

export async function listBagDays(from?: string, to?: string): Promise<BagDay[]> {
  return (await getRepo().listDocs<BagDay>(BAGS, {})).map((d) => d.data)
    .filter((d) => (!from || d.date >= from) && (!to || d.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date) || a.locationCode.localeCompare(b.locationCode));
}

export async function saveBagDay(input: { date: string; locationCode: string; bagsOffered: number; bagsSold: number; pricePerBag: number; note?: string }, actor: Actor): Promise<BagDay> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('Date must be YYYY-MM-DD.');
  const offered = Math.max(0, Math.round(Number(input.bagsOffered) || 0));
  const sold = Math.max(0, Math.round(Number(input.bagsSold) || 0));
  const price = r2(Number(input.pricePerBag) || 0);
  if (sold > offered && offered > 0) throw new Error('Bags sold cannot be more than bags offered.');
  if (price <= 0 && sold > 0) throw new Error('Enter the price customers pay per bag.');
  const repo = getRepo();
  const id = `${input.locationCode}|${input.date}`;
  const prev = await repo.getDoc<BagDay>(BAGS, id);
  const dayStart = startOfLocalDayMs(Date.parse(`${input.date}T12:00:00Z`));
  const dayOrders = (await repo.listOrders({ since: new Date(dayStart).toISOString(), until: new Date(dayStart + 86400_000).toISOString(), limit: 2000, locationCodes: [input.locationCode] }))
    .filter((o) => o.channel === 'tgtg');
  const feed = dayOrders.filter((o) => !isLogOrder(o));
  const stores = await repo.listStores('tgtg');
  const store = stores.find((s) => s.locationCode === input.locationCode);
  const externalOrderId = `tgtg-log-${input.locationCode}-${input.date}`;
  let orderId: string | null = prev?.data.orderId ?? null;
  const fields = {
    lines: [{ name: 'Surprise Bag', quantity: sold, unitPrice: price, total: r2(sold * price), modifiers: [] }],
    subtotal: r2(sold * price), tax: 0, total: r2(sold * price),
    notes: `Daily bag log: ${sold}/${offered} bags sold${input.note ? ` — ${input.note}` : ''}`,
  };
  if (feed.length || sold === 0) {
    // Real orders exist (or nothing sold): the log must not create a sale → cancel a previous log order.
    if (orderId) await repo.updateOrder(orderId, { status: 'cancelled', ...fields, total: 0, subtotal: 0, notes: feed.length ? 'Replaced by Too Good To Go orders received by webhook' : 'No bags sold' });
  } else if (orderId) {
    await repo.updateOrder(orderId, { ...fields, status: 'completed' });
  } else {
    const { order } = await repo.insertOrderIfNew({
      channel: 'tgtg', marketplace: 'tgtg', externalOrderId, displayId: `BAGS-${input.date.slice(5)}`, channelStoreId: store?.channelStoreId ?? `log-${input.locationCode}`,
      brandName: store?.brandName ?? 'Too Good To Go', customerName: undefined, fulfillment: 'pickup', placedAt: noonLocal(input.date), currency: 'CAD',
      deliveryFee: 0, tip: 0, discount: 0, raw: { source: 'daily_log' }, ...fields, locationCode: input.locationCode, createdAt: noonLocal(input.date),
    });
    orderId = order.id;
    await repo.updateOrder(order.id, { status: 'completed', timeline: { completedAt: noonLocal(input.date) } });
  }
  const day: BagDay = { id, date: input.date, locationCode: input.locationCode, bagsOffered: offered, bagsSold: sold, pricePerBag: price, note: input.note?.slice(0, 200), by: actor.name, at: nowIso(), orderId, feedOrders: feed.length };
  await repo.putDocs(BAGS, [{ id, at: noonLocal(input.date), key: input.locationCode, data: day }]);
  await logActivity({ actor: actor.name, source: actor.source, kind: 'order', action: 'tgtg_bag_log', status: 'success', channel: 'tgtg', locationCode: input.locationCode,
    summary: `Too Good To Go ${input.date} at ${input.locationCode}: ${sold}/${offered} bags sold × ${price.toFixed(2)} $${feed.length ? ' (orders already received by webhook — log not counted as sales)' : ''}` });
  return day;
}

export function isLogOrder(o: Pick<StoredOrder, 'raw' | 'externalOrderId'>) {
  return (o.raw as { source?: string } | undefined)?.source === 'daily_log' || o.externalOrderId.startsWith('tgtg-log-');
}
