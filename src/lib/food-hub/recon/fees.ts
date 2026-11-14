// Commission & fee plans per platform (and per store when a store has a different contract),
// and the expected payout of every order — the baseline the statements are checked against.
//
// Defaults are the platforms' published Canadian rate cards (verified Oct 2026):
//   Uber Eats  merchants.ubereats.com/ca/en/pricing    Lite 20% · Plus 25% · Premium 30% delivery; pickup 10%
//              (15% when in-app prices differ from in-store); Self-delivery 15%.
//   DoorDash   merchants.doordash.com/en-ca/pricing     Basic 20% · Plus 25% (DashPass orders 27%) · Premier 29%;
//              pickup 10% (Basic) / 8% (Plus, Premier).
//   SkipTheDishes and Too Good To Go do not publish rates → "Contract" plan to fill from your agreement.
// Quebec taxes: GST 5% + QST 9.975% on food are passed through to the restaurant (DoorDash and Uber
// say so in their Canadian terms); the platforms charge GST+QST on their own fees → recoverable (ITC/ITR).
import { CHANNEL_LABELS, nowIso } from '../config';
import { getRepo } from '../repo';
import type { ChannelKey, StoredOrder } from '../types';

export const GST_RATE = 5;
export const QST_RATE = 9.975;
export const SALES_TAX_RATE = GST_RATE + QST_RATE; // 14.975 %

export interface FeePlan {
  plan: string;
  deliveryPct: number;
  pickupPct: number;
  /** Fixed fee per order ($), e.g. a per-order platform fee. */
  fixedFee: number;
  /** Sales tax the platform charges on its own fees (%), recoverable. */
  taxOnFeesPct: number;
  /** Days after the order before a missing payout is flagged. */
  payoutLagDays: number;
}

export interface PlanPreset { plan: string; deliveryPct: number; pickupPct: number; note?: string }

export const PLAN_PRESETS: Record<ChannelKey, PlanPreset[]> = {
  uber_eats: [
    { plan: 'Lite', deliveryPct: 20, pickupPct: 10 },
    { plan: 'Plus', deliveryPct: 25, pickupPct: 10 },
    { plan: 'Premium', deliveryPct: 30, pickupPct: 10 },
    { plan: 'Self-delivery', deliveryPct: 15, pickupPct: 10 },
  ],
  doordash: [
    { plan: 'Basic', deliveryPct: 20, pickupPct: 10 },
    { plan: 'Plus', deliveryPct: 25, pickupPct: 8, note: 'DashPass orders are 27%' },
    { plan: 'Premier', deliveryPct: 29, pickupPct: 8 },
  ],
  skip: [{ plan: 'Contract', deliveryPct: 25, pickupPct: 15, note: 'Skip does not publish rates — enter the ones in your agreement' }],
  tgtg: [{ plan: 'Contract', deliveryPct: 0, pickupPct: 0, note: 'Enter Too Good To Go’s fee from your agreement' }],
};

export const PLAN_NOTES: Record<ChannelKey, string> = {
  uber_eats: 'Pickup is 15% instead of 10% unless your Uber Eats prices match in-store prices. Plus members’ orders can cost 5% more.',
  doordash: 'Pickup rates require DoorDash prices to match in-store prices. No payment processing fee in Canada.',
  skip: 'SkipTheDishes does not publish a rate card — use the percentages in your contract.',
  tgtg: 'Too Good To Go does not publish its fee — use your agreement. Payouts are monthly or quarterly.',
};

const DEFAULT_LAG: Record<ChannelKey, number> = { uber_eats: 10, doordash: 10, skip: 14, tgtg: 100 };

export interface FeeConfig {
  channels: Record<ChannelKey, FeePlan>;
  /** Overrides for one store (storeId → partial plan). */
  stores: Record<string, Partial<FeePlan>>;
  /** The owner confirmed the plan matches their contract. */
  confirmed: Record<ChannelKey, boolean>;
  /** A difference smaller than this ($) is treated as matched. */
  tolerance: number;
  updatedAt?: string;
}

export function defaultFees(): FeeConfig {
  const plan = (ch: ChannelKey, idx: number): FeePlan => {
    const p = PLAN_PRESETS[ch][idx];
    return { plan: p.plan, deliveryPct: p.deliveryPct, pickupPct: p.pickupPct, fixedFee: 0, taxOnFeesPct: SALES_TAX_RATE, payoutLagDays: DEFAULT_LAG[ch] };
  };
  return {
    channels: { uber_eats: plan('uber_eats', 1), doordash: plan('doordash', 1), skip: plan('skip', 0), tgtg: plan('tgtg', 0) },
    stores: {},
    confirmed: { uber_eats: false, doordash: false, skip: false, tgtg: false },
    tolerance: 0.1,
  };
}

const KEY = 'recon_fees';

