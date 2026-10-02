// Reports center (Atlas "Data & Reports"): the same 7 reports, as CSV or Excel, on demand,
// by email, or on a daily / weekly / monthly schedule.
import crypto from 'node:crypto';
import { strToU8, zipSync } from 'fflate';
import { logActivity, type Actor } from './activity';
import { getCatalog } from './catalog';
import { CHANNEL_LABELS, CHANNEL_MARKETPLACE } from './config';
import { priceFor } from './menu/translate';
import { offRefsAt } from './ops';
import { getRepo } from './repo';
import { foodhubTimeZone, localParts, startOfLocalDayMs } from './time';
import type { ChannelKey, OrderStatus, StoredOrder } from './types';

export type ReportKey = 'order_transactions' | 'order_status_transitions' | 'item_wise' | 'option_wise' | 'items_summary' | 'menu_snapshot' | 'store_actions';

export const REPORTS: Record<ReportKey, { title: string; description: string }> = {
  order_transactions: { title: 'Order Transactions', description: 'Every order with platform ids, brand, store, status, fulfilment, amounts (subtotal, tax, fees, tip, discount, total), customer and Clover id.' },
  order_status_transitions: { title: 'Order Status Transitions', description: 'When each order was placed, accepted (auto or by whom), ready, handed to the courier, completed or cancelled — with who cancelled, why, and the minutes between steps.' },
  item_wise: { title: 'Item-wise Order Transactions', description: 'One line per item sold: order, date, brand, platform, store, quantity, unit price, modifiers and line total.' },
  option_wise: { title: 'Option-wise Order Transactions', description: 'One line per modifier/option sold (sauces, sizes, extras) with its parent item.' },
  items_summary: { title: 'Items Summary Across All Locations', description: 'Each item’s total quantity, revenue, number of orders and number of locations that sold it.' },
  menu_snapshot: { title: 'Menu Snapshot Across All Locations', description: 'Every item at every mapped store and platform: in stock or 86’d, base price and platform price.' },
  store_actions: { title: 'Store Action Report', description: 'Who paused/resumed stores, 86’d items, published menus, changed hours or settings — when, where, from where, and whether it worked.' },
};

export interface ReportFilter {
  from: string;
  to: string;
  locationCodes?: string[];
  channels?: ChannelKey[];
  brands?: string[];
  statuses?: OrderStatus[];
}

export interface ReportTable {
  key: ReportKey;
  title: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
  filename: string;
}

