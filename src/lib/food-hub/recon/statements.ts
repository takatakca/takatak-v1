// Platform statement import: CSV or Excel files exported from each platform's merchant portal
// (or downloaded by the Uber Eats Reporting API) → one normalized "payout line" per row.
//
// Known formats are recognized from their headers:
//   Uber Eats  Payment Details Report (help.uber.com: Workflow ID, Order ID, Order Status, Sales (excluding tax),
//              Tax on Sales, Marketplace fee, Tax on Marketplace fee, Total payout, Payout Date, Payout reference ID…)
//   DoorDash   Merchant Portal → Financials → transactions export (DoorDash order ID, Transaction type, Subtotal,
//              Subtotal tax passed to merchant, Commission, Commission tax, Error charges, Adjustments, Net total…)
// Anything else (SkipTheDishes statements, Too Good To Go, a bank export…) is imported with a column mapping
// the owner picks once per file shape — Food Hub remembers it.
import crypto from 'node:crypto';
import { strFromU8, unzipSync } from 'fflate';
import type { ChannelKey } from '../types';

export type LineKind = 'order' | 'refund' | 'adjustment' | 'error_charge' | 'promotion' | 'ads' | 'fee' | 'other';

export interface PayoutLine {
  id: string;
  importId: string;
  channel: ChannelKey;
  /** Order reference as printed on the statement (platform order id / workflow id / short code). */
  orderRef: string | null;
  /** Second reference when the statement has two (Uber: Order ID + Workflow ID). */
  orderRef2: string | null;
  storeRef: string | null;
  orderDate: string | null;
  payoutDate: string | null;
  payoutRef: string | null;
  kind: LineKind;
  description: string;
  sales: number;
  tax: number;
  commission: number;
  commissionTax: number;
  promotions: number;
  adjustments: number;
  otherFees: number;
  net: number;
  /** True when the statement gave a component breakdown (not only the net). */
  hasBreakdown: boolean;
  row: number;
}

export type FieldKey = 'orderRef' | 'orderRef2' | 'storeRef' | 'orderDate' | 'payoutDate' | 'payoutRef' | 'kind' | 'description'
  | 'sales' | 'tax' | 'commission' | 'commissionTax' | 'promotions' | 'adjustments' | 'otherFees' | 'net';

/** Column index (or several, summed) for each field. */
export type ColumnMapping = Partial<Record<FieldKey, number | number[]>>;

export const FIELD_LABELS: Record<FieldKey, string> = {
  orderRef: 'Order id / number', orderRef2: 'Second order id (optional)', storeRef: 'Store', orderDate: 'Order date', payoutDate: 'Payout date', payoutRef: 'Payout / statement id',
  kind: 'Type / status', description: 'Description', sales: 'Food sales (before tax)', tax: 'Tax on food', commission: 'Commission / platform fee', commissionTax: 'Tax on commission',
  promotions: 'Promotions you paid', adjustments: 'Adjustments / error charges', otherFees: 'Other fees (ads, tablet…)', net: 'Net payout (what you receive)',
};

// ---------------------------------------------------------------- file → table

export function decodeText(bytes: Uint8Array): string {
  let text = new TextDecoder('utf-8').decode(bytes);
  if (text.includes('�')) text = new TextDecoder('latin1').decode(bytes); // Excel "CSV" saved in Windows-1252
  return text.replace(/^﻿/, '');
}

export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delim = [',', ';', '\t'].map((d) => [d, (firstLine.match(new RegExp(d === '\t' ? '\t' : `\\${d}`, 'g')) ?? []).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

/** Minimal .xlsx reader: first worksheet, shared strings, inline strings and numbers. */
export function parseXlsx(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes);
  const shared: string[] = [];
  const ss = files['xl/sharedStrings.xml'] ? strFromU8(files['xl/sharedStrings.xml']) : '';
  for (const si of ss.match(/<si>[\s\S]*?<\/si>/g) ?? []) shared.push(xmlText(si));
  const sheetName = Object.keys(files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))[0];
  if (!sheetName) throw new Error('No worksheet found in the Excel file.');
  const xml = strFromU8(files[sheetName]);
  const rows: string[][] = [];
  for (const r of xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const out: string[] = [];
    for (const c of r.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
      const ref = c.match(/ r="([A-Z]+)\d+"/)?.[1];
      const col = ref ? colIndex(ref) : out.length;
      const type = c.match(/ t="([^"]+)"/)?.[1];
      let v = '';
      if (type === 'inlineStr') v = xmlText(c);
      else {
        const raw = c.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
        v = type === 's' ? shared[Number(raw)] ?? '' : unescapeXml(raw);
      }
      while (out.length < col) out.push('');
      out[col] = v.trim();
    }
    if (out.some((x) => x !== '')) rows.push(out);
  }
  return rows;
}

