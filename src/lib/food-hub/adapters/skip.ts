// SkipTheDishes direct adapter — JET Connect (Just Eat Takeaway's POS integration API,
// formerly Flyt). Spec: https://uk.api.just-eat.io/docs/openapi.yaml  ("JET Connect" tags).
//
//  Inbound (JET → Food Hub), URLs you give your Skip / JET Connect contact:
//    Orders            POST /api/food-hub/webhooks/skip/orders      (signed: X-JET-Connect-Hash)
//    Cancellations     POST /api/food-hub/webhooks/skip/cancel
//    Temp offline      POST /api/food-hub/webhooks/skip/offline
//    Menu status       POST /api/food-hub/webhooks/skip/menu-status (callback_url on menu pushes)
//  Outbound (Food Hub → JET), header X-Flyt-Api-Key:
//    POST /order/{id}/sent-to-pos-success | sent-to-pos-failed   (within 5 min of a 202)
//    POST /menus · POST /item-availability · PUT /restaurants/{ref}/online|offline
import crypto from 'node:crypto';
import { callApi, publicBaseUrl, result, safeEqual, stripSlash } from '../config';
import { toSkipMenu } from '../menu/translate';
import type { ChannelAdapter, NormalizedOrder, OrderLine, StoredOrder } from '../types';
import { blockedResult, buildReadiness } from './common';
import { localTimestamp } from '../time';

const KEY = 'skip' as const;

function base() { return stripSlash(process.env.SKIP_JET_BASE_URL || 'https://api.flytplatform.com'); }

function headers() {
  return { 'X-Flyt-Api-Key': process.env.SKIP_JET_API_KEY || '', 'Content-Type': 'application/json' };
}

function readiness() {
  return buildReadiness(KEY, ['SKIP_JET_API_KEY', 'SKIP_WEBHOOK_HMAC_SECRET'], {
    note: 'Direct via JET Connect. Your Skip partnership manager issues the X-Flyt-Api-Key and links your restaurants to your store ids.',
    extraWebhooks: [
      { label: 'Cancel order notification', path: '/api/food-hub/webhooks/skip/cancel' },
      { label: 'Restaurant temporarily offline notification', path: '/api/food-hub/webhooks/skip/offline' },
      { label: 'Menu status callback (automatic)', path: '/api/food-hub/webhooks/skip/menu-status' },
      { label: 'Driver status notification', path: '/api/food-hub/webhooks/skip/driver' },
      { label: 'Failed order for backup flow', path: '/api/food-hub/webhooks/skip/failed' },
    ],
    handoff: [
      { label: 'Webhook HMAC secret (X-JET-Connect-Hash)', envKey: 'SKIP_WEBHOOK_HMAC_SECRET' },
      { label: 'API key for notifications (Authorization header)', envKey: 'SKIP_WEBHOOK_API_KEY' },
    ],
  });
}

function send(method: string, path: string, body?: unknown, okStatus: 'done' | 'queued' = 'done') {
  const r = readiness();
  if (!r.canSend) return Promise.resolve(blockedResult(KEY, r));
  return callApi(KEY, `${base()}${path}`, { method, headers: headers(), body: body === undefined ? undefined : JSON.stringify(body) }, okStatus);
}

/** X-JET-Connect-Hash: "HMAC-SHA256 t=<ms>,signature=<base64 HMAC-SHA256(secret, raw body)>". */
export function verifyJetHash(header: string | null, rawBody: string, secret: string | undefined): boolean {
  if (!header || !secret) return false;
  const match = header.match(/signature=([^,\s]+)/);
  if (!match) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  return safeEqual(expected, match[1]);
}

function verify(h: Headers, rawBody: string): boolean {
  if (verifyJetHash(h.get('x-jet-connect-hash'), rawBody, process.env.SKIP_WEBHOOK_HMAC_SECRET)) return true;
  // JET also sends the API key you registered with them in the Authorization header (used on notifications).
  const key = process.env.SKIP_WEBHOOK_API_KEY;
  const auth = (h.get('authorization') || '').replace(/^(Bearer|Basic|Token)\s+/i, '').trim();
  return Boolean(key) && safeEqual(auth, key);
}

function transmission(order: StoredOrder): Record<string, string> {
  const raw = order.raw as Record<string, unknown> | undefined;
  return raw?.transmission_id ? { transmissionId: String(raw.transmission_id) } : {};
}