const tz = () => foodhubTimeZone();
function local(iso?: string | null): string {
  if (!iso) return '';
  const p = localParts(new Date(iso).getTime(), tz());
  const z = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${z(p.month)}-${z(p.day)} ${z(p.hour)}:${z(p.minute)}`;
}
const mins = (a?: string | null, b?: string | null) => (a && b ? Math.round((new Date(b).getTime() - new Date(a).getTime()) / 6000) / 10 : null);
const money = (n: number | undefined | null) => Math.round((Number(n) || 0) * 100) / 100;

async function ordersFor(f: ReportFilter): Promise<StoredOrder[]> {
  let orders = await getRepo().listOrders({ since: f.from, until: f.to, limit: 50_000, locationCodes: f.locationCodes?.length ? f.locationCodes : undefined, statuses: f.statuses });
  if (f.channels?.length) orders = orders.filter((o) => f.channels!.includes(o.channel));
  if (f.brands?.length) orders = orders.filter((o) => o.brandName && f.brands!.includes(o.brandName));
  return orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function buildReport(key: ReportKey, f: ReportFilter): Promise<ReportTable> {
  const catalog = await getCatalog();
  const locName = (code?: string | null) => (code ? catalog.locations.find((l) => l.code === code)?.name ?? code : 'Unmapped');
  const city = (code?: string | null) => (code ? catalog.locations.find((l) => l.code === code)?.city ?? '' : '');
  const day = local(f.from).slice(0, 10);
  const last = local(new Date(new Date(f.to).getTime() - 1).toISOString()).slice(0, 10);
  const filename = `takatak-${key.replace(/_/g, '-')}-${day}${last !== day ? `_to_${last}` : ''}`;
  const out = (columns: string[], rows: ReportTable['rows']): ReportTable => ({ key, title: REPORTS[key].title, columns, rows, filename });

  if (key === 'store_actions') {
    const entries = (await getRepo().listActivity({ since: f.from, until: f.to, limit: 50_000, locationCodes: f.locationCodes?.length ? f.locationCodes : undefined }))
      .filter((e) => e.kind !== 'login' && (!f.channels?.length || !e.channel || f.channels.includes(e.channel)) && (!f.brands?.length || !e.brandName || f.brands.includes(e.brandName)))
      .sort((a, b) => a.at.localeCompare(b.at));
    return out(['Time', 'User', 'Source', 'Area', 'Action', 'Platform', 'Brand', 'Location', 'Store id', 'Status', 'Details'],
      entries.map((e) => [local(e.at), e.actor, e.source, e.kind, e.action, e.channel ? CHANNEL_LABELS[e.channel] : '', e.brandName ?? '', e.locationCode ? locName(e.locationCode) : '', String((e.detail as Record<string, unknown> | undefined)?.channelStoreId ?? ''), e.status, e.summary]));
  }

  if (key === 'menu_snapshot') {
    const repo = getRepo();
    const [menus, stores] = await Promise.all([repo.listMenus(), repo.listStores()]);
    const rows: ReportTable['rows'] = [];
    for (const menu of menus) {
      if (f.brands?.length && !f.brands.includes(menu.brandName)) continue;
      const cats = new Map(menu.categories.map((c) => [c.ref, c.name]));
      for (const s of stores.filter((x) => x.brandName === menu.brandName && (!f.locationCodes?.length || f.locationCodes.includes(x.locationCode)) && (!f.channels?.length || f.channels.includes(x.channel)))) {
        const off = offRefsAt(menu, s.locationCode);
        for (const i of menu.items) {
          rows.push([menu.brandName, locName(s.locationCode), CHANNEL_LABELS[s.channel], s.channelStoreId, cats.get(i.categoryRef) ?? '', i.ref, i.name, i.available && !off.has(i.ref) ? 1 : 0, money(i.price), money(priceFor(i, CHANNEL_MARKETPLACE[s.channel])), i.posItemRef ?? '']);
        }
      }
    }
    return out(['Brand', 'Store', 'Platform', 'Platform store id', 'Category', 'Item id', 'Item', 'In stock', 'Base price', 'Platform price', 'Clover item id'], rows);
  }

  const orders = await ordersFor(f);

  if (key === 'order_transactions') {
    return out(
      ['Order id', 'Platform order id', 'Order number', 'Brand', 'Platform', 'Created', 'Placed', 'Status', 'Fulfilment', 'Ready by', 'Payment', 'Subtotal', 'Taxes', 'Delivery fee', 'Tip', 'Discount', 'Total', 'Customer', 'Store', 'Location code', 'Platform store id', 'City', 'Clover order id', 'Clover error', 'Platform message'],
      orders.map((o) => [o.id, o.externalOrderId, o.displayId ?? '', o.brandName ?? '', CHANNEL_LABELS[o.channel], local(o.createdAt), local(o.placedAt), o.status, o.fulfillment, local(o.readyBy ?? o.timeline?.readyTarget), 'Paid on platform',
        money(o.subtotal), money(o.tax), money(o.deliveryFee), money(o.tip), money(o.discount), money(o.total), o.customerName ?? '', locName(o.locationCode), o.locationCode ?? '', o.channelStoreId, city(o.locationCode), o.posOrderId ?? '', o.posError ?? '', o.channelError ?? '']),
    );
  }

  if (key === 'order_status_transitions') {
    return out(
      ['Order id', 'Platform order id', 'Brand', 'Platform', 'Store', 'Fulfilment', 'Created', 'Placed', 'Accepted', 'Accepted by', 'Ready', 'Handed to courier', 'Completed', 'Cancelled', 'Cancelled by', 'Cancel stage', 'Cancel reason', 'Minutes to accept', 'Minutes accept → ready', 'Minutes total', 'Status now'],
      orders.map((o) => {
        const t = o.timeline ?? {};
        const end = t.completedAt ?? t.cancelledAt ?? t.dispatchedAt;
        return [o.id, o.externalOrderId, o.brandName ?? '', CHANNEL_LABELS[o.channel], locName(o.locationCode), o.fulfillment, local(o.createdAt), local(o.placedAt), local(t.acceptedAt), t.acceptedBy ?? '', local(t.readyAt), local(t.dispatchedAt), local(t.completedAt), local(t.cancelledAt), t.cancelledBy ?? '', t.cancelStage?.replace('_', ' ') ?? '', t.cancelReason ?? '',
          mins(o.createdAt, t.acceptedAt), mins(t.acceptedAt, t.readyAt), mins(o.createdAt, end), o.status];
      }),
    );
  }

  if (key === 'item_wise') {
    const rows: ReportTable['rows'] = [];
    for (const o of orders) for (const l of o.lines) {
      const mods = l.modifiers.reduce((s, m) => s + m.unitPrice * (m.quantity || 1), 0);
      rows.push([o.id, o.externalOrderId, local(o.createdAt), o.brandName ?? '', CHANNEL_LABELS[o.channel], locName(o.locationCode), l.externalId ?? '', l.posItemRef ?? '', l.name, l.quantity, money(l.unitPrice), money(mods), money(l.total), l.modifiers.map((m) => m.name).join(', '), o.status]);
    }
    return out(['Order id', 'Platform order id', 'Date', 'Brand', 'Platform', 'Store', 'Item id', 'Clover item id', 'Item', 'Quantity', 'Unit price', 'Modifiers per unit', 'Line total', 'Modifiers', 'Order status'], rows);
  }

  if (key === 'option_wise') {
    const rows: ReportTable['rows'] = [];
    for (const o of orders) for (const l of o.lines) for (const m of l.modifiers) {
      rows.push([o.id, o.externalOrderId, local(o.createdAt), o.brandName ?? '', CHANNEL_LABELS[o.channel], locName(o.locationCode), l.name, m.externalId ?? '', m.name, (m.quantity || 1) * (l.quantity || 1), money(m.unitPrice), money(m.unitPrice * (m.quantity || 1) * (l.quantity || 1)), o.status]);
    }
    return out(['Order id', 'Platform order id', 'Date', 'Brand', 'Platform', 'Store', 'Item', 'Option id', 'Option', 'Quantity', 'Unit price', 'Total', 'Order status'], rows);
  }

  // items_summary
  const sum = new Map<string, { id: string; name: string; brand: string; qty: number; amount: number; orders: Set<string>; locations: Set<string>; lost: number }>();
  for (const o of orders) for (const l of o.lines) {
    const k = `${o.brandName ?? ''}|${l.externalId || l.name}`;
    const e = sum.get(k) ?? { id: l.externalId ?? '', name: l.name, brand: o.brandName ?? '', qty: 0, amount: 0, orders: new Set(), locations: new Set(), lost: 0 };
    if (o.status === 'cancelled') e.lost += l.quantity; else { e.qty += l.quantity; e.amount += l.total; e.orders.add(o.id); if (o.locationCode) e.locations.add(o.locationCode); }
    sum.set(k, e);
  }
  return out(['Brand', 'Item id', 'Item', 'Quantity sold', 'Revenue', 'Orders', 'Locations', 'Quantity in cancelled orders'],
    [...sum.values()].sort((a, b) => b.amount - a.amount).map((e) => [e.brand, e.id, e.name, e.qty, money(e.amount), e.orders.size, e.locations.size, e.lost]));
}

// ---------- file formats ----------

function cell(v: string | number | null): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) && typeof v === 'string' ? `'${s}` : s).replace(/"/g, '""')}"` : s;
}

