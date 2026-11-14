'use client';

// Small, dependency-free chart kit for Analytics.
// Rules (dataviz skill): one hue per job (blue = the data, gray = the comparison period), thin marks
// (bars <= 24px with a 4px rounded data-end, 2px lines), hairline solid grid, no dual axis,
// hover + keyboard tooltips that never gate (every chart has a table view), text in ink colors only.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { downloadCsv } from './ui';

export const VIZ = {
  surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781', grid: '#e1e0d9', base: '#c3c2b7',
  series: '#2a78d6', compare: '#a3a19a', good: '#006300', bad: '#d03b3b', none: '#f1f0ec',
  ramp: ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'],
};

export function compactMoney(n: number) {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 10_000) return `$${Math.round(n / 1000)}K`;
  if (a >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}
export const fmtMoney = (n: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: n >= 1000 ? 0 : 2 }).format(n);
export const fmtInt = (n: number) => new Intl.NumberFormat('en-CA').format(Math.round(n));

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

type Tip = { x: number; y: number; title: string; rows: Array<{ value: string; label: string; color?: string; dash?: boolean }> } | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div className="viz-tip" style={{ left: tip.x, top: tip.y }} role="status">
      <div className="viz-tip-title">{tip.title}</div>
      {tip.rows.map((r, i) => (
        <div key={i} className="viz-tip-row">
          {r.color && <span className="viz-key" style={{ borderTopColor: r.color, borderTopStyle: r.dash ? 'dashed' : 'solid' }} />}
          <strong>{r.value}</strong> <span>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Card with a Chart / Table switch and CSV of the table. */
export function ChartCard({ title, subtitle, legend, table, children, loading }: {
  title: string; subtitle?: string; legend?: ReactNode; loading?: boolean;
  table: { columns: string[]; rows: Array<Array<string | number>>; filename: string };
  children: ReactNode;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <section className={`card viz-card ${loading ? 'viz-loading' : ''}`}>
      <div className="viz-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <div className="small">{subtitle}</div>}
        </div>
        <div className="fh-row">
          {legend}
          <div className="viz-switch" role="group" aria-label="View">
            <button className={view === 'chart' ? 'on' : ''} aria-pressed={view === 'chart'} onClick={() => setView('chart')}>Chart</button>
            <button className={view === 'table' ? 'on' : ''} aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
          </div>
        </div>
      </div>
      {view === 'chart' ? children : (
        <div>
          <div className="fh-table-wrap viz-table">
            <table>
              <thead><tr>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {table.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={typeof v === 'number' ? 'num' : ''}>{typeof v === 'number' ? fmtInt(v) : v}</td>)}</tr>)}
                {table.rows.length === 0 && <tr><td colSpan={table.columns.length} className="small">No data.</td></tr>}
              </tbody>
            </table>
          </div>
          <button className="btn-sm btn-light" style={{ marginTop: 8 }} onClick={() => downloadCsv(table.filename, table.columns, table.rows)}>Download CSV</button>
        </div>
      )}
    </section>
  );
}

export function LineLegend({ items }: { items: Array<{ label: string; color: string; dash?: boolean }> }) {
  return (
    <span className="viz-legend">
      {items.map((i) => <span key={i.label}><span className="viz-key" style={{ borderTopColor: i.color, borderTopStyle: i.dash ? 'dashed' : 'solid' }} />{i.label}</span>)}
    </span>
  );
}

