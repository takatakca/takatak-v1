'use client';

// Shared pieces of the Payouts & Reconciliation pages (RC9).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { CHANNEL_OPTIONS, MultiPick, RANGE_LABELS, type CatalogLocation, type Filters, type RangePreset } from '@/app/dashboard/food-hub/ui';

export const CH_NAME: Record<string, string> = { uber_eats: 'Uber Eats', doordash: 'DoorDash', skip: 'SkipTheDishes', tgtg: 'Too Good To Go' };

const TABS: Array<[string, string]> = [
  ['/dashboard/food-hub/finance', 'Overview'],
  ['/dashboard/food-hub/finance/reconciliation', 'Orders vs payouts'],
  ['/dashboard/food-hub/finance/disputes', 'Disputes'],
  ['/dashboard/food-hub/finance/payouts', 'Payouts & deposits'],
  ['/dashboard/food-hub/finance/ledger', 'Internal ledger'],
  ['/dashboard/food-hub/finance/imports', 'Statements'],
  ['/dashboard/food-hub/finance/fees', 'Commission plans'],
];

export function FinanceTabs() {
  const path = usePathname();
  return (
    <nav className="fh-tabs fin-tabs" aria-label="Payouts & reconciliation">
      {TABS.map(([href, label]) => <Link key={href} href={href} className={path === href ? 'on' : ''} aria-current={path === href ? 'page' : undefined}>{label}</Link>)}
    </nav>
  );
}

export function FinanceHead({ title, intro, right }: { title: string; intro: ReactNode; right?: ReactNode }) {
  return (
    <>
      <div className="fh-head">
        <div>
          <h1>{title}</h1>
          <div className="small" style={{ maxWidth: 820 }}>{intro}</div>
        </div>
        {right && <div className="fh-row">{right}</div>}
      </div>
      <FinanceTabs />
    </>
  );
}

/** Period + locations + platforms (no brand filter: payouts are per store, statements per platform). */
export function FinanceFilters({ filters, set, locations, showLocations = true, extra }: { filters: Filters; set: (p: Partial<Filters>) => void; locations: CatalogLocation[]; showLocations?: boolean; extra?: ReactNode }) {
  const presets = (Object.keys(RANGE_LABELS) as RangePreset[]).filter((k) => k !== 'today');
  return (
    <div className="fh-filters">
      <select value={filters.preset} onChange={(e) => set({ preset: e.target.value as RangePreset })} aria-label="Period">
        {presets.map((k) => <option key={k} value={k}>{RANGE_LABELS[k]}</option>)}
      </select>
      {filters.preset === 'custom' && (
        <>
          <input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value, preset: 'custom' })} aria-label="From" />
          <span className="small">to</span>
          <input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value, preset: 'custom' })} aria-label="To" />
        </>
      )}
      {showLocations && <MultiPick label="Locations" options={locations.map((l) => [l.code, l.name])} value={filters.locations} onChange={(v) => set({ locations: v })} />}
      <MultiPick label="Platforms" options={CHANNEL_OPTIONS} value={filters.channels} onChange={(v) => set({ channels: v })} />
      {extra}
    </div>
  );
}

