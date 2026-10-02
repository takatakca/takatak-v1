// Reconciliation engine — "where is my money?"
//   orders (what customers paid, from the platforms' own webhooks)
//   × fee plans (what each platform should keep)
//   × payout lines (what each platform actually paid, from statements)
// → per order: matched / short-paid / over-paid / refunded / error charge / missing from payout / pending
// → per statement line: lines for orders Food Hub never received (missed webhooks or unconnected stores)
// → per payout: statement total vs bank deposit
// → dispute cases (open → disputed → recovered / written off), opened and closed automatically.
import crypto from 'node:crypto';
import { logActivity, type Actor } from '../activity';
import { CHANNEL_LABELS, nowIso } from '../config';
import { localDate } from '../hours';
import { getRepo, type Doc } from '../repo';
import type { ChannelKey, StoredOrder } from '../types';
import { expectedPayout, getFees, planFor, type Expected, type FeeConfig } from './fees';
import { headerSignature, lineId, parseStatement, type ColumnMapping, type FormatKey, type PayoutLine } from './statements';

export const COL = { imports: 'payout_imports', lines: 'payout_lines', cases: 'recon_cases', deposits: 'payout_deposits', mappings: 'statement_mappings', approvals: 'ledger_approvals' } as const;
const DAY = 86400_000;
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface StatementImport {
  id: string;
  channel: ChannelKey;
  fileName: string;
  format: FormatKey;
  rows: number;
  lines: number;
  newLines: number;
  skipped: number;
  totalNet: number;
  periodFrom: string | null;
  periodTo: string | null;
  importedBy: string;
  importedAt: string;
  source: 'upload' | 'uber_reporting_api';
}

// ---------------------------------------------------------------- import

export type ImportOutcome =
  | { ok: true; import: StatementImport }
  | { ok: false; needsMapping: true; headers: string[]; sample: string[][]; mapping: ColumnMapping; format: FormatKey; channel: ChannelKey | null; message: string };

export async function importStatement(input: { fileName: string; bytes: Uint8Array; channel?: ChannelKey | null; mapping?: ColumnMapping; actor: Actor; source?: StatementImport['source'] }): Promise<ImportOutcome> {
  const repo = getRepo();
  // A mapping the owner confirmed for this file shape is reused automatically.
  let mapping = input.mapping;
  let parsed = parseStatement(input.fileName, input.bytes, { mapping, channel: input.channel });
  const sig = headerSignature(parsed.headers);
  if (!mapping && parsed.format === 'generic') {
    const saved = await repo.getDoc<{ mapping: ColumnMapping; channel: ChannelKey }>(COL.mappings, sig);
    if (saved) { mapping = saved.data.mapping; parsed = parseStatement(input.fileName, input.bytes, { mapping, channel: input.channel ?? saved.data.channel }); }
  }
  const channel = parsed.channel;
  const orderCol = parsed.mapping.orderRef;
  const netOk = parsed.mapping.net !== undefined || parsed.mapping.sales !== undefined;
  if (parsed.format === 'generic' && (!mapping || !channel || orderCol === undefined || !netOk)) {
    return {
      ok: false, needsMapping: true, headers: parsed.headers, mapping: parsed.mapping, format: parsed.format, channel,
      sample: parsed.sample, message: !channel ? 'Which platform is this statement from? Then confirm the columns.' : 'Confirm which column is the order number and which is the net payout.',
    };
  }
  if (!channel) throw new Error('Choose the platform for this statement.');
  if (parsed.format === 'generic') await repo.putDocs(COL.mappings, [{ id: sig, at: nowIso(), data: { mapping: parsed.mapping, channel } }]);

  const importId = crypto.randomUUID();
  const occurrences = new Map<string, number>();
  const lines: PayoutLine[] = parsed.lines.map((l) => {
    const base = lineId(channel, l, 0);
    const n = occurrences.get(base) ?? 0;
    occurrences.set(base, n + 1);
    return { ...l, id: n ? lineId(channel, l, n) : base, importId, channel };
  });
  const existing = new Set((await repo.listDocs<PayoutLine>(COL.lines, {})).map((d) => d.id));
  const fresh = lines.filter((l) => !existing.has(l.id));
  await repo.putDocs(COL.lines, fresh.map((l) => ({ id: l.id, key: refKey(l.orderRef) ?? refKey(l.orderRef2), at: lineAt(l), data: l })));
  const dates = lines.map((l) => l.orderDate ?? l.payoutDate).filter(Boolean).sort() as string[];
  const record: StatementImport = {
    id: importId, channel, fileName: input.fileName.slice(0, 120), format: parsed.format, rows: parsed.lines.length + parsed.skipped, lines: lines.length, newLines: fresh.length,
    skipped: parsed.skipped, totalNet: r2(lines.reduce((s, l) => s + l.net, 0)), periodFrom: dates[0]?.slice(0, 10) ?? null, periodTo: dates[dates.length - 1]?.slice(0, 10) ?? null,
    importedBy: input.actor.name, importedAt: nowIso(), source: input.source ?? 'upload',
  };
  await repo.putDocs(COL.imports, [{ id: importId, at: record.importedAt, key: channel, data: record }]);
  await logActivity({ actor: input.actor.name, source: input.actor.source, kind: 'settings', action: 'statement_import', status: 'success', channel,
    summary: `${CHANNEL_LABELS[channel]} statement imported: ${record.fileName} — ${record.lines} line(s), ${record.newLines} new, ${record.totalNet.toFixed(2)} $ net${record.periodFrom ? ` (${record.periodFrom} → ${record.periodTo})` : ''}` });
  return { ok: true, import: record };
}

