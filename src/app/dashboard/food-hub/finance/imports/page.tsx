'use client';

// Statements — import the payout reports each platform gives you (CSV or Excel), or let Uber send its own (RC9).
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { api, Modal, useMe } from '@/app/dashboard/food-hub/ui';
import { CH_NAME, FinanceError, FinanceHead, cad, day, toBase64 } from '../finance-ui';

type Imp = { id: string; channel: string; fileName: string; format: string; rows: number; lines: number; newLines: number; skipped: number; totalNet: number; periodFrom: string | null; periodTo: string | null; importedBy: string; importedAt: string; source: string };
type Mapping = Record<string, number | number[] | undefined>;
type Ask = { needsMapping: true; headers: string[]; sample: string[][]; mapping: Mapping; format: string; channel: string | null; message: string };
type UberReq = { id: string; workflowId: string | null; from: string; to: string; status: 'requested' | 'imported' | 'failed'; message: string; requestedBy: string; at: string };

const FORMAT: Record<string, string> = { uber_payment_details: 'Uber Eats Payment details', doordash_transactions: 'DoorDash transactions', generic: 'Your columns' };
const REQUIRED = ['orderRef', 'net'];

const WHERE: Array<[string, string]> = [
  ['Uber Eats', 'Uber Eats Manager → Payments → download the “Payment details” report (CSV) for the period. Food Hub recognises its columns automatically, including GST and QST. Or use “Request from Uber” below and it arrives by itself.'],
  ['DoorDash', 'DoorDash Merchant Portal → Financials → export the transactions (or payout details) as CSV. Recognised automatically.'],
  ['SkipTheDishes', 'Skip Restaurant Portal → your statements / payment reports → export as CSV or Excel. The first time, confirm which column is the order number and which is the net amount — Food Hub remembers it.'],
  ['Too Good To Go', 'Too Good To Go Store app or portal → payouts / invoices → export. Confirm the columns once. Daily bag counts go in Food Hub → TGTG bags.'],
];

