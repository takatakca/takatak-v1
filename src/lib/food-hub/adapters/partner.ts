// Too Good To Go adapter.
// TGTG has no public merchant API: Surprise Bags are created and sized in TGTG MyStore.
// TGTG offers order feeds only through certified partners. Food Hub therefore:
//   - accepts inbound bag orders on a token-protected webhook (for when a feed is set up),
//   - keeps every outbound action blocked with a clear reason (never fakes success);
//     accept/ready are 'skipped' (nothing to send — TGTG confirms reservations itself).
import { checkSharedSecret, fromCents, result } from '../config';
import type { ChannelAdapter, ChannelKey, Marketplace, NormalizedOrder, OrderLine } from '../types';
import { buildReadiness } from './common';

export const tgtgAdapter: ChannelAdapter = (() => {
  const key = 'tgtg' as const;
  const readiness = () => buildReadiness(key, ['TGTG_WEBHOOK_SECRET'], {
    specConfirmed: process.env.TGTG_SPEC_CONFIRMED === 'true',
    note: 'Bag orders are received on the webhook when TGTG enables a partner feed. Bag quantities stay in TGTG MyStore.',
    handoff: [{ label: 'Webhook token (Authorization or X-Api-Key header)', envKey: 'TGTG_WEBHOOK_SECRET' }],
  });
  const blocked = async () => result(key, 'blocked', 'Too Good To Go has no public merchant API — manage bags in TGTG MyStore.');
  return {
    key,
    label: 'Too Good To Go',
    readiness,
    verifyWebhook: (h) => checkSharedSecret(h, 'TGTG_WEBHOOK_SECRET', ['authorization', 'x-takatak-token', 'x-api-key']),
    // Nothing to send: a TGTG reservation is already confirmed in the TGTG app. 'skipped' (not 'done')
    // so the log shows nothing was sent to TGTG; the order moves on in the kitchen flow.
    acceptOrder: async () => result(key, 'skipped', 'Nothing sent — TGTG reservations are confirmed in the TGTG app.'),
    denyOrder: blocked,
    cancelOrder: blocked,
    markReady: async () => result(key, 'skipped', 'Nothing sent — the customer shows the TGTG app at pickup.'),
    publishMenu: blocked,
    setItemAvailability: blocked,
    setStoreOnline: blocked,
  };
})();

const amount = (v: any) => {
  if (v == null) return 0;
  if (typeof v === 'object') return typeof v.amount === 'number' ? fromCents(v.amount) : Number(v.value || 0);
  const n = Number(v);
  return Number.isInteger(n) && Math.abs(n) >= 1000 ? n / 100 : n;
};

/** Best-effort parser for a partner payload without a published spec. Returns null when the shape is unknown. */
export function parseGenericOrder(channel: ChannelKey, marketplace: Marketplace, body: any): NormalizedOrder | null {
  const o = body?.order ?? body?.data ?? body;
  const id = o?.id ?? o?.orderId ?? o?.order_id ?? o?.reference;
  const rawItems: any[] = o?.items ?? o?.lines ?? o?.lineItems ?? o?.basket?.items ?? [];
  if (!id || !Array.isArray(rawItems) || rawItems.length === 0) return null;
  const lines: OrderLine[] = rawItems.map((it) => {
    const qty = Number(it.quantity ?? it.qty ?? 1);
    const unit = amount(it.unitPrice ?? it.unit_price ?? it.price);
    return {
      externalId: it.reference ?? it.ref ?? it.id ?? it.sku ? String(it.reference ?? it.ref ?? it.id ?? it.sku) : undefined,
      name: String(it.name ?? it.title ?? 'Surprise Bag'),
      quantity: qty,
      unitPrice: unit,
      total: amount(it.total ?? it.totalPrice) || unit * qty,
      notes: it.notes ?? it.instructions ?? undefined,
      modifiers: [],
    };
  });
  const subtotal = amount(o.subtotal ?? o.subTotal) || lines.reduce((s, l) => s + l.total, 0);
  return {
    channel,
    marketplace,
    externalOrderId: String(id),
    displayId: o.displayId ?? o.pickupCode ?? o.short_code ?? undefined,
    channelStoreId: String(o.storeId ?? o.store_id ?? o.store?.id ?? o.restaurantId ?? ''),
    customerName: o.customer?.firstName ?? o.customer?.name ?? undefined,
    fulfillment: 'pickup',
    placedAt: o.placedAt ?? o.createdAt ?? o.created_at ?? new Date().toISOString(),
    readyBy: o.pickupStart ?? o.pickup_start ?? undefined,
    currency: o.currency ?? process.env.FOODHUB_CURRENCY ?? 'CAD',
    subtotal,
    tax: amount(o.tax),
    deliveryFee: 0,
    tip: 0,
    discount: 0,
    total: amount(o.total ?? o.totalPrice) || subtotal,
    notes: o.notes ?? undefined,
    lines,
    raw: body,
  };
}