/** Current period (blue) vs previous period (gray) on one axis, with a snapping crosshair. */
export function CompareLine({ points, format, axisFormat, curLabel, prevLabel, height = 240 }: {
  points: Array<{ label: string; cur: number; prev: number }>; format: (n: number) => string; axisFormat: (n: number) => string;
  curLabel: string; prevLabel: string; height?: number;
}) {
  const { ref, w } = useWidth<HTMLDivElement>();
  const [idx, setIdx] = useState<number | null>(null);
  const m = { l: 52, r: 56, t: 12, b: 26 };
  const iw = w - m.l - m.r; const ih = height - m.t - m.b;
  const max = Math.max(1, ...points.flatMap((p) => [p.cur, p.prev]));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const x = (i: number) => m.l + (points.length <= 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => m.t + ih - (v / top) * ih;
  const path = (key: 'cur' | 'prev') => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join('');
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 70))));
  const last = points.length - 1;

  function pick(clientX: number, rect: DOMRect) {
    if (!points.length) return;
    const rel = clientX - rect.left - m.l;
    const i = points.length <= 1 ? 0 : Math.round((rel / iw) * (points.length - 1));
    setIdx(Math.max(0, Math.min(points.length - 1, i)));
  }
  const tip: Tip = idx === null ? null : {
    x: Math.min(x(idx) + 12, w - 190), y: 8, title: points[idx].label,
    rows: [{ value: format(points[idx].cur), label: curLabel, color: VIZ.series }, { value: format(points[idx].prev), label: prevLabel, color: VIZ.compare, dash: true }],
  };

  return (
    <div ref={ref} className="viz-wrap" style={{ height }}>
      <svg width={w} height={height} role="img" aria-label={`${curLabel} vs ${prevLabel}`} tabIndex={0}
        onPointerMove={(e) => pick(e.clientX, (e.currentTarget as SVGSVGElement).getBoundingClientRect())}
        onPointerLeave={() => setIdx(null)}
        onFocus={() => setIdx(last >= 0 ? last : null)} onBlur={() => setIdx(null)}
        onKeyDown={(e) => { if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, (i ?? last) - 1)); if (e.key === 'ArrowRight') setIdx((i) => Math.min(last, (i ?? 0) + 1)); }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.base : VIZ.grid} strokeWidth={1} />
            <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="viz-axis">{axisFormat(t)}</text>
          </g>
        ))}
        {points.map((p, i) => (i % labelEvery === 0 || i === last) && (i === last || last - i >= labelEvery / 2) ? <text key={p.label} x={x(i)} y={height - 6} textAnchor="middle" className="viz-axis">{p.label.slice(5)}</text> : null)}
        <path d={path('prev')} fill="none" stroke={VIZ.compare} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5 4" />
        <path d={path('cur')} fill="none" stroke={VIZ.series} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {last >= 0 && (
          <>
            <circle cx={x(last)} cy={y(points[last].cur)} r={4} fill={VIZ.series} stroke={VIZ.surface} strokeWidth={2} />
            <text x={x(last) + 8} y={y(points[last].cur) + 4} className="viz-end">{axisFormat(points[last].cur)}</text>
          </>
        )}
        {idx !== null && (
          <g pointerEvents="none">
            <line x1={x(idx)} x2={x(idx)} y1={m.t} y2={m.t + ih} stroke={VIZ.base} strokeWidth={1} />
            <circle cx={x(idx)} cy={y(points[idx].prev)} r={4} fill={VIZ.compare} stroke={VIZ.surface} strokeWidth={2} />
            <circle cx={x(idx)} cy={y(points[idx].cur)} r={4} fill={VIZ.series} stroke={VIZ.surface} strokeWidth={2} />
          </g>
        )}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/** Horizontal bars, one series (one color), value at the tip. */