/** UTF-8 CSV with BOM so Excel opens accents correctly. Formula-looking text is neutralised. */
export function toCsv(t: ReportTable): string {
  return '﻿' + [t.columns, ...t.rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
function colName(i: number): string { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; }

/** Minimal valid .xlsx (one sheet, bold header, numbers stay numbers). */
export function toXlsx(t: ReportTable): Uint8Array {
  const rows = [t.columns, ...t.rows].map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
    const ref = `${colName(ci)}${ri + 1}`;
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${ri === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(v === null || v === undefined ? '' : String(v))}</t></is></c>`;
  }).join('')}</row>`).join('');
  const sheetName = xml(t.title.slice(0, 31));
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
    'xl/styles.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>'),
    'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${rows}</sheetData></worksheet>`),
  };
  return zipSync(files, { level: 6 });
}

export function renderReport(t: ReportTable, format: 'csv' | 'xlsx'): { body: Uint8Array | string; contentType: string; filename: string } {
  return format === 'xlsx'
    ? { body: toXlsx(t), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: `${t.filename}.xlsx` }
    : { body: toCsv(t), contentType: 'text/csv; charset=utf-8', filename: `${t.filename}.csv` };
}

// ---------- email (Resend) ----------

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.REPORT_EMAIL_FROM);
}

