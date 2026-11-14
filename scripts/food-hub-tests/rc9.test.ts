// RC9 — payouts & reconciliation, Clover bookkeeping, couriers, scheduled orders, TGTG, French menus.
import { beforeEach, describe, expect, it } from './shim';
import { doorDashCourierStatus, skipCourierStatus } from '../../src/lib/food-hub/courier';
import { label } from '../../src/lib/food-hub/menu/language';
import { parseSkipFailedOrder } from '../../src/lib/food-hub/adapters/skip';
import { cloverItemSellable, externalPaymentId } from '../../src/lib/food-hub/pos/clover-books';
import { expectedPayout, defaultFees, planFor, splitQuebecTax } from '../../src/lib/food-hub/recon/fees';
import { journalFor, missingAmount, type PayoutBatch } from '../../src/lib/food-hub/recon/engine';
import { classify, detectFormat, guessMapping, parseAmount, parseCsv, parseDate, parseStatement, readTable } from '../../src/lib/food-hub/recon/statements';
import { toXlsx } from '../../src/lib/food-hub/reports';
import { scheduledInfo } from '../../src/lib/food-hub/scheduling';

const enc = (s: string) => new TextEncoder().encode(s);
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

describe('statement parsing', () => {
  it('reads CSV with quotes, semicolons and title lines', () => {
    expect(parseCsv('a,b,c\n"x, y",2,"say ""hi"""\n')).toEqual([['a', 'b', 'c'], ['x, y', '2', 'say "hi"']]);
    expect(parseCsv('Order;Net;Date\n1;12,50;2026-09-01')).toEqual([['Order', 'Net', 'Date'], ['1', '12,50', '2026-09-01']]);
  });
  it('parses amounts in every format the portals use', () => {
    expect(parseAmount('$1,234.56')).toBe(1234.56);
    expect(parseAmount('(12.34)')).toBe(-12.34);
    expect(parseAmount('-5')).toBe(-5);
    expect(parseAmount('12,50')).toBe(12.5);
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('CAD 7.00')).toBe(7);
    expect(parseAmount('')).toBe(0);
  });
  it('parses dates (ISO, M/D/Y, D/M/Y, Excel serial)', () => {
    expect(parseDate('2026-09-03')).toBe('2026-09-03');
    expect(parseDate('2026-09-03 18:05')).toBe('2026-09-03T18:05:00');
    expect(parseDate('9/3/2026')).toBe('2026-09-03');
    expect(parseDate('25/09/2026')).toBe('2026-09-25');
    expect(parseDate('46268')).toBe('2026-09-03');
  });
  it('recognises the Uber Eats payment details report and splits GST + QST', () => {
    const csv = [
      'Store Name,Store ID,Order ID,Workflow ID,Order Status,Order Date,Payout Date,Sales (excluding tax),GST/HST on Sales,QST on Sales,Marketplace fee,GST/HST on Marketplace fee,QST on Marketplace fee,Other payments,Other payments description,Total payout,Payout reference ID',
      'Po Poulet,store-1,A1B2C,wf-111,Completed,2026-09-01,2026-09-08,20.00,1.00,1.99,-5.00,-0.25,-0.50,0,,17.24,P-1',
      'Po Poulet,store-1,,,,,2026-09-08,0,0,0,0,0,0,-15.00,Ads campaign,-15.00,P-1',
    ].join('\n');
    const p = parseStatement('uber.csv', enc(csv));
    expect(p.format).toBe('uber_payment_details');
    expect(p.channel).toBe('uber_eats');
    expect(p.lines).toHaveLength(2);
    const [o, ads] = p.lines;
    expect(o).toMatchObject({ orderRef: 'wf-111', orderRef2: 'A1B2C', sales: 20, tax: 2.99, commission: 5, commissionTax: 0.75, net: 17.24, kind: 'order', payoutRef: 'P-1', hasBreakdown: true });
    expect(ads).toMatchObject({ orderRef: null, kind: 'ads', net: -15 });
  });
  it('recognises DoorDash transaction exports', () => {
    const csv = 'Timestamp local date,Transaction type,DoorDash order ID,Merchant Store ID,Subtotal,Subtotal tax passed to merchant,Commission,Error charges,Net total,Payout date\n2026-09-02,DELIVERY,dd-9,st-1,30.00,4.49,-7.50,0,25.87,2026-09-09';
    const p = parseStatement('dd.csv', enc(csv));
    expect(detectFormat(p.headers).format).toBe('doordash_transactions');
    expect(p.lines[0]).toMatchObject({ orderRef: 'dd-9', sales: 30, tax: 4.49, commission: 7.5, net: 25.87, kind: 'order' });
  });
  it('guesses the columns of an unknown file and skips total rows', () => {
    const csv = 'Order Number,Order Date,Net Payout,Type\n#123,2026-09-01,10.00,Order\nTotal,,10.00,';
    const p = parseStatement('skip.csv', enc(csv));
    expect(p.format).toBe('generic');
    expect(guessMapping(p.headers)).toMatchObject({ orderRef: 0, orderDate: 1, net: 2, kind: 3 });
    expect(p.lines).toHaveLength(1);
    expect(p.sample.length).toBeGreaterThan(0);
  });
  it('reads Excel (.xlsx) statements', () => {
    const bytes = toXlsx({ key: 'store_actions', title: 'Statement', filename: 's', columns: ['Order Number', 'Net Payout', 'Order Date'], rows: [['A-1', 12.5, '2026-09-01']] });
    const table = readTable('statement.xlsx', bytes);
    const flat = table.flat();
    expect(flat).toContain('Order Number');
    expect(flat).toContain('A-1');
  });
  it('rejects PDF and old .xls with a clear message', () => {
    expect(() => readTable('s.pdf', enc('%PDF'))).toThrow(/CSV or Excel/);
    expect(() => readTable('s.xls', enc('x'))).toThrow(/\.xlsx or \.csv/);
  });
  it('classifies statement lines', () => {
    expect(classify('Error charge', '', -4, true)).toBe('error_charge');
    expect(classify('Refund', '', -8, true)).toBe('refund');
    expect(classify('', 'Tablet subscription fee', -10, false)).toBe('fee');
    expect(classify('Completed', '', 12, true)).toBe('order');
  });
});