export async function deleteImport(id: string, actor: Actor): Promise<boolean> {
  const repo = getRepo();
  const imp = await repo.getDoc<StatementImport>(COL.imports, id);
  if (!imp) return false;
  const lines = (await repo.listDocs<PayoutLine>(COL.lines, {})).filter((d) => d.data.importId === id);
  await repo.deleteDocs(COL.lines, lines.map((d) => d.id));
  await repo.deleteDocs(COL.imports, [id]);
  await logActivity({ actor: actor.name, source: actor.source, kind: 'settings', action: 'statement_deleted', status: 'success', channel: imp.data.channel, summary: `Statement removed: ${imp.data.fileName} (${lines.length} line(s))` });
  return true;
}

export function refKey(ref: string | null | undefined): string | null {
  const s = String(ref ?? '').trim().toLowerCase().replace(/^#/, '');
  return s ? s : null;
}
function lineAt(l: Pick<PayoutLine, 'orderDate' | 'payoutDate'>) {
  const d = l.orderDate ?? l.payoutDate;
  return d ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toISOString() : nowIso();
}

// ---------------------------------------------------------------- reconcile

export type ReconStatus = 'matched' | 'short_paid' | 'over_paid' | 'refunded' | 'error_charge' | 'missing' | 'pending' | 'cancelled' | 'not_covered';

export const STATUS_LABEL: Record<ReconStatus, string> = {
  matched: 'Paid as expected', short_paid: 'Paid less than expected', over_paid: 'Paid more than expected', refunded: 'Refunded / charged back',
  error_charge: 'Error charge', missing: 'Missing from payout', pending: 'Payout not due yet', cancelled: 'Cancelled — nothing due', not_covered: 'No statement imported yet',
};

export interface OrderRecon {
  orderId: string;
  channel: ChannelKey;
  ref: string;
  displayId: string;
  brandName: string | null;
  locationCode: string | null;
  storeId: string | null;
  date: string;
  fulfillment: string;
  orderStatus: string;
  total: number;
  expected: Expected;
  actual: number | null;
  diff: number | null;
  status: ReconStatus;
  lines: number;
  payoutDate: string | null;
  refunds: number;
  errorCharges: number;
  adjustments: number;
  planConfirmed: boolean;
  /** Dispute case for this order, when one exists (owner decisions: recovered / written off / ignored). */
  caseStatus: CaseStatus | null;
}

export interface UnmatchedLine { id: string; channel: ChannelKey; ref: string | null; kind: string; description: string; orderDate: string | null; payoutDate: string | null; net: number }

export interface ChannelSummary {
  channel: ChannelKey;
  label: string;
  orders: number;
  sales: number;
  expected: number;
  paid: number;
  diff: number;
  missingMoney: number;
  counts: Record<ReconStatus, number>;
  otherCharges: number;
  unknownOrders: number;
  coveredUntil: string | null;
  planConfirmed: boolean;
}

export interface ReconResult {
  range: { from: string; to: string };
  generatedAt: string;
  orders: OrderRecon[];
  unmatched: UnmatchedLine[];
  other: UnmatchedLine[];
  channels: ChannelSummary[];
  totals: { orders: number; expected: number; paid: number; diff: number; missingMoney: number; unknownOrders: number; otherCharges: number };
  imports: number;
}

/** Days covered by each platform's imported statements (an order is only "missing" inside a covered period). */
async function coverage(): Promise<Record<string, Array<[string, string]>>> {
  const out: Record<string, Array<[string, string]>> = {};
  for (const d of await getRepo().listDocs<StatementImport>(COL.imports, {})) {
    const i = d.data;
    if (i.periodFrom && i.periodTo) (out[i.channel] ??= []).push([i.periodFrom, i.periodTo]);
  }
  return out;
}

export async function reconcile(q: { from: string; to: string; channels?: ChannelKey[]; locationCodes?: string[]; now?: number }): Promise<ReconResult> {
  const repo = getRepo();
  const now = q.now ?? Date.now();
  const fromMs = Date.parse(q.from); const toMs = Date.parse(q.to);
  const [fees, orders, wide, lineDocs, cover, stores, caseDocs] = await Promise.all([
    getFees(),
    repo.listOrders({ since: q.from, until: q.to, limit: 50_000, locationCodes: q.locationCodes }),
    repo.listOrders({ since: new Date(fromMs - 60 * DAY).toISOString(), until: new Date(toMs + 30 * DAY).toISOString(), limit: 100_000 }),
    repo.listDocs<PayoutLine>(COL.lines, { since: new Date(fromMs - 60 * DAY).toISOString(), until: new Date(toMs + 120 * DAY).toISOString() }),
    coverage(),
    repo.listStores(),
    repo.listDocs<ReconCase>(COL.cases, {}),
  ]);
  const caseStatus = new Map(caseDocs.map((d) => [d.id, d.data.status]));
  const inScope = (ch: ChannelKey) => !q.channels?.length || q.channels.includes(ch);
  const lines = lineDocs.map((d) => d.data).filter((l) => inScope(l.channel));
  const storeIdOf = new Map(stores.map((s) => [`${s.channel}|${s.channelStoreId}`, s.id]));

  // index statement lines by every reference they carry
  const byRef = new Map<string, PayoutLine[]>();
  for (const l of lines) for (const k of [refKey(l.orderRef), refKey(l.orderRef2)]) if (k) {
    const key = `${l.channel}|${k}`;
    byRef.set(key, [...(byRef.get(key) ?? []), l]);
  }
  const used = new Set<string>();
  const linesFor = (o: StoredOrder) => {
    const keys = [refKey(o.externalOrderId), refKey(o.displayId)].filter(Boolean).map((k) => `${o.channel}|${k}`);
    const found = new Map<string, PayoutLine>();
    for (const k of keys) for (const l of byRef.get(k) ?? []) found.set(l.id, l);
    return [...found.values()];
  };
  const covered = (ch: ChannelKey, date: string) => (cover[ch] ?? []).some(([a, b]) => date >= a && date <= b);

  const rows: OrderRecon[] = [];
  for (const o of orders.filter((x) => inScope(x.channel) && x.status !== 'new')) {
    const storeId = storeIdOf.get(`${o.channel}|${o.channelStoreId}`) ?? null;
    const plan = planFor(fees, o.channel, storeId);
    const exp = expectedPayout(o, plan);
    const ls = linesFor(o);
    ls.forEach((l) => used.add(l.id));
    const date = localDate(Date.parse(o.createdAt));
    const actual = ls.length ? r2(ls.reduce((s, l) => s + l.net, 0)) : null;
    const refunds = r2(ls.filter((l) => l.kind === 'refund').reduce((s, l) => s + Math.min(0, l.net), 0));
    const errorCharges = r2(ls.reduce((s, l) => s + (l.kind === 'error_charge' ? Math.min(0, l.net) : 0), 0));
    const adjustments = r2(ls.reduce((s, l) => s + l.adjustments, 0));
    const diff = actual === null ? null : r2(actual - exp.net);
    let status: ReconStatus;
    if (actual === null) {
      if (o.status === 'cancelled') status = 'cancelled';
      else if (now - Date.parse(o.createdAt) < plan.payoutLagDays * DAY) status = 'pending';
      else status = covered(o.channel, date) ? 'missing' : 'not_covered';
    } else if (Math.abs(diff!) <= fees.tolerance) status = o.status === 'cancelled' && actual === 0 ? 'cancelled' : 'matched';
    else if (refunds < 0 && diff! < 0) status = 'refunded';
    else if ((errorCharges < 0 || adjustments < 0) && diff! < 0) status = 'error_charge';
    else status = diff! < 0 ? 'short_paid' : 'over_paid';
    rows.push({
      orderId: o.id, channel: o.channel, ref: o.externalOrderId, displayId: o.displayId || o.externalOrderId.slice(0, 8), brandName: o.brandName ?? null, locationCode: o.locationCode ?? null, storeId,
      date: o.createdAt, fulfillment: o.fulfillment, orderStatus: o.status, total: o.total, expected: exp, actual, diff, status, lines: ls.length,
      payoutDate: ls.map((l) => l.payoutDate).filter(Boolean).sort().pop() ?? null, refunds, errorCharges, adjustments, planConfirmed: fees.confirmed[o.channel],
      caseStatus: caseStatus.get(`${o.channel}:${o.externalOrderId}`) ?? null,
    });
  }

  // statement lines that belong to no order in range: known order outside range → ignore; unknown → flag
  const wideKeys = new Set(wide.flatMap((o) => [refKey(o.externalOrderId), refKey(o.displayId)].filter(Boolean).map((k) => `${o.channel}|${k}`)));
  const fromD = localDate(fromMs); const toD = localDate(toMs - 1);
  const inRange = (l: PayoutLine) => { const d = (l.orderDate ?? l.payoutDate)?.slice(0, 10); return !d || (d >= fromD && d <= toD); };
  const unmatched: UnmatchedLine[] = []; const other: UnmatchedLine[] = [];
  for (const l of lines) {
    if (used.has(l.id) || !inRange(l)) continue;
    const keys = [refKey(l.orderRef), refKey(l.orderRef2)].filter(Boolean).map((k) => `${l.channel}|${k}`);
    const view = { id: l.id, channel: l.channel, ref: l.orderRef ?? l.orderRef2, kind: l.kind, description: l.description, orderDate: l.orderDate, payoutDate: l.payoutDate, net: l.net };
    if (!keys.length) other.push(view);
    else if (!keys.some((k) => wideKeys.has(k)) && (l.kind === 'order' || l.kind === 'refund' || l.kind === 'adjustment' || l.kind === 'error_charge')) unmatched.push(view);
  }

  const channels: ChannelSummary[] = (Object.keys(CHANNEL_LABELS) as ChannelKey[]).filter(inScope).map((ch) => {
    const rs = rows.filter((r) => r.channel === ch);
    const counts = Object.fromEntries((Object.keys(STATUS_LABEL) as ReconStatus[]).map((s) => [s, rs.filter((r) => r.status === s).length])) as Record<ReconStatus, number>;
    const paid = r2(rs.reduce((s, r) => s + (r.actual ?? 0), 0));
    const expected = r2(rs.filter((r) => r.actual !== null).reduce((s, r) => s + r.expected.net, 0));
    return {
      channel: ch, label: CHANNEL_LABELS[ch], orders: rs.length, sales: r2(rs.reduce((s, r) => s + r.total, 0)), expected, paid, diff: r2(paid - expected),
      // Money still to chase: problems the owner has not already recovered, written off or ignored.
      missingMoney: r2(rs.reduce((s, r) => s + (r.caseStatus && OWNER_CLOSED.includes(r.caseStatus) ? 0 : missingAmount(r)), 0)), counts,
      otherCharges: r2(other.filter((l) => l.channel === ch).reduce((s, l) => s + l.net, 0)),
      unknownOrders: unmatched.filter((l) => l.channel === ch).length,
      coveredUntil: (cover[ch] ?? []).map(([, b]) => b).sort().pop() ?? null,
      planConfirmed: fees.confirmed[ch],
    };
  });
  return {
    range: { from: q.from, to: q.to }, generatedAt: nowIso(), orders: rows, unmatched, other, channels,
    totals: {
      orders: rows.length, expected: r2(channels.reduce((s, c) => s + c.expected, 0)), paid: r2(channels.reduce((s, c) => s + c.paid, 0)), diff: r2(channels.reduce((s, c) => s + c.diff, 0)),
      missingMoney: r2(channels.reduce((s, c) => s + c.missingMoney, 0)), unknownOrders: unmatched.length, otherCharges: r2(other.reduce((s, l) => s + l.net, 0)),
    },
    imports: Object.values(cover).reduce((s, v) => s + v.length, 0),
  };
}

/** Money the restaurant should chase for one order (always ≥ 0). */
export function missingAmount(r: Pick<OrderRecon, 'status' | 'diff' | 'expected'>): number {
  if (r.status === 'missing') return r2(r.expected.net);
  if (['short_paid', 'error_charge', 'refunded'].includes(r.status) && r.diff !== null && r.diff < 0) return r2(-r.diff);
  return 0;
}

// ---------------------------------------------------------------- dispute cases

export type CaseStatus = 'open' | 'disputed' | 'recovered' | 'written_off' | 'resolved' | 'ignored';
export type CaseType = 'short_paid' | 'missing' | 'error_charge' | 'refunded' | 'unknown_order' | 'deposit_gap';

export interface ReconCase {
  id: string;
  type: CaseType;
  channel: ChannelKey;
  ref: string;
  orderId: string | null;
  brandName: string | null;
  locationCode: string | null;
  orderDate: string | null;
  amount: number;
  status: CaseStatus;
  platformCaseId?: string;
  recoveredAmount?: number;
  notes: Array<{ at: string; by: string; text: string }>;
  openedAt: string;
  updatedAt: string;
  autoClosed?: boolean;
}

/** Case types that are money the platform owes you (an unknown order is a data gap, not a loss). */
export const RECOVERABLE: CaseType[] = ['short_paid', 'missing', 'error_charge', 'refunded'];
const OWNER_CLOSED: CaseStatus[] = ['recovered', 'written_off', 'ignored'];

export const CASE_LABEL: Record<CaseType, string> = {
  short_paid: 'Paid less than expected', missing: 'Order missing from payout', error_charge: 'Error charge', refunded: 'Refund / chargeback',
  unknown_order: 'Paid order not in Food Hub', deposit_gap: 'Bank deposit differs from statement',
};

const MIN_CASE = 1; // $ — smaller differences are rounding / small fees, not worth a dispute

/** Opens cases for new problems and closes the ones a later statement fixed. Owner decisions are never overwritten. */
export async function syncCases(result: ReconResult, actor: Actor = { username: 'system', name: 'TAKATAK automation', source: 'automation' }): Promise<{ opened: number; closed: number }> {
  const repo = getRepo();
  const existing = new Map((await repo.listDocs<ReconCase>(COL.cases, {})).map((d) => [d.id, d.data]));
  const now = nowIso();
  const want = new Map<string, Omit<ReconCase, 'status' | 'notes' | 'openedAt' | 'updatedAt'>>();
  for (const r of result.orders) {
    const amount = missingAmount(r);
    if (amount < MIN_CASE) continue;
    const type: CaseType = r.status === 'missing' ? 'missing' : r.status === 'error_charge' ? 'error_charge' : r.status === 'refunded' ? 'refunded' : 'short_paid';
    const id = `${r.channel}:${r.ref}`;
    want.set(id, { id, type, channel: r.channel, ref: r.displayId, orderId: r.orderId, brandName: r.brandName, locationCode: r.locationCode, orderDate: localDate(Date.parse(r.date)), amount });
  }
  for (const l of result.unmatched) {
    if (Math.abs(l.net) < MIN_CASE) continue;
    const id = `${l.channel}:unknown:${l.ref}`;
    want.set(id, { id, type: 'unknown_order', channel: l.channel, ref: String(l.ref), orderId: null, brandName: null, locationCode: null, orderDate: l.orderDate, amount: r2(Math.abs(l.net)) });
  }
  const writes: Doc<ReconCase>[] = []; let opened = 0; let closed = 0;
  for (const [id, w] of want) {
    const cur = existing.get(id);
    if (!cur) {
      opened++;
      writes.push({ id, key: w.channel, at: now, data: { ...w, status: 'open', notes: [{ at: now, by: actor.name, text: `Opened automatically: ${CASE_LABEL[w.type]} (${w.amount.toFixed(2)} $)` }], openedAt: now, updatedAt: now } });
    } else if ((cur.status === 'open' || cur.status === 'disputed') && (cur.amount !== w.amount || cur.type !== w.type)) {
      writes.push({ id, key: w.channel, at: cur.openedAt, data: { ...cur, ...w, status: cur.status, updatedAt: now, notes: [...cur.notes, { at: now, by: actor.name, text: `Amount now ${w.amount.toFixed(2)} $ (${CASE_LABEL[w.type]})` }] } });
    }
  }
  // Problems that disappeared (a later statement paid the order) → resolved automatically.
  const rangeFrom = localDate(Date.parse(result.range.from)); const rangeTo = localDate(Date.parse(result.range.to) - 1);
  for (const [id, cur] of existing) {
    if (want.has(id) || !(cur.status === 'open' || cur.status === 'disputed') || cur.type === 'deposit_gap') continue;
    if (!cur.orderDate || cur.orderDate < rangeFrom || cur.orderDate > rangeTo) continue;
    if (result.channels.every((c) => c.channel !== cur.channel)) continue;
    closed++;
    writes.push({ id, key: cur.channel, at: cur.openedAt, data: { ...cur, status: 'resolved', autoClosed: true, updatedAt: now, notes: [...cur.notes, { at: now, by: actor.name, text: 'Closed automatically: the latest statements now match.' }] } });
  }
  if (writes.length) await repo.putDocs(COL.cases, writes);
  if (opened || closed) {
    await logActivity({ actor: actor.name, source: actor.source, kind: 'settings', action: 'recon_cases', status: 'info', summary: `Reconciliation: ${opened} new case(s) to check, ${closed} closed by later payouts` });
  }
  return { opened, closed };
}

export async function listCases(filter: { status?: CaseStatus[]; channels?: ChannelKey[] } = {}): Promise<ReconCase[]> {
  const all = (await getRepo().listDocs<ReconCase>(COL.cases, {})).map((d) => d.data);
  return all.filter((c) => (!filter.status?.length || filter.status.includes(c.status)) && (!filter.channels?.length || filter.channels.includes(c.channel)))
    .sort((a, b) => (a.status === b.status ? b.amount - a.amount : ['open', 'disputed'].indexOf(a.status) === -1 ? 1 : -1));
}

export async function updateCase(id: string, patch: { status?: CaseStatus; note?: string; platformCaseId?: string; recoveredAmount?: number }, actor: Actor): Promise<ReconCase | null> {
  const repo = getRepo();
  const doc = await repo.getDoc<ReconCase>(COL.cases, id);
  if (!doc) return null;
  const now = nowIso();
  const c = doc.data;
  const text = [
    patch.status && patch.status !== c.status ? `Status: ${c.status} → ${patch.status}` : '',
    patch.platformCaseId ? `Platform case #${patch.platformCaseId}` : '',
    patch.recoveredAmount !== undefined ? `Recovered ${Number(patch.recoveredAmount).toFixed(2)} $` : '',
    patch.note?.trim() ?? '',
  ].filter(Boolean).join(' · ');
  const next: ReconCase = {
    ...c,
    status: patch.status ?? c.status,
    platformCaseId: patch.platformCaseId ?? c.platformCaseId,
    recoveredAmount: patch.recoveredAmount !== undefined ? r2(Number(patch.recoveredAmount)) : c.recoveredAmount,
    updatedAt: now,
    notes: text ? [...c.notes, { at: now, by: actor.name, text }] : c.notes,
  };
  await repo.putDocs(COL.cases, [{ id, key: c.channel, at: c.openedAt, data: next }]);
  await logActivity({ actor: actor.name, source: actor.source, kind: 'settings', action: 'recon_case_update', status: 'success', channel: c.channel, summary: `${CASE_LABEL[c.type]} ${CHANNEL_LABELS[c.channel]} #${c.ref}: ${text || 'updated'}` });
  return next;
}

// ---------------------------------------------------------------- payouts & deposits

export interface PayoutBatch {
  key: string;
  channel: ChannelKey;
  payoutRef: string | null;
  payoutDate: string | null;
  lines: number;
  orders: number;
  sales: number;
  tax: number;
  commission: number;
  commissionTax: number;
  promotions: number;
  adjustments: number;
  otherFees: number;
  refunds: number;
  net: number;
  hasBreakdown: boolean;
  deposit: { amount: number; date: string; note?: string; by: string } | null;
  gap: number | null;
}

export async function payoutBatches(q: { from: string; to: string; channels?: ChannelKey[] }): Promise<PayoutBatch[]> {
  const repo = getRepo();
  const fromD = localDate(Date.parse(q.from)); const toD = localDate(Date.parse(q.to) - 1);
  const lines = (await repo.listDocs<PayoutLine>(COL.lines, {})).map((d) => d.data)
    .filter((l) => (!q.channels?.length || q.channels.includes(l.channel)))
    .filter((l) => { const d = (l.payoutDate ?? l.orderDate ?? '').slice(0, 10); return d >= fromD && d <= toD; });
  const deposits = new Map((await repo.listDocs<PayoutBatch['deposit'] & { key: string }>(COL.deposits, {})).map((d) => [d.id, d.data]));
  const groups = new Map<string, PayoutLine[]>();
  for (const l of lines) {
    const key = `${l.channel}|${l.payoutRef || l.payoutDate?.slice(0, 10) || `week-${weekOf(l.orderDate)}`}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  return [...groups.entries()].map(([key, ls]) => {
    const s = (f: keyof PayoutLine) => r2(ls.reduce((a, l) => a + (Number(l[f]) || 0), 0));
    const net = s('net');
    const dep = deposits.get(key) ?? null;
    return {
      key, channel: ls[0].channel, payoutRef: ls[0].payoutRef, payoutDate: ls.map((l) => l.payoutDate).filter(Boolean).sort().pop()?.slice(0, 10) ?? null,
      lines: ls.length, orders: new Set(ls.map((l) => l.orderRef ?? l.orderRef2).filter(Boolean)).size,
      sales: s('sales'), tax: s('tax'), commission: s('commission'), commissionTax: s('commissionTax'), promotions: s('promotions'), adjustments: s('adjustments'), otherFees: s('otherFees'),
      refunds: r2(ls.filter((l) => l.kind === 'refund').reduce((a, l) => a + Math.min(0, l.net), 0)),
      net, hasBreakdown: ls.every((l) => l.hasBreakdown),
      deposit: dep ? { amount: dep.amount, date: dep.date, note: dep.note, by: dep.by } : null,
      gap: dep ? r2(dep.amount - net) : null,
    };
  }).sort((a, b) => (b.payoutDate ?? '').localeCompare(a.payoutDate ?? ''));
}

function weekOf(d: string | null) {
  const t = Date.parse(d ?? '');
  if (!Number.isFinite(t)) return 'unknown';
  const day = new Date(t); const monday = new Date(t - ((day.getUTCDay() + 6) % 7) * DAY);
  return monday.toISOString().slice(0, 10);
}

export async function recordDeposit(key: string, deposit: { amount: number; date: string; note?: string }, actor: Actor) {
  const amount = r2(Number(deposit.amount));
  if (!Number.isFinite(amount)) throw new Error('Enter the amount that reached the bank.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deposit.date)) throw new Error('Enter the deposit date (YYYY-MM-DD).');
  await getRepo().putDocs(COL.deposits, [{ id: key, at: `${deposit.date}T12:00:00.000Z`, data: { key, amount, date: deposit.date, note: deposit.note?.slice(0, 200), by: actor.name } }]);
  const [channel] = key.split('|') as [ChannelKey];
  await logActivity({ actor: actor.name, source: actor.source, kind: 'settings', action: 'deposit_recorded', status: 'success', channel, summary: `Bank deposit recorded for ${CHANNEL_LABELS[channel] ?? channel} payout ${key.split('|')[1]}: ${amount.toFixed(2)} $ on ${deposit.date}` });
}

// ---------------------------------------------------------------- internal ledger

export interface JournalLine { account: string; debit: number; credit: number; memo?: string }
export interface JournalEntry {
  key: string;
  date: string | null;
  channel: ChannelKey;
  memo: string;
  lines: JournalLine[];
  debit: number;
  credit: number;
  balanced: boolean;
  status: 'draft' | 'approved';
  approvedBy?: string;
  approvedAt?: string;
  warnings: string[];
}

export const ACCOUNTS = {
  bank: '1010 Bank — platform deposits',
  clearing: '1150 Platform clearing (unclassified)',
  gstItc: '1310 GST input tax credits',
  qstItr: '1320 QST input tax refunds',
  gstPayable: '2310 GST payable',
  qstPayable: '2320 QST payable',
  sales: (ch: ChannelKey) => `4100 Delivery sales — ${CHANNEL_LABELS[ch]}`,
  otherIncome: '4900 Other platform income',
  commission: '5300 Platform commissions',
  promotions: '5310 Platform promotions & adjustments',
  refunds: '5320 Refunds & error charges',
  otherFees: '5390 Ads & other platform charges',
};

/**
 * One journal entry per payout (draft until the owner approves it — nothing is ever posted automatically):
 *   Dr Bank (net) · Dr Commissions · Dr GST ITC / QST ITR (tax on fees) · Dr Promotions/Adjustments · Dr Refunds · Dr Other charges
 *   Cr Delivery sales · Cr GST payable · Cr QST payable
 */
export function journalFor(b: PayoutBatch, approval?: { by: string; at: string } | null): JournalEntry {
  const L: JournalLine[] = [];
  const add = (account: string, amount: number, memo?: string) => {
    if (Math.abs(amount) < 0.005) return;
    L.push(amount > 0 ? { account, debit: r2(amount), credit: 0, memo } : { account, debit: 0, credit: r2(-amount), memo });
  };
  const warnings: string[] = [];
  if (b.hasBreakdown) {
    const { gst: gstOut, qst: qstOut } = split(b.tax);
    const { gst: gstIn, qst: qstIn } = split(b.commissionTax);
    add(ACCOUNTS.bank, b.net, b.payoutRef ? `Payout ${b.payoutRef}` : undefined);
    add(ACCOUNTS.commission, b.commission);
    add(ACCOUNTS.gstItc, gstIn);
    add(ACCOUNTS.qstItr, qstIn);
    add(ACCOUNTS.promotions, -(b.promotions + b.adjustments));
    add(ACCOUNTS.otherFees, -b.otherFees);
    add(ACCOUNTS.sales(b.channel), -b.sales);
    add(ACCOUNTS.gstPayable, -gstOut);
    add(ACCOUNTS.qstPayable, -qstOut);
    const debit = r2(L.reduce((s, l) => s + l.debit, 0)); const credit = r2(L.reduce((s, l) => s + l.credit, 0));
    const residual = r2(credit - debit);
    if (Math.abs(residual) >= 0.01) {
      // Whatever the statement does not break down (refunds, bag fees, tips…) lands here for review.
      add(residual > 0 ? ACCOUNTS.refunds : ACCOUNTS.otherIncome, residual, 'Not broken down by the statement — review');
      if (Math.abs(residual) >= 1) warnings.push(`${Math.abs(residual).toFixed(2)} $ is not broken down by the statement (refunds, bag fees…) — check before approving.`);
    }
  } else {
    add(ACCOUNTS.bank, b.net);
    add(ACCOUNTS.clearing, -b.net, 'Statement has only net amounts');
    warnings.push('This statement only has net amounts, so sales, fees and taxes cannot be split. Import the detailed report to split them.');
  }
  if (b.gap !== null && Math.abs(b.gap) >= 0.01) warnings.push(`Bank deposit differs from the statement by ${b.gap.toFixed(2)} $.`);
  const debit = r2(L.reduce((s, l) => s + l.debit, 0)); const credit = r2(L.reduce((s, l) => s + l.credit, 0));
  return {
    key: b.key, date: b.payoutDate, channel: b.channel, memo: `${CHANNEL_LABELS[b.channel]} payout ${b.payoutRef ?? b.payoutDate ?? ''} — ${b.lines} line(s)`.trim(),
    lines: L, debit, credit, balanced: Math.abs(debit - credit) < 0.01, status: approval ? 'approved' : 'draft', approvedBy: approval?.by, approvedAt: approval?.at, warnings,
  };
}
function split(total: number) { const gst = r2((total * 5) / 14.975); return { gst, qst: r2(total - gst) }; }

export async function ledger(q: { from: string; to: string; channels?: ChannelKey[] }): Promise<JournalEntry[]> {
  const batches = await payoutBatches(q);
  const approvals = new Map((await getRepo().listDocs<{ by: string; at: string }>(COL.approvals, {})).map((d) => [d.id, d.data]));
  return batches.map((b) => journalFor(b, approvals.get(b.key)));
}

export async function approveEntry(key: string, actor: Actor): Promise<void> {
  await getRepo().putDocs(COL.approvals, [{ id: key, at: nowIso(), data: { by: actor.name, at: nowIso() } }]);
  const [channel] = key.split('|') as [ChannelKey];
  await logActivity({ actor: actor.name, source: actor.source, kind: 'settings', action: 'ledger_approved', status: 'success', channel, summary: `Ledger entry approved: ${CHANNEL_LABELS[channel] ?? channel} payout ${key.split('|')[1]}` });
}

export type { FeeConfig };
