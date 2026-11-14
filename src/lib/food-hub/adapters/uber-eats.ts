// Uber Eats direct adapter (Marketplace APIs).
// Spec: https://developer.uber.com/docs/eats  — access requires Uber approval of the app's scopes.
import crypto from 'node:crypto';
import { callApi, fromCents, result, safeEqual, stripSlash, timedFetch } from '../config';
import { uberCourierDetails } from '../courier';
import { toUberHolidayHours, toUberMenu } from '../menu/translate';
import type { CancelReason, PlatformState, ChannelAdapter, ChannelStore, NormalizedOrder, OrderLine, StoredOrder } from '../types';
import { blockedResult, buildReadiness } from './common';

const KEY = 'uber_eats' as const;

function base() { return stripSlash(process.env.UBER_BASE_URL || 'https://api.uber.com'); }

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function uberAccessToken(): Promise<string> {
  if (process.env.UBER_ACCESS_TOKEN) return process.env.UBER_ACCESS_TOKEN;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const res = await timedFetch(process.env.UBER_AUTH_URL || 'https://auth.uber.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.UBER_CLIENT_ID || '',
      client_secret: process.env.UBER_CLIENT_SECRET || '',
      grant_type: 'client_credentials',
      scope: process.env.UBER_OAUTH_SCOPE || 'eats.order eats.store eats.store.status.write',
    }).toString(),
  });
  if (!res.ok) throw new Error(`Uber OAuth token request failed: HTTP ${res.status}`);
  const json = await res.json();
  if (!json.access_token) throw new Error('Uber OAuth response had no access_token.');
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 2592000) * 1000 };
  return cachedToken.value;
}

let cachedReportToken: { value: string; expiresAt: number } | null = null;

/** Separate token for the Reporting API (scope eats.report), so an app without it keeps working for orders. */
async function uberReportToken(): Promise<string> {
  if (cachedReportToken && cachedReportToken.expiresAt > Date.now() + 60_000) return cachedReportToken.value;
  const res = await timedFetch(process.env.UBER_AUTH_URL || 'https://auth.uber.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.UBER_CLIENT_ID || '', client_secret: process.env.UBER_CLIENT_SECRET || '', grant_type: 'client_credentials', scope: process.env.UBER_REPORT_SCOPE || 'eats.report' }).toString(),
  });
  if (!res.ok) throw new Error(`Uber Reporting token refused (HTTP ${res.status}) — ask Uber to add the eats.report scope to your app.`);
  const json = await res.json();
  if (!json.access_token) throw new Error('Uber OAuth response had no access_token.');
  cachedReportToken = { value: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 2592000) * 1000 };
  return cachedReportToken.value;
}

export const UBER_REPORT_TYPES = ['PAYMENT_DETAILS_REPORT', 'FINANCE_SUMMARY_REPORT', 'ORDER_HISTORY_REPORT', 'ORDERS_AND_ITEMS_REPORT', 'DOWNTIME_REPORT', 'ORDER_ERRORS_TRANSACTION_REPORT'] as const;

/**
 * Uber Eats Reporting API: POST /v1/eats/report { report_type, store_uuids, start_date, end_date } → { workflow_id }.
 * The report is built asynchronously; Uber calls the webhook (eats.report.success) with the download link.
 * Read-only, so it works before the live switch is on.
 */