describe('expected payout & tax', () => {
  const fees = defaultFees();
  it('delivery: sales + tax − commission − tax on commission (Quebec 14.975%)', () => {
    const e = expectedPayout({ subtotal: 20, discount: 0, tax: 2.99, fulfillment: 'delivery', status: 'completed' }, planFor(fees, 'uber_eats'));
    expect(e).toMatchObject({ sales: 20, tax: 2.99, commission: 5, commissionTax: 0.75, net: 17.24, ratePct: 25 });
  });
  it('pickup uses the pickup rate; cancelled orders expect nothing', () => {
    expect(expectedPayout({ subtotal: 20, discount: 0, tax: 0, fulfillment: 'pickup', status: 'completed' }, planFor(fees, 'doordash')).ratePct).toBe(8);
    expect(expectedPayout({ subtotal: 20, discount: 0, tax: 3, fulfillment: 'delivery', status: 'cancelled' }, planFor(fees, 'doordash')).net).toBe(0);
  });
  it('store overrides replace the platform plan', () => {
    const f = { ...fees, stores: { s1: { deliveryPct: 15 } } };
    expect(planFor(f, 'uber_eats', 's1').deliveryPct).toBe(15);
    expect(planFor(f, 'uber_eats', 's2').deliveryPct).toBe(25);
  });
  it('splits GST and QST', () => {
    expect(splitQuebecTax(2.99)).toEqual({ gst: 1, qst: 1.99 });
  });
  it('money to recover', () => {
    const exp = { sales: 10, tax: 0, commission: 0, commissionTax: 0, fixedFee: 0, net: 11.5, ratePct: 0 };
    expect(missingAmount({ status: 'missing', diff: null, expected: exp })).toBe(11.5);
    expect(missingAmount({ status: 'short_paid', diff: -5.87, expected: exp })).toBe(5.87);
    expect(missingAmount({ status: 'over_paid', diff: 3, expected: exp })).toBe(0);
  });
});

describe('internal ledger', () => {
  const base: PayoutBatch = { key: 'uber_eats|P-1', channel: 'uber_eats', payoutRef: 'P-1', payoutDate: '2026-09-08', lines: 1, orders: 1, sales: 20, tax: 2.99, commission: 5, commissionTax: 0.75, promotions: 0, adjustments: 0, otherFees: -15, refunds: 0, net: 2.24, hasBreakdown: true, deposit: null, gap: null };
  it('every entry balances and splits GST/QST both ways', () => {
    const e = journalFor(base);
    expect(e.balanced).toBe(true);
    expect(e.debit).toBeCloseTo(e.credit, 2);
    expect(e.lines.find((l) => l.account.startsWith('2310'))?.credit).toBe(1);
    expect(e.lines.find((l) => l.account.startsWith('2320'))?.credit).toBe(1.99);
    expect(e.lines.find((l) => l.account.startsWith('1310'))?.debit).toBe(0.25);
    expect(e.status).toBe('draft');
  });
  it('anything the statement does not break down is flagged, still balanced', () => {
    const e = journalFor({ ...base, net: base.net - 8 });
    expect(e.balanced).toBe(true);
    expect(e.warnings.join(' ')).toMatch(/not broken down/);
  });
  it('net-only statements go to clearing; deposit gaps are warned', () => {
    const e = journalFor({ ...base, hasBreakdown: false, deposit: { amount: 2, date: '2026-09-09', by: 'x' }, gap: -0.24 });
    expect(e.balanced).toBe(true);
    expect(e.lines.some((l) => l.account.startsWith('1150'))).toBe(true);
    expect(e.warnings.join(' ')).toMatch(/deposit differs/i);
  });
});