export async function emailReport(t: ReportTable, to: string[], format: 'csv' | 'xlsx', note = ''): Promise<{ ok: boolean; message: string }> {
  if (!emailConfigured()) return { ok: false, message: 'Email is not set up: add RESEND_API_KEY and REPORT_EMAIL_FROM (npm run food-hub:setup).' };
  const file = renderReport(t, format);
  const content = Buffer.from(typeof file.body === 'string' ? file.body : file.body).toString('base64');
  try {
    const res = await fetch(`${(process.env.RESEND_BASE_URL || 'https://api.resend.com').replace(/\/+$/, '')}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.REPORT_EMAIL_FROM,
        to,
        subject: `TAKATAK — ${t.title}${note ? ` (${note})` : ''}`,
        text: `${t.title}${note ? ` — ${note}` : ''}\n${t.rows.length} row(s). The file is attached.\n\n${REPORTS[t.key].description}`,
        attachments: [{ filename: file.filename, content }],
      }),
    });
    if (!res.ok) return { ok: false, message: `Email provider returned HTTP ${res.status}` };
    return { ok: true, message: `Sent to ${to.join(', ')}` };
  } catch (error) {
    return { ok: false, message: `Email failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// ---------- schedules ----------

export interface ReportSchedule {
  id: string;
  report: ReportKey;
  frequency: 'daily' | 'weekly' | 'monthly';
  emails: string[];
  format: 'csv' | 'xlsx';
  filter: { locationCodes?: string[]; channels?: ChannelKey[]; brands?: string[] };
  createdBy: string;
  createdAt: string;
  lastPeriod?: string;
  lastSentAt?: string;
  lastError?: string | null;
}

const SCHED_KEY = 'report_schedules';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function listReportSchedules(): Promise<ReportSchedule[]> {
  return (await getRepo().getKv<ReportSchedule[]>(SCHED_KEY).catch(() => null)) ?? [];
}

export async function saveReportSchedule(input: Omit<ReportSchedule, 'id' | 'createdAt' | 'createdBy'> & { id?: string }, actor: Actor): Promise<ReportSchedule> {
  if (!(input.report in REPORTS)) throw new Error('Unknown report.');
  if (!['daily', 'weekly', 'monthly'].includes(input.frequency)) throw new Error('frequency must be daily, weekly or monthly.');
  const emails = input.emails.map((e) => e.trim()).filter(Boolean);
  if (!emails.length || emails.some((e) => !EMAIL.test(e))) throw new Error('Enter valid email address(es).');
  const all = await listReportSchedules();
  const existing = input.id ? all.find((s) => s.id === input.id) : undefined;
  const entry: ReportSchedule = { ...existing, ...input, emails, format: input.format === 'xlsx' ? 'xlsx' : 'csv', id: existing?.id ?? crypto.randomUUID(), createdAt: existing?.createdAt ?? new Date().toISOString(), createdBy: existing?.createdBy ?? actor.name };
  await getRepo().setKv(SCHED_KEY, [...all.filter((s) => s.id !== entry.id), entry]);
  await logActivity({ actor: actor.name, source: actor.source, kind: 'settings', action: 'report_schedule', status: 'success', summary: `${REPORTS[entry.report].title} scheduled ${entry.frequency} to ${emails.join(', ')}` });
  return entry;
}

export async function deleteReportSchedule(id: string, actor: Actor): Promise<boolean> {
  const all = await listReportSchedules();
  const e = all.find((s) => s.id === id);
  if (!e) return false;
  await getRepo().setKv(SCHED_KEY, all.filter((s) => s.id !== id));
  await logActivity({ actor: actor.name, source: actor.source, kind: 'settings', action: 'report_unschedule', status: 'info', summary: `${REPORTS[e.report].title} schedule removed` });
  return true;
}

/** The period a schedule covers when it is due today (null = not due today). Reports go out after 8:00 local. */
export function duePeriod(freq: ReportSchedule['frequency'], now = Date.now()): { key: string; from: string; to: string; label: string } | null {
  const zone = tz();
  const p = localParts(now, zone);
  if (p.hour < 8) return null;
  const today = startOfLocalDayMs(now, zone);
  const dayBefore = (ms: number) => startOfLocalDayMs(ms - 12 * 3600_000, zone);
  const iso = (ms: number) => new Date(ms).toISOString();
  const dateOf = (ms: number) => { const q = localParts(ms + 12 * 3600_000, zone); return `${q.year}-${String(q.month).padStart(2, '0')}-${String(q.day).padStart(2, '0')}`; };
  if (freq === 'daily') { const from = dayBefore(today); return { key: `d:${dateOf(from)}`, from: iso(from), to: iso(today), label: dateOf(from) }; }
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  if (freq === 'weekly') {
    if (dow !== 1) return null; // Mondays: previous Monday → Sunday
    let from = today; for (let i = 0; i < 7; i++) from = dayBefore(from);
    return { key: `w:${dateOf(from)}`, from: iso(from), to: iso(today), label: `week of ${dateOf(from)}` };
  }
  if (p.day !== 1) return null; // 1st of the month: previous month
  let from = dayBefore(today);
  while (localParts(from + 12 * 3600_000, zone).day !== 1) from = dayBefore(from);
  return { key: `m:${dateOf(from).slice(0, 7)}`, from: iso(from), to: iso(today), label: dateOf(from).slice(0, 7) };
}

/** Sends every schedule that is due and not yet sent for its period. Called by sync + cron. */
export async function sendDueReports(now = Date.now()): Promise<number> {
  const all = await listReportSchedules();
  if (!all.length) return 0;
  let sent = 0;
  let changed = false;
  for (const s of all) {
    const period = duePeriod(s.frequency, now);
    if (!period || s.lastPeriod === period.key) continue;
    // Claim the period first so a parallel run cannot send twice.
    s.lastPeriod = period.key; changed = true;
    await getRepo().setKv(SCHED_KEY, all);
    const table = await buildReport(s.report, { from: period.from, to: period.to, ...s.filter });
    const r = await emailReport(table, s.emails, s.format, period.label);
    s.lastSentAt = new Date().toISOString();
    s.lastError = r.ok ? null : r.message;
    if (r.ok) sent++;
    await logActivity({ actor: 'Scheduled task', source: 'schedule', kind: 'settings', action: 'report_email', status: r.ok ? 'success' : 'failed', summary: `${REPORTS[s.report].title} (${period.label}) → ${s.emails.join(', ')}: ${r.message}` });
  }
  if (changed) await getRepo().setKv(SCHED_KEY, all);
  return sent;
}
