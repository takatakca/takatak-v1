// Clover bookkeeping for delivery orders (what UrbanPiper's POS integration does):
//  - every delivery order gets an Order Type per platform ("Uber Eats", "DoorDash"…) so the kitchen
//    and Clover reports show where it came from;
//  - once the order is in Clover it is recorded as PAID with a custom tender per platform, so it does
//    not sit open on the register and Clover's sales reports match the platforms.
// Clover endpoints (docs.clover.com):
//   GET/POST /v3/merchants/{mId}/tenders               { label, enabled, visible, opensCashDrawer }
//   GET/POST /v3/merchants/{mId}/order_types           { label, taxable }
//   POST     /v3/merchants/{mId}/orders/{orderId}/payments
//            { amount, taxAmount, tipAmount, tender: { id }, externalPaymentId, result: "SUCCESS" }
//            ("references external tenders and logs them for bookkeeping purposes")
import { CHANNEL_LABELS, timedFetch, toCents } from '../config';
import { getRepo } from '../repo';
import type { ChannelKey, StoredOrder } from '../types';
import { cloverBaseUrl, cloverTokenFor } from './clover';

const KV = 'clover_refs';
type Refs = Record<string, { tenders?: Record<string, string>; orderTypes?: Record<string, string> }>;

export function cloverRecordPaymentEnabled() {
  return process.env.FOODHUB_CLOVER_RECORD_PAYMENT !== 'off';
}
export function cloverOrderTypesEnabled() {
  return process.env.FOODHUB_CLOVER_ORDER_TYPES !== 'off';
}
export function cloverDeleteCancelledEnabled() {
  return process.env.FOODHUB_CLOVER_DELETE_CANCELLED !== 'off';
}

/** Tender / order-type label for a platform, e.g. "Uber Eats". */
export function platformLabel(channel: ChannelKey) {
  return CHANNEL_LABELS[channel];
}