describe('reconciliation end to end (memory store)', () => {
  beforeEach(() => {
    process.env.FOODHUB_FORCE_MEMORY = 'true';
    (globalThis as any).__foodhubMem = undefined;
  });

  it('matches, short-paid, missing, refunded, unknown and other charges — then opens dispute cases', async () => {
    const { getRepo } = await import('../../src/lib/food-hub/repo');
    const { importStatement, reconcile, syncCases, listCases, payoutBatches, ledger } = await import('../../src/lib/food-hub/recon/engine');
    const repo = getRepo();
    const D = ymd(Date.now() - 20 * 86400_000);
    const P = ymd(Date.now() - 13 * 86400_000);
    const at = `${D}T16:00:00.000Z`;
    const base = { channel: 'uber_eats' as const, marketplace: 'uber_eats' as const, channelStoreId: 'store-1', fulfillment: 'delivery' as const, placedAt: at, currency: 'CAD', deliveryFee: 0, tip: 0, discount: 0, lines: [], raw: {}, createdAt: at };
    for (const [id, subtotal, tax] of [['wf-1', 20, 2.99], ['wf-2', 30, 4.49], ['wf-3', 10, 1.5], ['wf-4', 8, 0]] as const) {
      const { order } = await repo.insertOrderIfNew({ ...base, externalOrderId: id, displayId: id.toUpperCase(), subtotal, tax, total: subtotal + tax });
      await repo.updateOrder(order.id, { status: 'completed' });
    }
    const H = 'Order ID,Workflow ID,Order Status,Order Date,Payout Date,Sales (excluding tax),Tax on Sales,Marketplace fee,Tax on Marketplace fee,Other payments,Other payments description,Total payout,Payout reference ID';
    const rows = [
      `WF-1,wf-1,Completed,${D},${P},20,2.99,-5,-0.75,0,,17.24,P-1`,
      `WF-2,wf-2,Completed,${D},${P},30,4.49,-7.5,-1.12,0,,20.00,P-1`,
      `WF-4,wf-4,Completed,${D},${P},8,0,-2,-0.30,0,,5.70,P-1`,
      `WF-4,wf-4,Refund,${D},${P},0,0,0,0,-5.70,Customer refund,-5.70,P-1`,
      `X-9,wf-999,Completed,${D},${P},10,1.5,-2.5,-0.37,0,,8.63,P-1`,
      `,,,,${P},0,0,0,0,-15,Ads campaign,-15,P-1`,
    ];
    const actor = { username: 't', name: 'Test', source: 'dashboard' as const };
    const first = await importStatement({ fileName: 'uber.csv', bytes: enc([H, ...rows].join('\n')), actor });
    expect(first.ok).toBe(true);
    const again = await importStatement({ fileName: 'uber-copy.csv', bytes: enc([H, ...rows].join('\n')), actor });
    expect(again.ok && again.import.newLines).toBe(0); // the same lines are never counted twice

    const from = new Date(Date.parse(`${D}T00:00:00Z`) - 86400_000).toISOString();
    const to = new Date(Date.parse(`${P}T00:00:00Z`) + 2 * 86400_000).toISOString();
    const r = await reconcile({ from, to });
    const st = Object.fromEntries(r.orders.map((o) => [o.ref, o.status]));
    expect(st).toEqual({ 'wf-1': 'matched', 'wf-2': 'short_paid', 'wf-3': 'missing', 'wf-4': 'refunded' });
    expect(r.orders.find((o) => o.ref === 'wf-2')?.diff).toBe(-5.87);
    expect(r.unmatched.map((l) => l.ref)).toEqual(['wf-999']);
    expect(r.other.map((l) => l.kind)).toEqual(['ads']);
    expect(r.totals.missingMoney).toBeCloseTo(5.87 + 8.63 + 5.7, 2); // short-paid + missing (10 + 1.5 − 2.5 − 0.37) + refunded

    const cases = await syncCases(r);
    expect(cases.opened).toBe(4);
    expect((await listCases({ status: ['open'] })).map((c) => c.type).sort()).toEqual(['missing', 'refunded', 'short_paid', 'unknown_order']);
    expect((await syncCases(r)).opened).toBe(0); // idempotent

    const batches = await payoutBatches({ from, to });
    expect(batches).toHaveLength(1);
    expect(batches[0].net).toBeCloseTo(17.24 + 20 + 5.7 - 5.7 + 8.63 - 15, 2);
    const entries = await ledger({ from, to });
    expect(entries[0].balanced).toBe(true);
  });

  it('Too Good To Go bag log becomes a sale, and is cancelled when nothing sold', async () => {
    const { getRepo } = await import('../../src/lib/food-hub/repo');
    const { saveBagDay } = await import('../../src/lib/food-hub/tgtg');
    const actor = { username: 't', name: 'Test', source: 'dashboard' as const };
    const date = ymd(Date.now() - 86400_000);
    const day = await saveBagDay({ date, locationCode: 'NDG_MAIN', bagsOffered: 10, bagsSold: 8, pricePerBag: 5.99 }, actor);
    const o = await getRepo().getOrder(day.orderId!);
    expect(o).toMatchObject({ channel: 'tgtg', status: 'completed', total: 47.92, locationCode: 'NDG_MAIN' });
    await saveBagDay({ date, locationCode: 'NDG_MAIN', bagsOffered: 10, bagsSold: 0, pricePerBag: 5.99 }, actor);
    expect((await getRepo().getOrder(day.orderId!))?.status).toBe('cancelled');
    await expect(saveBagDay({ date, locationCode: 'NDG_MAIN', bagsOffered: 5, bagsSold: 8, pricePerBag: 5.99 }, actor)).rejects.toThrow(/more than bags offered/);
  });
});

