'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, CHANNEL_OPTIONS, FilterBar, Modal, MultiPick, Section, useCatalog, useFilters } from '../ui';

type Report = { key: string; title: string; description: string };
type Schedule = { id: string; report: string; frequency: 'daily' | 'weekly' | 'monthly'; emails: string[]; format: 'csv' | 'xlsx'; filter: { locationCodes?: string[]; channels?: string[]; brands?: string[] }; createdBy: string; lastSentAt?: string; lastError?: string | null };
type Preview = { title: string; columns: string[]; rows: Array<Array<string | number>>; total: number };

const FREQ: Record<string, string> = { daily: 'Daily — yesterday, sent each morning', weekly: 'Weekly — last Mon–Sun, sent Monday morning', monthly: 'Monthly — last month, sent on the 1st' };

// Reports (Atlas Reports): 7 standard reports, CSV or Excel, emailed now or on a schedule.
export default function ReportsPage() {
  const { filters, set, query } = useFilters('yesterday');
  const { brands, activeLocations, locName } = useCatalog();
  const [reports, setReports] = useState<Report[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [emailOn, setEmailOn] = useState(false);
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState<{ key: string; data: Preview | null } | null>(null);
  const [emailFor, setEmailFor] = useState<Report | null>(null);
  const [schedFor, setSchedFor] = useState<Report | null>(null);

  const load = useCallback(() => api<{ reports: Report[]; schedules: Schedule[]; emailConfigured: boolean }>('/api/food-hub/reports')
    .then((d) => { setReports(d.reports); setSchedules(d.schedules); setEmailOn(d.emailConfigured); }).catch((e) => setMsg(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function showPreview(key: string) {
    setPreview({ key, data: null });
    try { setPreview({ key, data: await api<Preview>(`/api/food-hub/reports/${key}?format=json&limit=20&${query}`) }); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); setPreview(null); }
  }

  async function removeSchedule(id: string) {
    if (!window.confirm('Stop this scheduled email?')) return;
    try { await api(`/api/food-hub/reports/schedules?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); load(); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  }

  const titleOf = (key: string) => reports.find((r) => r.key === key)?.title ?? key;

  return (
    <div>
      <div className="fh-head">
        <div>
          <h1>Reports</h1>
          <div className="small">Download any report for the period and filters below, email it now, or have it emailed every day, week or month.</div>
        </div>
      </div>
      {!emailOn && <div className="fh-banner warn">Email is not set up yet — downloads work, but “Email” and schedules need RESEND_API_KEY and REPORT_EMAIL_FROM (run npm run food-hub:setup).</div>}
      {msg && <div className="fh-banner info">{msg}</div>}
      <FilterBar filters={filters} set={set} brands={brands.filter((b) => b.active).map((b) => b.name)} locations={activeLocations} />

      <div className="fh-report-grid">
        {reports.map((r) => (
          <div key={r.key} className="card fh-report">
            <h2>{r.title}</h2>
            <p className="small">{r.description}</p>
            <div className="fh-row" style={{ marginTop: 'auto' }}>
              <a className="button btn-sm" href={`/api/food-hub/reports/${r.key}?format=xlsx&${query}`}>Excel</a>
              <a className="button btn-sm btn-light" href={`/api/food-hub/reports/${r.key}?format=csv&${query}`}>CSV</a>
              <button className="btn-sm btn-light" onClick={() => showPreview(r.key)}>Preview</button>
              <button className="btn-sm btn-light" disabled={!emailOn} onClick={() => setEmailFor(r)}>Email</button>
              <button className="btn-sm btn-light" disabled={!emailOn} onClick={() => setSchedFor(r)}>Schedule</button>
            </div>
          </div>
        ))}
      </div>

      <Section title={`Scheduled emails (${schedules.length})`}>
        <table>
          <thead><tr><th>Report</th><th>When</th><th>To</th><th>Filters</th><th>Last sent</th><th></th></tr></thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id}>
                <td>{titleOf(s.report)} <span className="small">({s.format.toUpperCase()})</span></td>
                <td className="small">{FREQ[s.frequency]}</td>
                <td className="small">{s.emails.join(', ')}</td>
                <td className="small">{[s.filter.locationCodes?.map(locName).join(', '), s.filter.channels?.join(', '), s.filter.brands?.join(', ')].filter(Boolean).join(' · ') || 'Everything'}</td>
                <td className="small">{s.lastSentAt ? new Date(s.lastSentAt).toLocaleString('fr-CA') : 'not yet'}{s.lastError ? <><br /><span className="badge badge-red" title={s.lastError}>last attempt failed</span></> : null}</td>
                <td><button className="btn-sm btn-light" onClick={() => removeSchedule(s.id)}>Stop</button></td>
              </tr>
            ))}
            {schedules.length === 0 && <tr><td colSpan={6} className="small">No scheduled reports. Use “Schedule” on any report.</td></tr>}
          </tbody>
        </table>
        <p className="small">Scheduled reports go out after 8:00 (Montréal) via the daily /api/food-hub/cron/reports job (server cron with Authorization: Bearer CRON_SECRET — see docs/FOOD_HUB.md).</p>
      </Section>

      {preview && (
        <Modal title={preview.data?.title ?? 'Loading…'} wide onClose={() => setPreview(null)}>
          {!preview.data ? <p className="small">Loading…</p> : (
            <>
              <p className="small">First {preview.data.rows.length} of {preview.data.total} rows.</p>
              <div className="fh-table-wrap" style={{ maxHeight: '60vh' }}>
                <table>
                  <thead><tr>{preview.data.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>{preview.data.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="small">{String(v ?? '')}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </Modal>
      )}
      {emailFor && <EmailDialog report={emailFor} query={query} onClose={() => setEmailFor(null)} onDone={(m) => { setMsg(m); setEmailFor(null); }} />}
      {schedFor && <ScheduleDialog report={schedFor} locations={activeLocations.map((l) => [l.code, l.name] as [string, string])} brands={brands.filter((b) => b.active).map((b) => [b.name, b.name] as [string, string])} onClose={() => setSchedFor(null)} onDone={(m) => { setMsg(m); setSchedFor(null); load(); }} />}
    </div>
  );
}

function EmailDialog({ report, query, onClose, onDone }: { report: Report; query: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [emails, setEmails] = useState('');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function send() {
    setBusy(true); setErr('');
    try {
      const r = await api<{ message: string; rows: number }>('/api/food-hub/reports/email', { method: 'POST', json: { report: report.key, emails, format, query: Object.fromEntries(new URLSearchParams(query)) } });
      onDone(`${report.title} (${r.rows} rows) — ${r.message}`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return (
    <Modal title={`Email “${report.title}”`} onClose={onClose}>
      <div className="fh-col-form">
        <label>To (comma-separated)<input style={{ width: '100%' }} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="owner@example.com, accountant@example.com" /></label>
        <label>Format <select value={format} onChange={(e) => setFormat(e.target.value as 'xlsx' | 'csv')}><option value="xlsx">Excel</option><option value="csv">CSV</option></select></label>
        <p className="small">Uses the period and filters currently selected on the page.</p>
        {err && <div className="fh-banner warn">{err}</div>}
        <div className="fh-row" style={{ justifyContent: 'flex-end' }}><button className="btn-light" onClick={onClose}>Cancel</button><button disabled={busy || !emails.trim()} onClick={send}>{busy ? 'Sending…' : 'Send'}</button></div>
      </div>
    </Modal>
  );
}

function ScheduleDialog({ report, locations, brands, onClose, onDone }: { report: Report; locations: Array<[string, string]>; brands: Array<[string, string]>; onClose: () => void; onDone: (msg: string) => void }) {
  const [emails, setEmails] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [locationCodes, setLocations] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [brandSel, setBrands] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function save() {
    setBusy(true); setErr('');
    try {
      await api('/api/food-hub/reports/schedules', { method: 'POST', json: { report: report.key, emails, frequency, format, locationCodes, channels, brands: brandSel } });
      onDone(`${report.title} will be emailed ${frequency}.`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return (
    <Modal title={`Schedule “${report.title}”`} onClose={onClose}>
      <div className="fh-col-form">
        <label>Send to (comma-separated)<input style={{ width: '100%' }} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="owner@example.com" /></label>
        <label>How often <select value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>{Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Format <select value={format} onChange={(e) => setFormat(e.target.value as 'xlsx' | 'csv')}><option value="xlsx">Excel</option><option value="csv">CSV</option></select></label>
        <div className="fh-row">
          <MultiPick label="Locations" options={locations} value={locationCodes} onChange={setLocations} />
          <MultiPick label="Platforms" options={CHANNEL_OPTIONS} value={channels} onChange={setChannels} />
          <MultiPick label="Brands" options={brands} value={brandSel} onChange={setBrands} />
        </div>
        {err && <div className="fh-banner warn">{err}</div>}
        <div className="fh-row" style={{ justifyContent: 'flex-end' }}><button className="btn-light" onClick={onClose}>Cancel</button><button disabled={busy || !emails.trim()} onClick={save}>{busy ? 'Saving…' : 'Save schedule'}</button></div>
      </div>
    </Modal>
  );
}