function colIndex(letters: string) { let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }
function unescapeXml(s: string) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }
function xmlText(fragment: string) { return unescapeXml((fragment.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join('')); }

export function readTable(fileName: string, bytes: Uint8Array): string[][] {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (/\.xlsx$/i.test(fileName) || isZip) return parseXlsx(bytes);
  if (/\.xls$/i.test(fileName)) throw new Error('Old .xls files are not supported — open it in Excel and save as .xlsx or .csv.');
  if (/\.pdf$/i.test(fileName)) throw new Error('PDF statements cannot be read — download the CSV or Excel version from the platform portal.');
  return parseCsv(decodeText(bytes));
}

/** Finds the header row: the first row with several non-numeric labels (portals sometimes add title lines). */
export function splitHeader(table: string[][]): { headers: string[]; rows: string[][]; headerRow: number } {
  const idx = table.findIndex((r) => r.filter((c) => c && !/^[-\d.,$()\s%]+$/.test(c)).length >= 3);
  const h = idx < 0 ? 0 : idx;
  return { headers: (table[h] ?? []).map((x) => x.trim()), rows: table.slice(h + 1), headerRow: h };
}

// ---------------------------------------------------------------- values

/** "$1,234.56", "(12.34)", "-5", "1 234,56 $", "12,50" → number (0 when empty). */
export function parseAmount(v: string | undefined | null): number {
  if (v === undefined || v === null) return 0;
  let s = String(v).trim();
  if (!s || s === '-' || /^n\/?a$/i.test(s)) return 0;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s);
  s = s.replace(/[()$€£\s CAD]/gi, '').replace(/^-|-$/g, '');
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');      // 1.234,56
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');                                     // 12,50
  else s = s.replace(/,/g, '');                                                                   // 1,234.56
  const n = Number(s);
  return Number.isFinite(n) ? Math.round((neg ? -n : n) * 100) / 100 : 0;
}