export { localTimestamp };

/**
 * JET Connect "Indicate out of stock and substituted items in an order":
 * POST /orders/{orderId}/modification  { modifications: [{ removedItems: [{ plu, missingQuantity }] }] }
 */
export function reportSkipMissingItems(order: StoredOrder, items: Array<{ plu: string; missingQuantity: number }>) {
  return send('POST', `/orders/${encodeURIComponent(order.externalOrderId)}/modification`, { modifications: [{ removedItems: items }] });
}

/** JET "Failed Order For Backup Flow": the order failed JET validation and went to the Skip tablet. */
export function parseSkipFailedOrder(body: any): (NormalizedOrder & { failure: string }) | null {
  const o = body?.order;
  if (!o?.orderId) return null;
  const items: any[] = Array.isArray(o.items) ? o.items : [];
  const lines: OrderLine[] = items.map((it) => {
    const qty = Number(it.quantity ?? 1) || 1;
    const unit = Number(it.price ?? 0) / 100;
    return {
      externalId: it.plu ? String(it.plu) : undefined,
      name: String(it.name ?? 'Item'),
      quantity: qty,
      unitPrice: unit,
      total: Math.round(unit * qty * 100) / 100,
      notes: it.notes || undefined,
      modifiers: (Array.isArray(it.children) ? it.children : []).map((c: any) => ({ externalId: c.plu ? String(c.plu) : undefined, name: String(c.name ?? ''), quantity: Number(c.quantity ?? 1) || 1, unitPrice: Number(c.price ?? 0) / 100 })),
    };
  });
  const itemsSum = lines.reduce((s, l) => s + l.total + l.modifiers.reduce((m, x) => m + x.unitPrice * x.quantity, 0), 0);
  const rawTotal = Number(o.totalPrice ?? 0);
  // totalPrice is documented as a number; choose dollars or cents by whichever matches the items.
  const total = Math.abs(rawTotal - itemsSum) <= Math.abs(rawTotal / 100 - itemsSum) ? rawTotal : rawTotal / 100;
  const due = Date.parse(o.fulfilment?.customerDueDate ?? '');
  return {
    channel: KEY,
    marketplace: 'skip',
    externalOrderId: String(o.orderId),
    displayId: o.friendlyOrderReference ? String(o.friendlyOrderReference) : undefined,
    channelStoreId: String(o.restaurant?.id ?? ''),
    customerName: o.customer?.name ? String(o.customer.name).split(' ')[0] : undefined,
    fulfillment: /collection|pickup/i.test(String(o.fulfilment?.type ?? o.fulfilment?.method ?? '')) ? 'pickup' : 'delivery',
    placedAt: o.placedDate || new Date().toISOString(),
    readyBy: Number.isFinite(due) ? new Date(due).toISOString() : undefined,
    currency: o.currency || 'CAD',
    subtotal: Math.round(itemsSum * 100) / 100,
    tax: 0,
    deliveryFee: 0,
    tip: 0,
    discount: 0,
    total: Math.round(total * 100) / 100,
    notes: o.customerNotes ? String(typeof o.customerNotes === 'string' ? o.customerNotes : JSON.stringify(o.customerNotes)) : undefined,
    lines,
    raw: body,
    failure: [body.validationError, body.unknownReference ? `unknown item reference ${body.unknownReference}` : ''].filter(Boolean).join(' — ') || 'JET could not validate the order',
  };
}