export async function getFees(): Promise<FeeConfig> {
  const saved = await getRepo().getKv<Partial<FeeConfig>>(KEY).catch(() => null);
  const d = defaultFees();
  if (!saved) return d;
  return {
    channels: Object.fromEntries((Object.keys(d.channels) as ChannelKey[]).map((ch) => [ch, { ...d.channels[ch], ...(saved.channels?.[ch] ?? {}) }])) as FeeConfig['channels'],
    stores: saved.stores ?? {},
    confirmed: { ...d.confirmed, ...(saved.confirmed ?? {}) },
    tolerance: typeof saved.tolerance === 'number' ? saved.tolerance : d.tolerance,
    updatedAt: saved.updatedAt,
  };
}

const pct = (v: unknown, max = 100) => { const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > max) throw new Error(`Percentages must be between 0 and ${max}.`); return Math.round(n * 1000) / 1000; };

export async function saveFees(input: Partial<FeeConfig>): Promise<FeeConfig> {
  const cur = await getFees();
  const channels = { ...cur.channels };
  for (const ch of Object.keys(channels) as ChannelKey[]) {
    const p = input.channels?.[ch];
    if (!p) continue;
    channels[ch] = {
      plan: String(p.plan ?? channels[ch].plan).slice(0, 40),
      deliveryPct: pct(p.deliveryPct ?? channels[ch].deliveryPct),
      pickupPct: pct(p.pickupPct ?? channels[ch].pickupPct),
      fixedFee: Math.max(0, Number(p.fixedFee ?? channels[ch].fixedFee) || 0),
      taxOnFeesPct: pct(p.taxOnFeesPct ?? channels[ch].taxOnFeesPct, 30),
      payoutLagDays: Math.max(1, Math.min(200, Math.round(Number(p.payoutLagDays ?? channels[ch].payoutLagDays) || DEFAULT_LAG[ch]))),
    };
  }
  const stores: FeeConfig['stores'] = {};
  for (const [id, p] of Object.entries(input.stores ?? cur.stores)) {
    const clean: Partial<FeePlan> = {};
    if (p.deliveryPct !== undefined && p.deliveryPct !== null && String(p.deliveryPct) !== '') clean.deliveryPct = pct(p.deliveryPct);
    if (p.pickupPct !== undefined && p.pickupPct !== null && String(p.pickupPct) !== '') clean.pickupPct = pct(p.pickupPct);
    if (p.plan) clean.plan = String(p.plan).slice(0, 40);
    if (Object.keys(clean).length) stores[id] = clean;
  }
  const next: FeeConfig = {
    channels,
    stores,
    confirmed: { ...cur.confirmed, ...(input.confirmed ?? {}) },
    tolerance: input.tolerance !== undefined ? Math.max(0, Math.min(5, Number(input.tolerance) || 0)) : cur.tolerance,
    updatedAt: nowIso(),
  };
  await getRepo().setKv(KEY, next);
  return next;
}

export function planFor(fees: FeeConfig, channel: ChannelKey, storeId?: string | null): FeePlan {
  return { ...fees.channels[channel], ...(storeId ? fees.stores[storeId] ?? {} : {}) };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface Expected {
  sales: number;
  tax: number;
  commission: number;
  commissionTax: number;
  fixedFee: number;
  net: number;
  ratePct: number;
}

/**
 * What the platform should pay for this order:
 *   food sales (after restaurant-funded discounts) + tax passed through − commission − tax on commission − fixed fee.
 * Courier tips are not the restaurant's money; cancelled orders are expected at 0.
 */
export function expectedPayout(order: Pick<StoredOrder, 'subtotal' | 'discount' | 'tax' | 'fulfillment' | 'status'>, plan: FeePlan): Expected {
  if (order.status === 'cancelled') return { sales: 0, tax: 0, commission: 0, commissionTax: 0, fixedFee: 0, net: 0, ratePct: 0 };
  const ratePct = order.fulfillment === 'pickup' ? plan.pickupPct : plan.deliveryPct;
  const sales = r2((Number(order.subtotal) || 0) - (Number(order.discount) || 0));
  const tax = r2(Number(order.tax) || 0);
  const commission = r2((sales * ratePct) / 100);
  const commissionTax = r2((commission * plan.taxOnFeesPct) / 100);
  const fixedFee = r2(plan.fixedFee || 0);
  return { sales, tax, commission, commissionTax, fixedFee, net: r2(sales + tax - commission - commissionTax - fixedFee), ratePct };
}

/** Splits a combined GST+QST amount into its two parts (Quebec). */
export function splitQuebecTax(total: number): { gst: number; qst: number } {
  const gst = r2((total * GST_RATE) / SALES_TAX_RATE);
  return { gst, qst: r2(total - gst) };
}

export function channelLabel(ch: ChannelKey) { return CHANNEL_LABELS[ch]; }