describe('couriers, scheduled orders, Skip backup, Clover', () => {
  it('maps courier statuses from Skip and DoorDash', () => {
    expect(skipCourierStatus('driverAtRestaurant')).toBe('at_store');
    expect(skipCourierStatus('onItsWay')).toBe('picked_up');
    expect(skipCourierStatus('nonsense')).toBeNull();
    expect(doorDashCourierStatus('dasher_confirmed')).toBe('assigned');
    expect(doorDashCourierStatus('dasher_arriving_at_store')).toBe('arriving');
    expect(doorDashCourierStatus('dasher_picked_up')).toBe('picked_up');
    expect(doorDashCourierStatus('order_created')).toBeNull();
  });
  it('holds orders due later and fires them at due time − prep time', () => {
    const now = Date.parse('2026-10-01T15:00:00Z');
    expect(scheduledInfo({ readyBy: '2026-10-01T15:30:00Z' }, 20, now)).toBeNull();
    expect(scheduledInfo({ readyBy: '2026-10-01T18:00:00Z' }, 20, now)).toEqual({ scheduledFor: '2026-10-01T18:00:00.000Z', fireAt: '2026-10-01T17:40:00.000Z' });
  });
  it('reads Skip failed-order backup notices (prices in cents)', () => {
    const n = parseSkipFailedOrder({ validationError: 'unknownReference', order: { orderId: 'o-1', friendlyOrderReference: '1234', totalPrice: 2598, restaurant: { id: 'r-1' }, fulfilment: { type: 'delivery' }, items: [{ name: 'Poulet', plu: 'i1', price: 1299, quantity: 2 }] } });
    expect(n).toMatchObject({ externalOrderId: 'o-1', displayId: '1234', subtotal: 25.98, total: 25.98, failure: expect.any(String) });
  });
  it('Clover: what counts as sellable, and the payment reference fits 32 characters', () => {
    expect(cloverItemSellable({ available: true })).toBe(true);
    expect(cloverItemSellable({ available: false })).toBe(false);
    expect(cloverItemSellable({ hidden: true })).toBe(false);
    expect(cloverItemSellable({ autoManage: true, itemStock: { quantity: 0 } })).toBe(false);
    expect(cloverItemSellable({ autoManage: false, itemStock: { quantity: 0 } })).toBe(true);
    expect(externalPaymentId({ channel: 'uber_eats', externalOrderId: 'f1e2d3c4-b5a6-4789-9abc-def012345678' }).length).toBeLessThanOrEqual(32);
  });
  it('French menu labels', () => {
    expect(label('Grilled chicken', 'Poulet grillé', 'fr')).toBe('Poulet grillé');
    expect(label('Grilled chicken', 'Poulet grillé', 'both')).toBe('Poulet grillé / Grilled chicken');
    expect(label('Grilled chicken', undefined, 'fr')).toBe('Grilled chicken');
    expect(label('Grilled chicken', 'Poulet grillé', 'en')).toBe('Grilled chicken');
  });
});