export async function requestUberReport(storeUuids: string[], startDate: string, endDate: string, reportType: (typeof UBER_REPORT_TYPES)[number] = 'PAYMENT_DETAILS_REPORT'): Promise<{ ok: boolean; workflowId?: string; message: string }> {
  if (!process.env.UBER_CLIENT_ID || !process.env.UBER_CLIENT_SECRET) return { ok: false, message: 'Uber Eats is not connected (UBER_CLIENT_ID / UBER_CLIENT_SECRET).' };
  if (!storeUuids.length) return { ok: false, message: 'No Uber Eats stores are mapped yet.' };
  try {
    const res = await timedFetch(`${base()}/v1/eats/report`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await uberReportToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_type: reportType, store_uuids: storeUuids, start_date: startDate, end_date: endDate }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: `Uber Reporting API HTTP ${res.status}: ${String(json?.message ?? json?.error ?? '').slice(0, 200)}` };
    const workflowId = json?.workflow_id ?? json?.workflowId ?? json?.id;
    return { ok: true, workflowId: workflowId ? String(workflowId) : undefined, message: 'Report requested — Uber sends it to Food Hub when it is ready (usually minutes).' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/** Download links inside a report webhook (field names vary by report type, so collect every http link). */
export function reportDownloadLinks(body: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown, key = '') => {
    if (typeof v === 'string') { if (/^https?:\/\//.test(v) && /url|link|download|href/i.test(key)) out.add(v); return; }
    if (Array.isArray(v)) { v.forEach((x) => walk(x, key)); return; }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(body);
  return [...out];
}

async function headers() {
  return { Authorization: `Bearer ${await uberAccessToken()}`, 'Content-Type': 'application/json' };
}

function readiness() {
  return buildReadiness(KEY, ['UBER_CLIENT_ID', 'UBER_CLIENT_SECRET'], {
    note: 'Direct mode. Requires Uber to approve your app for eats.order + eats.store + eats.pos_provisioning. Webhooks are verified with your Client Secret automatically. Then: Stores → “Connect Uber Eats stores”.',
    extraWebhooks: [{ label: 'OAuth redirect URI (Uber developer dashboard → your app → Redirect URIs)', path: '/api/food-hub/uber-connect/callback' }],
  });
}

async function send(method: string, path: string, body?: unknown, okStatus: 'done' | 'queued' = 'done') {
  const r = readiness();
  if (!r.canSend) return blockedResult(KEY, r);
  try {
    return await callApi(KEY, `${base()}${path}`, { method, headers: await headers(), body: body === undefined ? undefined : JSON.stringify(body) }, okStatus);
  } catch (error) {
    return result(KEY, 'error', error instanceof Error ? error.message : String(error));
  }
}

const UBER_CANCEL: Record<CancelReason, string> = {
  out_of_stock: 'OUT_OF_ITEMS',
  store_closed: 'KITCHEN_CLOSED',
  too_busy: 'RESTAURANT_TOO_BUSY',
  customer_request: 'CUSTOMER_CALLED_TO_CANCEL',
  pos_issue: 'OTHER',
  other: 'OTHER',
};

const DENY_CODES: Array<[RegExp, string]> = [
  [/stock|86|unavailable|item/i, 'ITEM_AVAILABILITY'],
  [/closed/i, 'STORE_CLOSED'],
  [/busy|capacity/i, 'CAPACITY'],
  [/pos|offline|connect/i, 'POS_OFFLINE'],
];

export const uberEatsAdapter: ChannelAdapter = {
  key: KEY,
  label: 'Uber Eats (direct)',
  readiness,
  verifyWebhook(h, rawBody) {
    // Uber signs the raw body: lowercase hex HMAC-SHA256 keyed with the app client secret.
    const secret = process.env.UBER_CLIENT_SECRET;
    const sig = h.get('x-uber-signature');
    if (!secret || !sig) return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    return safeEqual(expected, sig.toLowerCase());
  },
  acceptOrder: (order, posRef) => send('POST', `/v1/eats/orders/${encodeURIComponent(order.externalOrderId)}/accept_pos_order`, {
    reason: 'Accepted by TAKATAK Food Hub',
    ...(posRef ? { external_reference_id: posRef } : {}),
  }),
  denyOrder: (order, reason) => send('POST', `/v1/eats/orders/${encodeURIComponent(order.externalOrderId)}/deny_pos_order`, {
    reason: { explanation: reason || 'Rejected by restaurant', code: DENY_CODES.find(([re]) => re.test(reason))?.[1] ?? 'OTHER' },
  }),
  async markReady() {
    // Uber's order integration guide: there is no endpoint to mark an order ready after acceptance.
    return result(KEY, 'skipped', 'Uber Eats has no "order ready" API; courier dispatch uses the prep time given at acceptance.');
  },
  // POST /v1/eats/orders/{id}/cancel — reasons: OUT_OF_ITEMS, KITCHEN_CLOSED, CUSTOMER_CALLED_TO_CANCEL, RESTAURANT_TOO_BUSY, CANNOT_COMPLETE_CUSTOMER_NOTE, OTHER
  cancelOrder: (order, reason, details) => send('POST', `/v1/eats/orders/${encodeURIComponent(order.externalOrderId)}/cancel`, {
    reason: UBER_CANCEL[reason] ?? 'OTHER',
    ...(UBER_CANCEL[reason] === 'OTHER' || details ? { details: (details || 'Cancelled by restaurant').slice(0, 200) } : {}),
  }),
  async publishMenu(store: ChannelStore, menu, ctx) {
    const res = await send('PUT', `/v2/eats/stores/${encodeURIComponent(store.channelStoreId)}/menus`, toUberMenu(menu, ctx));
    if (!res.ok || !ctx?.holidays.length) return res;
    // Holiday closures / special hours: POST /v1/eats/stores/{id}/holiday-hours
    const h = await send('POST', `/v1/eats/stores/${encodeURIComponent(store.channelStoreId)}/holiday-hours`, toUberHolidayHours(ctx.holidays));
    return h.ok ? { ...res, message: `Menu updated + ${ctx.holidays.length} holiday date(s) sent` } : { ...h, message: `Menu updated, but holiday hours failed: ${h.message}` };
  },
  async setItemAvailability(store, refs, available, untilMs, kind = 'item') {
    const r = readiness();
    if (!r.canSend) return blockedResult(KEY, r);
    const suspendUntil = available ? 0 : Math.floor((untilMs ?? 8640000000 * 1000) / 1000);
    let last = result(KEY, 'skipped', 'No items to update.');
    // Modifiers are menu items too on Uber (id "mod:<ref>" in our menus).
    for (const ref of refs.map((x) => (kind === 'modifier' ? `mod:${x}` : x))) {
      last = await send('POST', `/v2/eats/stores/${encodeURIComponent(store.channelStoreId)}/menus/items/${encodeURIComponent(ref)}`, {
        suspension_info: { suspension: { suspend_until: suspendUntil, reason: available ? '' : 'Sold out' } },
      });
      if (!last.ok) return last;
    }
    return last;
  },
  setStoreOnline: (store, online, untilMs, reason) => send('POST', `/v1/eats/store/${encodeURIComponent(store.channelStoreId)}/status`, online
    ? { status: 'ONLINE' }
    : { status: 'PAUSED', reason: reason || 'Paused from TAKATAK Food Hub', ...(untilMs ? { paused_until: new Date(untilMs).toISOString() } : {}) }),
};

/** GET order details from the resource_href in the orders.notification webhook. */
export async function fetchUberOrder(resourceHrefOrId: string): Promise<any> {
  const url = resourceHrefOrId.startsWith('http') ? resourceHrefOrId : `${base()}/v2/eats/order/${encodeURIComponent(resourceHrefOrId)}`;
  const res = await timedFetch(url, { headers: await headers() });
  if (!res.ok) throw new Error(`Uber order fetch failed: HTTP ${res.status}`);
  return res.json();
}

/** Normalizes GET /v1/eats/store/{id}/status → { status: ONLINE|OFFLINE|PAUSED, offlineReason }. */
export function normalizeUberStatus(body: any): { state: PlatformState; detail?: string; until?: string | null } {
  const status = String(body?.status ?? '').toUpperCase();
  const reason = String(body?.offlineReason ?? body?.offline_reason ?? '').toUpperCase();
  const until = body?.paused_until ?? body?.is_offline_until ?? body?.offlineUntil ?? null;
  if (status === 'ONLINE') return { state: 'online' };
  if (status === 'PAUSED' || /PAUSE/.test(reason)) return { state: 'paused', detail: reason || 'PAUSED', until };
  if (/MENU_HOURS|OUT_OF_HOURS|HOURS|HOLIDAY|CLOSED/.test(reason)) return { state: 'closed', detail: reason };
  if (/INVISIBLE|DEACTIVAT|INACTIVE|NOT_ACTIVE|SUSPEND|REMOVED|CHURN/.test(reason)) return { state: 'deactivated', detail: reason };
  if (status === 'OFFLINE') return { state: 'paused', detail: reason || 'OFFLINE', until };
  return { state: 'unknown', detail: status || 'No status in Uber response' };
}

/** Read-only status check. Runs whenever credentials exist (it changes nothing on Uber). */
export async function fetchUberStoreStatus(storeId: string): Promise<{ ok: boolean; state: PlatformState; detail?: string; until?: string | null; error?: string }> {
  if (!readiness().configured) return { ok: false, state: 'unknown', error: 'Uber Eats credentials missing' };
  try {
    const res = await timedFetch(`${base()}/v1/eats/store/${encodeURIComponent(storeId)}/status`, { headers: await headers() });
    if (!res.ok) return { ok: false, state: res.status === 404 ? 'deactivated' : 'unknown', error: `Uber status HTTP ${res.status}` };
    return { ok: true, ...normalizeUberStatus(await res.json()) };
  } catch (error) {
    return { ok: false, state: 'unknown', error: error instanceof Error ? error.message : String(error) };
  }
}

/** Lists stores provisioned to this app — used for one-click store discovery. */
export async function discoverUberStores(): Promise<Array<{ id: string; name: string; address?: string }>> {
  const res = await timedFetch(`${base()}/v1/eats/stores`, { headers: await headers() });
  if (!res.ok) throw new Error(`Uber store discovery failed: HTTP ${res.status}`);
  const json = await res.json();
  const rows: any[] = Array.isArray(json?.stores) ? json.stores : Array.isArray(json?.data) ? json.data : [];
  return rows.map((s) => ({ id: String(s.store_id ?? s.id), name: String(s.name ?? ''), address: s.location?.address ?? undefined }));
}

const money = (m: any) => (m && typeof m === 'object' ? (typeof m.amount_e5 === 'number' ? m.amount_e5 / 100000 : fromCents(m.amount)) : 0);

export function parseUberOrder(o: any, storeIdFallback?: string): NormalizedOrder | null {
  if (!o?.id) return null;
  const items: any[] = Array.isArray(o.cart?.items) ? o.cart.items : [];
  const lines: OrderLine[] = items.map((it) => {
    const qty = Number(it.quantity || 1);
    const modifiers = (Array.isArray(it.selected_modifier_groups) ? it.selected_modifier_groups : [])
      .flatMap((g: any) => (Array.isArray(g.selected_items) ? g.selected_items : []))
      .map((m: any) => ({
        externalId: m.external_data || (m.id ? String(m.id).replace(/^mod:/, '') : undefined),
        name: String(m.title ?? ''),
        quantity: Number(m.quantity || 1),
        unitPrice: money(m.price?.unit_price),
      }));
    const unitBase = money(it.price?.base_unit_price) || money(it.price?.unit_price);
    return {
      externalId: it.external_data || String(it.id ?? ''),
      name: String(it.title ?? 'Item'),
      quantity: qty,
      unitPrice: unitBase,
      total: money(it.price?.total_price) || unitBase * qty,
      notes: it.special_instructions || undefined,
      modifiers,
    };
  });
  const charges = o.payment?.charges ?? {};
  const type = String(o.type || '');
  return {
    channel: KEY,
    marketplace: 'uber_eats',
    externalOrderId: String(o.id),
    displayId: o.display_id ? String(o.display_id) : undefined,
    channelStoreId: String(o.store?.id ?? storeIdFallback ?? ''),
    customerName: o.eater?.first_name || undefined,
    fulfillment: type === 'PICK_UP' ? 'pickup' : type === 'DINE_IN' ? 'dine_in' : 'delivery',
    placedAt: o.placed_at || new Date().toISOString(),
    readyBy: o.estimated_ready_for_pickup_at || undefined,
    currency: charges.total?.currency_code || process.env.FOODHUB_CURRENCY || 'CAD',
    subtotal: money(charges.sub_total),
    tax: money(charges.tax),
    deliveryFee: money(charges.delivery_fee),
    tip: money(charges.tip),
    discount: 0,
    total: money(charges.total),
    notes: o.cart?.special_instructions || undefined,
    lines,
    courier: uberCourierDetails(o),
    raw: o,
  };
}

export type _UberStoredOrder = StoredOrder;