export default function ImportsPage() {
  const { can } = useMe();
  const edit = can('finance:edit');
  const [imports, setImports] = useState<Imp[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [requests, setRequests] = useState<UberReq[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [channel, setChannel] = useState('');
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<{ file: File; base64: string; data: Ask } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uber, setUber] = useState(() => { const t = new Date(); const f = new Date(t); f.setDate(t.getDate() - 7); const ymd = (d: Date) => d.toISOString().slice(0, 10); return { from: ymd(f), to: ymd(t) }; });

  const load = useCallback(async () => {
    try {
      const [i, u] = await Promise.all([
        api<{ imports: Imp[]; fields: Record<string, string> }>('/api/food-hub/recon/imports'),
        api<{ requests: UberReq[] }>('/api/food-hub/recon/uber-report'),
      ]);
      setImports(i.imports.sort((a, b) => b.importedAt.localeCompare(a.importedAt))); setFields(i.fields); setRequests(u.requests.sort((a, b) => b.at.localeCompare(a.at))); setErr('');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function send(file: File, base64: string, extra: { channel?: string; mapping?: Mapping } = {}) {
    setBusy(true); setMsg('');
    try {
      const r = await api<{ imported: boolean; import?: Imp; cases?: { opened: number; closed: number } } & Partial<Ask>>('/api/food-hub/recon/imports', { method: 'POST', json: { fileName: file.name, contentBase64: base64, channel: extra.channel ?? (channel || undefined), mapping: extra.mapping } });
      if (!r.imported) { setAsk({ file, base64, data: r as Ask }); return; }
      setAsk(null);
      const i = r.import!;
      setMsg(`${CH_NAME[i.channel] ?? i.channel}: ${i.lines} line(s) read, ${i.newLines} new${i.lines !== i.newLines ? ' (the others were already imported)' : ''} — ${cad(i.totalNet)} net${i.periodFrom ? `, ${day(i.periodFrom)} → ${day(i.periodTo)}` : ''}.${r.cases ? ` ${r.cases.opened} new problem(s) to check, ${r.cases.closed} fixed.` : ''}`);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { setMsg('File too large (max 15 MB).'); return; }
    if (!/\.(csv|txt|tsv|xlsx)$/i.test(file.name)) { setMsg('Choose a CSV or Excel (.xlsx) file. For a PDF statement, export the CSV version from the platform portal.'); return; }
    await send(file, await toBase64(file));
  }

  async function remove(i: Imp) {
    if (!window.confirm(`Remove ${i.fileName} and its ${i.lines} line(s)? Orders will be re-checked without it.`)) return;
    try { await api(`/api/food-hub/recon/imports?id=${encodeURIComponent(i.id)}`, { method: 'DELETE' }); setMsg(`Removed ${i.fileName}.`); await load(); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  }

  async function requestUber() {
    setBusy(true); setMsg('');
    try {
      const r = await api<{ request: UberReq }>('/api/food-hub/recon/uber-report', { method: 'POST', json: uber });
      setMsg(`Uber Eats is preparing the payment report for ${uber.from} → ${uber.to}. It is imported automatically when Uber sends it (usually within minutes). ${r.request.message}`);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  return (
    <div>
      <FinanceHead title="Statements" intro="Import the payout statements each platform gives you. The same line imported twice is only counted once, so overlapping files are safe. Every import re-checks your orders and opens or closes dispute cases." />
      <FinanceError message={err} />
      {msg && <div className="fh-banner info" role="status">{msg}</div>}

      <div className="viz-grid2" style={{ marginBottom: 16 }}>
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: 17 }}>Import a statement</h2>
          {!edit && <p className="small">Your role can view statements but not import them.</p>}
          <div className="fh-row" style={{ flexWrap: 'wrap' }}>
            <label className="small">Platform{' '}
              <select value={channel} onChange={(e) => setChannel(e.target.value)} disabled={!edit}>
                <option value="">Detect automatically</option>
                {Object.entries(CH_NAME).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={!edit || busy} onChange={(e) => pick(e.target.files?.[0])} aria-label="Statement file" />
          </div>
          <p className="small">CSV or Excel (.xlsx), up to 15 MB. Uber Eats “Payment details” and DoorDash transaction exports are recognised automatically; any other file asks you once which column is which.</p>
          {busy && <p className="small">Reading the file…</p>}
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: 17 }}>Request from Uber Eats</h2>
          <p className="small">Uber’s Reporting API builds the Payment details report for all your Uber Eats stores and sends it to Food Hub, which imports it by itself. Needs the Uber app to have the <span className="fh-mono">eats.report</span> scope.</p>
          <div className="fh-row">
            <input type="date" value={uber.from} onChange={(e) => setUber({ ...uber, from: e.target.value })} aria-label="From" disabled={!edit} />
            <span className="small">to</span>
            <input type="date" value={uber.to} onChange={(e) => setUber({ ...uber, to: e.target.value })} aria-label="To" disabled={!edit} />
            <button className="btn-sm" disabled={!edit || busy} onClick={requestUber}>Request from Uber</button>
          </div>
          {requests.length > 0 && (
            <table className="fin-table" style={{ marginTop: 10 }}>
              <thead><tr><th>Asked</th><th>Period</th><th>Status</th></tr></thead>
              <tbody>
                {requests.slice(0, 5).map((r) => (
                  <tr key={r.id}><td className="small">{new Date(r.at).toLocaleString('en-CA')}<br />{r.requestedBy}</td><td className="small">{r.from} → {r.to}</td>
                    <td><span className={`badge ${r.status === 'imported' ? 'badge-green' : r.status === 'failed' ? 'badge-red' : 'badge-yellow'}`}>{r.status === 'imported' ? '✓ Imported' : r.status === 'failed' ? '✕ Failed' : '◷ Waiting for Uber'}</span><div className="small" style={{ whiteSpace: 'normal' }}>{r.message}</div></td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Imported statements ({imports.length})</h2>
        <div className="fh-table-wrap">
          <table className="fin-table">
            <thead><tr><th>Imported</th><th>Platform</th><th>File</th><th>Format</th><th>Period</th><th className="num">Lines</th><th className="num">Net</th><th>Source</th><th></th></tr></thead>
            <tbody>
              {imports.map((i) => (
                <tr key={i.id}>
                  <td className="small">{new Date(i.importedAt).toLocaleString('en-CA')}<br />{i.importedBy}</td>
                  <td>{CH_NAME[i.channel] ?? i.channel}</td>
                  <td className="small" style={{ whiteSpace: 'normal', maxWidth: 260 }}>{i.fileName}</td>
                  <td className="small">{FORMAT[i.format] ?? i.format}</td>
                  <td className="small">{i.periodFrom ? `${day(i.periodFrom)} → ${day(i.periodTo)}` : '—'}</td>
                  <td className="num">{i.lines}{i.newLines !== i.lines ? <span className="small"> ({i.newLines} new)</span> : null}{i.skipped ? <span className="small"> · {i.skipped} skipped</span> : null}</td>
                  <td className="num">{cad(i.totalNet)}</td>
                  <td className="small">{i.source === 'uber_reporting_api' ? 'Uber Reporting API' : 'Upload'}</td>
                  <td>{edit && <button className="btn-sm btn-light" onClick={() => remove(i)}>Remove</button>}</td>
                </tr>
              ))}
              {imports.length === 0 && <tr><td colSpan={9} className="small">No statement imported yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Where to download each statement</h2>
        <div className="fin-help">
          {WHERE.map(([t, d]) => <div key={t}><h3>{t}</h3>{d}</div>)}
        </div>
        <p className="small">Menu names in the platform portals change from time to time — look for “payments”, “payouts”, “statements” or “financials”, and choose the CSV / Excel export with one line per order.</p>
      </section>

      {ask && <MappingDialog ask={ask.data} fileName={ask.file.name} fields={fields} defaultChannel={channel} busy={busy} onClose={() => setAsk(null)} onSubmit={(ch, m) => send(ask.file, ask.base64, { channel: ch, mapping: m })} />}
    </div>
  );
}

function MappingDialog({ ask, fileName, fields, defaultChannel, busy, onClose, onSubmit }: { ask: Ask; fileName: string; fields: Record<string, string>; defaultChannel: string; busy: boolean; onClose: () => void; onSubmit: (channel: string, m: Mapping) => void }) {
  const [ch, setCh] = useState(ask.channel ?? defaultChannel ?? '');
  const [map, setMap] = useState<Mapping>(ask.mapping ?? {});
  const first = (v: number | number[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const netOk = first(map.net) !== undefined || first(map.sales) !== undefined;
  return (
    <Modal title="Confirm the columns" onClose={onClose} wide>
      <p className="small">{ask.message} <strong>{fileName}</strong> — Food Hub remembers your answer for files with the same columns.</p>
      <div className="fin-sample" style={{ marginBottom: 12 }}>
        <table>
          <thead><tr>{ask.headers.map((h, i) => <th key={i}>{h || `Column ${i + 1}`}</th>)}</tr></thead>
          <tbody>{ask.sample.map((r, i) => <tr key={i}>{ask.headers.map((_, j) => <td key={j}>{r[j] ?? ''}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="fh-row" style={{ marginBottom: 10 }}>
        <label htmlFor="map-ch"><strong>Platform *</strong></label>
        <select id="map-ch" value={ch} onChange={(e) => setCh(e.target.value)}>
          <option value="">Choose…</option>
          {Object.entries(CH_NAME).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div className="fin-map fin-map-2">
        {Object.entries(fields).map(([k, label]) => (
          <Fragment key={k}>
            <label htmlFor={`map-${k}`}>{label}{REQUIRED.includes(k) ? ' *' : ''}</label>
            <select id={`map-${k}`} value={first(map[k]) ?? ''} onChange={(e) => setMap({ ...map, [k]: e.target.value === '' ? undefined : Number(e.target.value) })}>
              <option value="">— not in this file —</option>
              {ask.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
            </select>
          </Fragment>
        ))}
      </div>
      <div className="fh-row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
        {(!ch || first(map.orderRef) === undefined || !netOk) && <span className="small">Choose the platform, the order column and the net payout column.</span>}
        <button className="btn-light" onClick={onClose}>Cancel</button>
        <button disabled={busy || !ch || first(map.orderRef) === undefined || !netOk} onClick={() => onSubmit(ch, map)}>{busy ? 'Importing…' : 'Import'}</button>
      </div>
    </Modal>
  );
}