/** Dates as ISO (YYYY-MM-DD or full timestamp). Accepts ISO, M/D/YYYY, D/M/YYYY (when day > 12), Excel serials. */
export function parseDate(v: string | undefined | null): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (/^\d{5}(\.\d+)?$/.test(s)) { // Excel serial day number
    const ms = Math.round((Number(s) - 25569) * 86400_000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return m[4] ? `${m[1]}-${m[2]}-${m[3]}T${m[4].padStart(2, '0')}:${m[5]}:${m[6] ?? '00'}` : `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    let [a, b] = [Number(m[1]), Number(m[2])];
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    if (a > 12) [a, b] = [b, a]; // D/M/Y
    return `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
}

// ---------------------------------------------------------------- formats

export type FormatKey = 'uber_payment_details' | 'doordash_transactions' | 'generic';

const norm = (h: string) => h.toLowerCase().replace(/\s+/g, ' ').replace(/[’']/g, "'").trim();

function find(headers: string[], names: string[]): number | undefined {
  const H = headers.map(norm);
  for (const n of names) { const i = H.indexOf(norm(n)); if (i >= 0) return i; }
  return undefined;
}
function findAll(headers: string[], names: string[]): number[] {
  const H = headers.map(norm);
  return names.map((n) => H.indexOf(norm(n))).filter((i) => i >= 0);
}

export function detectFormat(headers: string[]): { format: FormatKey; channel: ChannelKey | null } {
  const H = new Set(headers.map(norm));
  if (H.has('workflow id') && (H.has('total payout') || H.has('marketplace fee'))) return { format: 'uber_payment_details', channel: 'uber_eats' };
  if ((H.has('doordash order id') || H.has('dd order id')) && (H.has('net total') || H.has('commission'))) return { format: 'doordash_transactions', channel: 'doordash' };
  return { format: 'generic', channel: null };
}

/** Column mapping for a known format (from the header names). */
export function knownMapping(format: FormatKey, headers: string[]): ColumnMapping {
  if (format === 'uber_payment_details') {
    return {
      orderRef: find(headers, ['Workflow ID']), orderRef2: find(headers, ['Order ID']), storeRef: find(headers, ['Store ID', 'Store Name']),
      orderDate: find(headers, ['Order Date']), payoutDate: find(headers, ['Payout Date']), payoutRef: find(headers, ['Payout reference ID']),
      kind: find(headers, ['Order Status']), description: find(headers, ['Other payments description']),
      sales: find(headers, ['Sales (excluding tax)', 'Sales (excl. tax)']),
      tax: find(headers, ['Tax on Sales']) ?? findAll(headers, ['GST/HST on Sales', 'QST on Sales', 'PST on Sales']),
      commission: findAll(headers, ['Marketplace fee', 'Delivery Network Fee', 'Order Processing Fee']),
      commissionTax: find(headers, ['Tax on Marketplace fee']) ?? findAll(headers, ['GST/HST on Marketplace fee', 'QST on Marketplace fee']),
      promotions: findAll(headers, ['Promotions on items', 'Tax on Promotions on items', 'Promotions on delivery', 'Tax on Promotions on delivery']),
      adjustments: findAll(headers, ['Price Adjustments (excluding tax)', 'Tax on Price Adjustments', 'Marketing adjustment']),
      otherFees: findAll(headers, ['Other payments']),
      net: find(headers, ['Total payout']),
    };
  }
  if (format === 'doordash_transactions') {
    return {
      orderRef: find(headers, ['DoorDash order ID', 'DD order ID']), orderRef2: find(headers, ['Merchant delivery ID', 'External ID', 'Order ID']),
      storeRef: find(headers, ['Merchant Store ID', 'Store ID', 'Store name']),
      orderDate: find(headers, ['Timestamp local date', 'Timestamp UTC date', 'Order date', 'Date']), payoutDate: find(headers, ['Payout date', 'Payout time']),
      payoutRef: find(headers, ['Payout ID']), kind: find(headers, ['Transaction type', 'Final order status']), description: find(headers, ['Description']),
      sales: find(headers, ['Subtotal', 'Pre-adjusted subtotal']), tax: findAll(headers, ['Subtotal tax passed to merchant', 'Subtotal tax passed by DoorDash to merchant']),
      commission: findAll(headers, ['Commission', 'Payment processing fee']), commissionTax: findAll(headers, ['Commission tax', 'Tax on commission']),
      promotions: findAll(headers, ['Marketing fees | (including any applicable taxes)', 'Marketing fees', 'Customer discounts from marketing | (funded by you)', 'Customer discounts from marketing (funded by you)']),
      adjustments: findAll(headers, ['Error charges', 'Adjustments']), otherFees: findAll(headers, ['Tablet fee', 'Ads fee']),
      net: find(headers, ['Net total', 'Net payout', 'Payout']),
    };
  }
  return {};
}

/** A best guess for an unknown file (owner confirms or changes it in the import screen). */
export function guessMapping(headers: string[]): ColumnMapping {
  const g = (names: string[]) => find(headers, names);
  return {
    orderRef: g(['Order ID', 'Order Number', 'Order #', 'Order No', 'Order No.', 'Order', 'Order Reference', 'Order Ref', 'Reference', 'Transaction ID', 'ID', 'Numéro de commande', 'No de commande', 'Commande']),
    orderDate: g(['Order Date', 'Date', 'Order Time', 'Created', 'Transaction Date', 'Date de commande']),
    payoutDate: g(['Payout Date', 'Deposit Date', 'Payment Date', 'Paid On']),
    payoutRef: g(['Payout ID', 'Statement ID', 'Deposit ID', 'Statement', 'Invoice']),
    kind: g(['Type', 'Transaction Type', 'Kind', 'Category', 'Status', 'Order Status']),
    description: g(['Description', 'Details', 'Memo', 'Notes', 'Note', 'Reason']),
    sales: g(['Subtotal', 'Food Sales', 'Sales', 'Gross Sales', 'Item Total', 'Order Subtotal']),
    tax: g(['Tax', 'Taxes', 'Sales Tax', 'GST/QST']),
    commission: g(['Commission', 'Fee', 'Fees', 'Service Fee', 'Platform Fee']),
    commissionTax: g(['Commission Tax', 'Tax on Commission', 'Tax on Fees']),
    adjustments: g(['Adjustment', 'Adjustments', 'Error Charges', 'Refund']),
    net: g(['Net Payout', 'Net', 'Net Total', 'Total Payout', 'Payout', 'Payout Amount', 'Amount Paid', 'Total Paid', 'Paid', 'Amount', 'Net Amount', 'Earnings', 'Montant net', 'Montant versé', 'Montant']),
  };
}

function pick(row: string[], m: number | number[] | undefined): string {
  if (m === undefined) return '';
  return Array.isArray(m) ? (m.length ? row[m[0]] ?? '' : '') : row[m] ?? '';
}
function sum(row: string[], m: number | number[] | undefined): number {
  if (m === undefined) return 0;
  const idx = Array.isArray(m) ? m : [m];
  return Math.round(idx.reduce((s, i) => s + parseAmount(row[i]), 0) * 100) / 100;
}
const has = (m: number | number[] | undefined) => m !== undefined && (!Array.isArray(m) || m.length > 0);

export function classify(kindText: string, description: string, net: number, hasOrder: boolean): LineKind {
  const t = `${kindText} ${description}`.toLowerCase();
  if (/error/.test(t)) return 'error_charge';
  if (/refund|cancel/.test(t) && net <= 0) return 'refund';
  if (/adjust|correction|missing|incorrect/.test(t)) return 'adjustment';
  if (/promo|discount|offer|marketing/.test(t) && !hasOrder) return 'promotion';
  if (/\bads?\b|advert|sponsor/.test(t)) return 'ads';
  if (/tablet|subscription|fee/.test(t) && !hasOrder) return 'fee';
  if (/payout|transfer|deposit|summary|total/.test(t) && !hasOrder) return 'other';
  if (hasOrder) return net < 0 ? 'refund' : 'order';
  return 'other';
}

export interface ParsedStatement {
  format: FormatKey;
  channel: ChannelKey | null;
  headers: string[];
  mapping: ColumnMapping;
  lines: Omit<PayoutLine, 'id' | 'importId' | 'channel'>[];
  skipped: number;
  /** First data rows, for the column-mapping screen. */
  sample: string[][];
}

/** Applies a mapping to every row. Rows without any amount are skipped (blank/summary lines). */
export function toLines(headers: string[], rows: string[][], mapping: ColumnMapping, format: FormatKey): ParsedStatement['lines'] {
  const out: ParsedStatement['lines'] = [];
  rows.forEach((row, i) => {
    const orderRef = pick(row, mapping.orderRef) || null;
    const orderRef2 = pick(row, mapping.orderRef2) || null;
    const comp = {
      sales: sum(row, mapping.sales), tax: sum(row, mapping.tax),
      // Statements show fees as negatives (DoorDash, Uber) or positives (some exports) → store them as positive costs.
      commission: Math.abs(sum(row, mapping.commission)), commissionTax: Math.abs(sum(row, mapping.commissionTax)),
      promotions: sum(row, mapping.promotions), adjustments: sum(row, mapping.adjustments), otherFees: sum(row, mapping.otherFees),
    };
    const hasBreakdown = [mapping.sales, mapping.commission].some(has);
    const net = has(mapping.net)
      ? sum(row, mapping.net)
      : Math.round((comp.sales + comp.tax - comp.commission - comp.commissionTax + comp.promotions + comp.adjustments + comp.otherFees) * 100) / 100;
    if (!net && !comp.sales && !comp.commission && !comp.adjustments) return;
    const kindText = pick(row, mapping.kind);
    const description = pick(row, mapping.description);
    if (format === 'generic' && /^(total|totals|sum|subtotal)$/i.test(String(orderRef ?? kindText).trim())) return;
    out.push({
      orderRef, orderRef2,
      storeRef: pick(row, mapping.storeRef) || null,
      orderDate: parseDate(pick(row, mapping.orderDate)),
      payoutDate: parseDate(pick(row, mapping.payoutDate)),
      payoutRef: pick(row, mapping.payoutRef) || null,
      kind: classify(kindText, description, net, Boolean(orderRef || orderRef2)),
      description: [kindText, description].filter(Boolean).join(' — ').slice(0, 200),
      ...comp, net, hasBreakdown, row: i + 1,
    });
  });
  return out;
}

export function parseStatement(fileName: string, bytes: Uint8Array, opts: { mapping?: ColumnMapping; channel?: ChannelKey | null } = {}): ParsedStatement {
  const table = readTable(fileName, bytes);
  if (table.length < 2) throw new Error('The file has no data rows.');
  const { headers, rows } = splitHeader(table);
  const det = detectFormat(headers);
  const mapping = opts.mapping && Object.keys(opts.mapping).length ? opts.mapping : det.format === 'generic' ? guessMapping(headers) : knownMapping(det.format, headers);
  const lines = toLines(headers, rows, mapping, det.format);
  return { format: det.format, channel: opts.channel ?? det.channel, headers, mapping, lines, skipped: rows.length - lines.length, sample: rows.slice(0, 5) };
}

/** Stable id: the same statement row imported twice (or in two overlapping files) is stored once. */
export function lineId(channel: ChannelKey, l: Pick<PayoutLine, 'orderRef' | 'orderRef2' | 'kind' | 'net' | 'orderDate' | 'payoutRef' | 'description'>, occurrence: number) {
  const key = [channel, l.orderRef ?? '', l.orderRef2 ?? '', l.kind, l.net.toFixed(2), l.orderDate ?? '', l.payoutRef ?? '', l.orderRef || l.orderRef2 ? '' : l.description, occurrence].join('|');
  return crypto.createHash('sha1').update(key).digest('hex').slice(0, 24);
}

/** Header signature to remember a mapping for files of the same shape. */
export function headerSignature(headers: string[]) {
  return crypto.createHash('sha1').update(headers.map(norm).join('|')).digest('hex').slice(0, 16);
}