export function HBars({ rows, format, empty = 'No data for this period.' }: {
  rows: Array<{ label: string; value: number; detail?: string }>; format: (n: number) => string; empty?: string;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const box = useRef<HTMLDivElement>(null);
  if (!rows.length) return <div className="viz-empty">{empty}</div>;
  const show = (r: { label: string; value: number; detail?: string }, el: HTMLElement) => {
    const b = box.current?.getBoundingClientRect(); const e = el.getBoundingClientRect();
    setTip({ x: Math.min((b ? e.left - b.left : 0) + 140, (b?.width ?? 400) - 200), y: (b ? e.top - b.top : 0) - 6, title: r.label, rows: [{ value: format(r.value), label: r.detail ?? '' }] });
  };
  return (
    <div className="viz-wrap" ref={box}>
      <div className="viz-hbars">
        {rows.map((r) => (
          <div key={r.label} className="viz-hbar" tabIndex={0} onPointerEnter={(e) => show(r, e.currentTarget)} onPointerLeave={() => setTip(null)} onFocus={(e) => show(r, e.currentTarget)} onBlur={() => setTip(null)}>
            <span className="viz-hbar-label" title={r.label}>{r.label}</span>
            <span className="viz-hbar-track">
              {/* Leave room at the end of the track for the value label so it never leaves the card. */}
              <span className="viz-hbar-fill" style={{ width: `calc((100% - 72px) * ${Math.max(0.004, r.value / max).toFixed(4)})` }} />
              <span className="viz-hbar-val">{format(r.value)}</span>
            </span>
          </div>
        ))}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

/** Vertical columns, one series. */
export function Columns({ rows, format, height = 180 }: { rows: Array<{ label: string; value: number }>; format: (n: number) => string; height?: number }) {
  const [tip, setTip] = useState<Tip>(null);
  const box = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const show = (r: { label: string; value: number }, el: HTMLElement) => {
    const b = box.current?.getBoundingClientRect(); const e = el.getBoundingClientRect();
    setTip({ x: Math.max(0, Math.min((b ? e.left - b.left : 0), (b?.width ?? 400) - 180)), y: 0, title: r.label, rows: [{ value: format(r.value), label: 'orders' }] });
  };
  return (
    <div className="viz-wrap" ref={box}>
      <div className="viz-cols">
        {rows.map((r) => (
          <div key={r.label} className="viz-col" tabIndex={0} onPointerEnter={(e) => show(r, e.currentTarget)} onPointerLeave={() => setTip(null)} onFocus={(e) => show(r, e.currentTarget)} onBlur={() => setTip(null)}>
            <div className="viz-col-area" style={{ height }}>
              <span className="viz-col-val">{r.value ? format(r.value) : ''}</span>
              <span className="viz-col-bar" style={{ height: `${(r.value / max) * (height - 22)}px` }} />
            </div>
            <span className="viz-col-label">{r.label}</span>
          </div>
        ))}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Day-of-week x hour heatmap on the sequential blue ramp (light = few orders, dark = many). */
export function Heatmap({ grid }: { grid: number[][] }) {
  const [tip, setTip] = useState<Tip>(null);
  const box = useRef<HTMLDivElement>(null);
  const max = Math.max(0, ...grid.flat());
  const color = (v: number) => (v <= 0 ? VIZ.none : VIZ.ramp[Math.min(VIZ.ramp.length - 1, Math.floor((v / max) * (VIZ.ramp.length - 1)))]);
  const show = (d: number, h: number, el: HTMLElement) => {
    const b = box.current?.getBoundingClientRect(); const e = el.getBoundingClientRect();
    setTip({ x: Math.max(0, Math.min((b ? e.left - b.left : 0) - 60, (b?.width ?? 400) - 180)), y: (b ? e.top - b.top : 0) + 22, title: `${DOW[d]} ${String(h).padStart(2, '0')}:00–${String(h).padStart(2, '0')}:59`, rows: [{ value: fmtInt(grid[d][h]), label: 'orders' }] });
  };
  const legend = useMemo(() => [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * max)), [max]);
  return (
    <div className="viz-wrap" ref={box}>
      <div className="viz-heat" role="grid" aria-label="Orders by day and hour">
        <span />
        {Array.from({ length: 24 }, (_, h) => <span key={h} className="viz-heat-h">{h % 3 === 0 ? h : ''}</span>)}
        {grid.map((row, d) => (
          <div key={d} className="viz-heat-row" role="row">
            <span className="viz-heat-d">{DOW[d]}</span>
            {row.map((v, h) => (
              <span key={h} role="gridcell" tabIndex={0} aria-label={`${DOW[d]} ${h}h: ${v} orders`} className="viz-heat-cell" style={{ background: color(v) }}
                onPointerEnter={(e) => show(d, h, e.currentTarget)} onPointerLeave={() => setTip(null)} onFocus={(e) => show(d, h, e.currentTarget)} onBlur={() => setTip(null)} />
            ))}
          </div>
        ))}
      </div>
      <div className="viz-heat-legend small">
        <span>fewer</span>
        {legend.map((v, i) => <span key={i} className="viz-heat-swatch" style={{ background: color(v) }} title={`${v} orders`} />)}
        <span>more (max {fmtInt(max)} orders in one hour slot)</span>
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

/** Stat tile: label · value · signed delta vs the previous period (icon + sign, never color alone). */
export function StatTile({ label, value, change, previous, upIsGood = true, hero, note }: {
  label: string; value: string; change?: number; previous?: string; upIsGood?: boolean; hero?: boolean; note?: string;
}) {
  const dir = change === undefined || change === 0 ? 0 : change > 0 ? 1 : -1;
  const good = dir === 0 ? null : (dir > 0) === upIsGood;
  return (
    <div className={`viz-stat ${hero ? 'hero' : ''}`}>
      <div className="viz-stat-label">{label}</div>
      <div className="viz-stat-value">{value}</div>
      {change !== undefined && (
        <div className="viz-stat-delta" style={{ color: good === null ? VIZ.ink2 : good ? VIZ.good : VIZ.bad }}>
          {dir > 0 ? '▲' : dir < 0 ? '▼' : '■'} {change > 0 ? '+' : ''}{change.toFixed(1)}% <span className="viz-stat-prev">vs {previous ?? 'previous period'}</span>
        </div>
      )}
      {note && <div className="viz-stat-prev">{note}</div>}
    </div>
  );
}