async function cloverJson(mid: string, path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; json: any }> {
  const token = cloverTokenFor(mid);
  if (!token) return { ok: false, status: 0, json: { message: `No Clover API token for merchant ${mid}` } };
  const res = await timedFetch(`${cloverBaseUrl()}/v3/merchants/${encodeURIComponent(mid)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 300) }; }
  return { ok: res.ok, status: res.status, json };
}

async function readRefs(): Promise<Refs> {
  return (await getRepo().getKv<Refs>(KV).catch(() => null)) ?? {};
}
async function saveRef(mid: string, kind: 'tenders' | 'orderTypes', label: string, id: string) {
  const refs = await readRefs();
  refs[mid] = { ...(refs[mid] ?? {}), [kind]: { ...(refs[mid]?.[kind] ?? {}), [label]: id } };
  await getRepo().setKv(KV, refs);
}

/** Finds (or creates once) a Clover object by label — tenders and order types work the same way. */
async function ensureLabeled(mid: string, kind: 'tenders' | 'orderTypes', label: string): Promise<string | null> {
  const refs = await readRefs();
  const known = refs[mid]?.[kind]?.[label];
  if (known) return known;
  const path = kind === 'tenders' ? '/tenders' : '/order_types';
  const list = await cloverJson(mid, `${path}?limit=1000`);
  if (list.ok) {
    const hit = (list.json?.elements ?? []).find((e: any) => String(e.label || '').trim().toLowerCase() === label.toLowerCase());
    if (hit?.id) { await saveRef(mid, kind, label, String(hit.id)); return String(hit.id); }
  }
  const body = kind === 'tenders'
    ? { label, labelKey: `com.takatak.foodhub.${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, enabled: true, visible: true, opensCashDrawer: false }
    : { label, taxable: true };
  const created = await cloverJson(mid, path, { method: 'POST', body: JSON.stringify(body) });
  if (created.ok && created.json?.id) { await saveRef(mid, kind, label, String(created.json.id)); return String(created.json.id); }
  return null;
}

export async function cloverOrderTypeFor(mid: string | null | undefined, channel: ChannelKey): Promise<string | null> {
  if (!mid || !cloverOrderTypesEnabled()) return null;
  try { return await ensureLabeled(mid, 'orderTypes', platformLabel(channel)); } catch { return null; }
}

export type BookResult = { ok: true; paymentId: string; amount: number } | { ok: false; skipped?: boolean; error: string };

/**
 * Records the platform's payment on the Clover order (custom tender), so the order closes as paid.
 * The amount is what Clover computed for the order (falls back to the platform total), so Clover balances.
 * Never blocks the order: a failure is logged on the order and shown in alerts.
 */
export async function recordCloverPayment(order: StoredOrder, mid: string | null | undefined): Promise<BookResult> {
  if (!cloverRecordPaymentEnabled()) return { ok: false, skipped: true, error: 'Payment recording is off (FOODHUB_CLOVER_RECORD_PAYMENT=off).' };
  const merchant = mid || process.env.CLOVER_MERCHANT_ID;
  if (!merchant || !order.posOrderId) return { ok: false, skipped: true, error: 'Order is not in Clover.' };
  try {
    const tenderId = await ensureLabeled(merchant, 'tenders', platformLabel(order.channel));
    if (!tenderId) return { ok: false, error: `Could not find or create the "${platformLabel(order.channel)}" tender in Clover (needs the Payments write permission).` };
    const current = await cloverJson(merchant, `/orders/${encodeURIComponent(order.posOrderId)}`);
    const cloverTotal = Number(current.json?.total);
    const amount = Number.isFinite(cloverTotal) && cloverTotal > 0 ? cloverTotal : toCents(order.subtotal - (order.discount || 0) + order.tax);
    const res = await cloverJson(merchant, `/orders/${encodeURIComponent(order.posOrderId)}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        amount,
        taxAmount: toCents(order.tax),
        tipAmount: 0,
        tender: { id: tenderId },
        externalPaymentId: externalPaymentId(order),
        result: 'SUCCESS',
      }),
    });
    if (!res.ok || !res.json?.id) return { ok: false, error: `Clover payment HTTP ${res.status}: ${JSON.stringify(res.json).slice(0, 200)}` };
    return { ok: true, paymentId: String(res.json.id), amount: amount / 100 };
  } catch (error) {
    return { ok: false, error: `Clover payment error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

const SHORT: Record<ChannelKey, string> = { uber_eats: 'ue', doordash: 'dd', skip: 'sk', tgtg: 'tg' };
/**
 * A platform order was cancelled before it was recorded as paid: remove it from the Clover register
 * (DELETE /v3/merchants/{mId}/orders/{orderId} — only possible while the order has no payment, which is
 * why Food Hub records the payment only when the order leaves the kitchen). If Clover refuses the delete,
 * the order is renamed "CANCELLED" so nobody makes it or charges it.
 */
export async function closeCancelledCloverOrder(order: StoredOrder, mid: string | null | undefined): Promise<{ ok: boolean; skipped?: boolean; message: string }> {
  if (!cloverDeleteCancelledEnabled()) return { ok: false, skipped: true, message: 'Removing cancelled orders from Clover is off (FOODHUB_CLOVER_DELETE_CANCELLED=off).' };
  const merchant = mid || process.env.CLOVER_MERCHANT_ID;
  if (!merchant || !order.posOrderId) return { ok: false, skipped: true, message: 'Order is not in Clover.' };
  try {
    const path = `/orders/${encodeURIComponent(order.posOrderId)}`;
    const del = await cloverJson(merchant, path, { method: 'DELETE' });
    if (del.ok) return { ok: true, message: 'Cancelled order removed from the Clover register.' };
    const tag = `CANCELLED — ${platformLabel(order.channel)} #${order.displayId || order.externalOrderId.slice(0, 8)}`;
    const upd = await cloverJson(merchant, path, { method: 'POST', body: JSON.stringify({ title: tag.slice(0, 127), note: 'Cancelled on the delivery platform — do not make, do not charge.' }) });
    return upd.ok
      ? { ok: true, message: `Clover refused the delete (HTTP ${del.status}) — the order was renamed “CANCELLED”.` }
      : { ok: false, message: `Clover HTTP ${del.status} / ${upd.status}: delete it from the Clover Orders app.` };
  } catch (error) {
    return { ok: false, message: `Clover error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** Short, unique reference stored on the Clover payment (platform + order id), max 32 chars. */
export function externalPaymentId(order: Pick<StoredOrder, 'channel' | 'externalOrderId'>) {
  return `${SHORT[order.channel]}:${order.externalOrderId.slice(-28)}`;
}

/** Labels used for platform tenders — payments with these tenders are delivery sales, never in-store. */
export const PLATFORM_TENDER_LABELS = new Set(Object.values(CHANNEL_LABELS).map((l) => l.toLowerCase()));

/** One Clover item (with stock) — used by the Clover → platforms 86 sync. */
export async function getCloverItem(mid: string, itemId: string): Promise<any | null> {
  const r = await cloverJson(mid, `/items/${encodeURIComponent(itemId)}?expand=itemStock`);
  return r.ok ? r.json : null;
}

/** Items changed since a time (polling fallback when Clover webhooks are not set up). */
export async function cloverItemsModifiedSince(mid: string, sinceMs: number): Promise<any[]> {
  const out: any[] = [];
  for (let offset = 0; offset < 10_000; offset += 1000) {
    const qs = new URLSearchParams({ filter: `modifiedTime>=${sinceMs}`, expand: 'itemStock', limit: '1000', offset: String(offset) });
    const r = await cloverJson(mid, `/items?${qs}`);
    if (!r.ok) throw new Error(`Clover items HTTP ${r.status}`);
    const rows: any[] = r.json?.elements ?? [];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

/** Is a Clover item sellable right now? available=false, hidden, or tracked stock at 0 → no. */
export function cloverItemSellable(item: any): boolean {
  if (!item) return true;
  if (item.available === false || item.hidden === true) return false;
  const stock = item.itemStock ?? item.stock;
  const qty = Number(stock?.quantity ?? stock?.stockCount);
  if (item.autoManage === true && Number.isFinite(qty) && qty <= 0) return false;
  return true;
}