export const skipAdapter: ChannelAdapter = {
  key: KEY,
  label: 'SkipTheDishes',
  readiness,
  verifyWebhook: verify,
  // JET Connect has no accept/reject: an order is "injected" (success) or "failed to inject",
  // in which case Skip's backup flow sends it to the Skip tablet.
  acceptOrder: (order) => send('POST', `/order/${encodeURIComponent(order.externalOrderId)}/sent-to-pos-success`, transmission(order)),
  async denyOrder(order, reason) {
    const res = await send('POST', `/order/${encodeURIComponent(order.externalOrderId)}/sent-to-pos-failed`, transmission(order));
    return res.ok ? { ...res, message: `Not taken by Food Hub (${reason || 'rejected'}) — Skip routes it to the Skip tablet (backup flow).` } : res;
  },
  async markReady() {
    return result(KEY, 'skipped', 'Skip has no "order ready" call in JET Connect; couriers follow the collect time.');
  },
  async cancelOrder() {
    return result(KEY, 'blocked', 'JET Connect has no merchant cancel call — cancel it on the Skip tablet or with Skip restaurant support.');
  },
  publishMenu: (store, menu, ctx) => send('POST', '/menus', toSkipMenu(menu, [store.channelStoreId], `${publicBaseUrl()}/api/food-hub/webhooks/skip/menu-status`, new Set(), ctx), 'queued'),
  // Items and modifiers share the same PLU-based availability call.
  setItemAvailability: (store, itemRefs, available, untilMs) => itemRefs.length === 0
    ? Promise.resolve(result(KEY, 'skipped', 'No items to update.'))
    : send('POST', '/item-availability', {
      event: available ? 'AVAILABLE' : 'UNAVAILABLE',
      itemReferences: itemRefs,
      restaurant: store.channelStoreId,
      happenedAt: new Date().toISOString(),
      ...(!available && untilMs ? { nextAvailableAt: new Date(untilMs).toISOString() } : {}),
    }, 'queued'),
  setStoreOnline: (store, online, untilMs) => online
    ? send('PUT', `/restaurants/${encodeURIComponent(store.channelStoreId)}/online`, undefined, 'queued')
    : send('PUT', `/restaurants/${encodeURIComponent(store.channelStoreId)}/offline`, untilMs ? { onlineAt: localTimestamp(untilMs) } : {}, 'queued'),
};

const cents = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) / 100 : Number(n) ? Number(n) / 100 : 0);
const masked = (s: unknown) => (typeof s === 'string' && s && !/^\*+$/.test(s) ? s : undefined);

export function parseSkipOrder(o: any): NormalizedOrder | null {
  if (!o?.id || !Array.isArray(o.items)) return null;
  const lines: OrderLine[] = o.items.map((it: any) => {
    const qty = Number(it.quantity || 1);
    const children: any[] = Array.isArray(it.children) ? it.children : Array.isArray(it.items) ? it.items : [];
    const modifiers = children.map((c) => ({
      externalId: c.plu || c.reference || undefined,
      name: String(c.name ?? ''),
      quantity: Number(c.quantity || 1),
      unitPrice: cents(c.price ?? (typeof c.unitPrice === 'number' ? c.unitPrice * 100 : 0)),
    }));
    const unit = cents(it.price ?? (typeof it.unitPrice === 'number' ? it.unitPrice * 100 : 0));
    const modsTotal = modifiers.reduce((s, m) => s + m.unitPrice * m.quantity, 0);
    return {
      externalId: it.plu || it.reference || undefined,
      name: String(it.name ?? 'Item'),
      quantity: qty,
      unitPrice: unit,
      total: Math.round((unit + modsTotal) * qty * 100) / 100,
      notes: it.notes || undefined,
      modifiers,
    };
  });
  const type = String(o.type || '');
  const pay = o.payment ?? {};
  const cart = pay.items_in_cart ?? {};
  const final = pay.final ?? cart;
  const unix = (v: unknown) => (v ? new Date(Number(v) * (String(v).length > 11 ? 1 : 1000)).toISOString() : undefined);
  return {
    channel: KEY,
    marketplace: 'skip',
    externalOrderId: String(o.id),
    displayId: o.third_party_order_reference ? String(o.third_party_order_reference) : undefined,
    channelStoreId: String(o.posLocationId ?? ''),
    customerName: masked(o.delivery?.first_name) || masked(o.collector?.first_name),
    fulfillment: /collection|pickup/i.test(type) ? 'pickup' : /dine/i.test(type) ? 'dine_in' : 'delivery',
    placedAt: unix(o.created_at) || new Date().toISOString(),
    readyBy: unix(o.collect_at),
    currency: process.env.FOODHUB_CURRENCY || 'CAD',
    subtotal: cents((cart.inc_tax ?? 0) - (cart.tax ?? 0)),
    tax: cents(final.tax ?? 0),
    deliveryFee: 0,
    tip: 0,
    discount: 0,
    total: cents(o.total ?? final.inc_tax ?? 0),
    notes: [o.kitchen_notes, o.delivery_notes, o.collection_notes].filter(Boolean).join(' · ') || undefined,
    lines,
    raw: o,
  };
}