export const cad = (n: number | null | undefined) => (n === null || n === undefined ? '—' : new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n));
/** Signed amount: "+$1.20" / "−$3.40" (sign always shown, never color alone). */
export const signed = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${cad(Math.abs(n))}`);
export const day = (iso?: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('en-CA') : '—');

export type ReconStatus = 'matched' | 'short_paid' | 'over_paid' | 'refunded' | 'error_charge' | 'missing' | 'pending' | 'cancelled' | 'not_covered';
export const RECON_LABEL: Record<ReconStatus, string> = {
  matched: 'Paid as expected', short_paid: 'Paid less', over_paid: 'Paid more', refunded: 'Refund / chargeback',
  error_charge: 'Error charge', missing: 'Missing from payout', pending: 'Not due yet', cancelled: 'Cancelled', not_covered: 'No statement yet',
};
const RECON_STYLE: Record<ReconStatus, [string, string]> = {
  matched: ['badge-green', '✓'], short_paid: ['badge-red', '▼'], over_paid: ['badge-blue', '▲'], refunded: ['badge-red', '↩'], error_charge: ['badge-red', '!'],
  missing: ['badge-red', '✕'], pending: ['badge-yellow', '◷'], cancelled: ['badge-blue', '–'], not_covered: ['badge-yellow', '?'],
};
export function ReconBadge({ status }: { status: ReconStatus }) {
  const [cls, icon] = RECON_STYLE[status] ?? ['badge-blue', '·'];
  return <span className={`badge ${cls}`}><span aria-hidden>{icon}</span>{RECON_LABEL[status] ?? status}</span>;
}
export const PROBLEM: ReconStatus[] = ['missing', 'short_paid', 'error_charge', 'refunded', 'over_paid'];

export type Expected = { sales: number; tax: number; commission: number; commissionTax: number; fixedFee: number; net: number; ratePct: number };
export type OrderRecon = {
  orderId: string; channel: string; ref: string; displayId: string; brandName: string | null; locationCode: string | null; date: string; fulfillment: string; orderStatus: string;
  total: number; expected: Expected; actual: number | null; diff: number | null; status: ReconStatus; lines: number; payoutDate: string | null; refunds: number; errorCharges: number; adjustments: number; planConfirmed: boolean;
  caseStatus: CaseStatus | null;
};
export type Unmatched = { id: string; channel: string; ref: string | null; kind: string; description: string; orderDate: string | null; payoutDate: string | null; net: number };
export type ChannelSummary = { channel: string; label: string; orders: number; sales: number; expected: number; paid: number; diff: number; missingMoney: number; counts: Record<ReconStatus, number>; otherCharges: number; unknownOrders: number; coveredUntil: string | null; planConfirmed: boolean };
export type Recon = { orders: OrderRecon[]; unmatched: Unmatched[]; other: Unmatched[]; channels: ChannelSummary[]; totals: { orders: number; expected: number; paid: number; diff: number; missingMoney: number; unknownOrders: number; otherCharges: number }; imports: number; generatedAt: string };

/** Money to chase for one order (same rule as the server; nothing once the owner recovered / wrote it off). */
export function toRecover(r: Pick<OrderRecon, 'status' | 'diff' | 'expected'> & { caseStatus?: CaseStatus | null }) {
  if (r.caseStatus && ['recovered', 'written_off', 'ignored'].includes(r.caseStatus)) return 0;
  if (r.status === 'missing') return r.expected.net;
  if (['short_paid', 'error_charge', 'refunded'].includes(r.status) && r.diff !== null && r.diff < 0) return -r.diff;
  return 0;
}

export type CaseStatus = 'open' | 'disputed' | 'recovered' | 'written_off' | 'resolved' | 'ignored';
/** Money the platform owes you (an unknown order is a data gap, not a loss). */
export const RECOVERABLE = ['short_paid', 'missing', 'error_charge', 'refunded'];
export const CASE_STATUS_LABEL: Record<CaseStatus, string> = { open: 'To check', disputed: 'Disputed with platform', recovered: 'Recovered', written_off: 'Written off', resolved: 'Fixed by a later payout', ignored: 'Ignored' };
export function CaseBadge({ status }: { status: CaseStatus }) {
  const cls = status === 'open' ? 'badge-red' : status === 'disputed' ? 'badge-yellow' : status === 'recovered' || status === 'resolved' ? 'badge-green' : 'badge-blue';
  const icon = status === 'open' ? '!' : status === 'disputed' ? '◷' : status === 'recovered' || status === 'resolved' ? '✓' : '–';
  return <span className={`badge ${cls}`}><span aria-hidden>{icon}</span>{CASE_STATUS_LABEL[status]}</span>;
}

/** Shown instead of the page when the API refuses (location-limited users). */
export function FinanceError({ message }: { message: string }) {
  if (!message) return null;
  return <div className="fh-banner warn" role="alert">{message}</div>;
}

export function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(file);
  });
}
