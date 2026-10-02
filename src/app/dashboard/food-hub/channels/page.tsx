'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ModeBanner, Section, StatusBadge } from '../ui';

type Channel = {
  channel: string; label: string; configured: boolean; canSend: boolean; missing: string[]; note: string; webhookUrl: string;
  extraWebhooks: Array<{ label: string; url: string }>;
  handoff: Array<{ label: string; envKey: string; set: boolean; value?: string }>;
};
type Data = {
  mode: string; liveEnabled: boolean; dashboardProtected: boolean;
  clover: { configured: boolean; injectionEnabled: boolean; missing: string[]; note: string; webhookUrl: string; webhookAuthSet: boolean; verification: { code: string; at: string } | null; recordPayments: boolean; orderTypes: boolean; inventorySync: boolean };
  channels: Channel[]; jobs: any[]; unparsed: any[];
};

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return <button className="btn-sm btn-light" onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>{done ? 'Copied' : 'Copy'}</button>;
}

export default function ChannelsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(false);
  const load = useCallback((reveal = false) => api<Data>(`/api/food-hub/channels${reveal ? '?reveal=1' : ''}`).then((d) => { setData(d); setRevealed(reveal); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (!data) return <div><h1>Channels</h1>{error ? <div className="fh-banner warn">{error}</div> : <p className="small">Loading…</p>}</div>;

  return (
    <div>
      <div className="fh-head">
        <div>
          <h1>Channels &amp; Setup</h1>
          <div className="small">Your own direct connections — no aggregator. Give each platform the URLs and secrets below; credentials go in the server environment with <span className="fh-mono">npm run food-hub:setup</span>, never in chat.</div>
        </div>
        <div className="fh-row">
          <button className="btn-light" onClick={() => load(!revealed)}>{revealed ? 'Hide secrets' : 'Show secrets to give platforms'}</button>
          <button className="btn-light" onClick={() => load(revealed)}>Refresh</button>
        </div>
      </div>
      <ModeBanner mode={data.mode} />
      {!data.liveEnabled && <div className="fh-banner warn">Live connectors are OFF (LIVE_CONNECTORS_GLOBAL_ENABLED). Orders are still received, but nothing is sent to platforms until you switch it on.</div>}

      <Section title="Clover POS (order injection + menu import)" right={data.clover.configured ? <span className="badge badge-green">Connected</span> : <span className="badge badge-yellow">Not configured</span>}>
        <p className="small" style={{ margin: 0 }}>{data.clover.note}{!data.clover.injectionEnabled && ' Injection is turned OFF (FOODHUB_POS_INJECTION=off).'}</p>
        <ul className="small" style={{ margin: '8px 0 0' }}>
          <li>Delivery orders recorded as <strong>paid</strong> with a tender per platform (Uber Eats, DoorDash, SkipTheDishes, Too Good To Go) when they leave the kitchen; orders cancelled before that are removed from the register: {data.clover.recordPayments ? 'on' : 'off (FOODHUB_CLOVER_RECORD_PAYMENT=off)'}</li>
          <li>Order type per platform on every Clover order: {data.clover.orderTypes ? 'on' : 'off (FOODHUB_CLOVER_ORDER_TYPES=off)'}</li>
          <li>Out of stock in Clover → 86 on every platform, Clover price changes flagged: {data.clover.inventorySync ? 'on (checked every sync; instant with webhooks below)' : 'off (FOODHUB_CLOVER_INVENTORY_SYNC=off)'}</li>
        </ul>
        <dl className="fh-kv" style={{ marginTop: 10 }}>
          <dt>Clover webhook URL</dt><dd className="fh-mono">{data.clover.webhookUrl}</dd>
          <dt>Events to subscribe</dt><dd>Inventory</dd>
          <dt>Verification code</dt><dd>{data.clover.verification ? <><span className="fh-mono">{data.clover.verification.code}</span> <span className="small">— paste it in the Clover developer dashboard (received {new Date(data.clover.verification.at).toLocaleString('fr-CA')})</span></> : <span className="small">Appears here after you save the URL in Clover.</span>}</dd>
          <dt>X-Clover-Auth code</dt><dd>{data.clover.webhookAuthSet ? <span className="badge badge-green">set</span> : <span className="small">Copy the auth code Clover shows into CLOVER_WEBHOOK_AUTH (npm run food-hub:setup).</span>}</dd>
        </dl>
      </Section>

      <div className="grid grid-2">
        {data.channels.map((c) => (
          <div key={c.channel} className="card">
            <div className="fh-head" style={{ marginBottom: 8 }}>
              <strong>{c.label}</strong>
              {c.channel === 'tgtg'
                ? (c.configured ? <span className="badge badge-blue">Inbound only</span> : <span className="badge badge-yellow">Optional</span>)
                : c.canSend ? <span className="badge badge-green">Live</span> : c.configured ? <span className="badge badge-yellow">Ready, not live</span> : <span className="badge badge-red">Needs setup</span>}
            </div>
            <p className="small">{c.note}</p>
            <div className="small">{c.extraWebhooks.length ? 'Order webhook URL' : 'Webhook URL'}</div>
            <div className="fh-row"><span className="fh-mono">{c.webhookUrl}</span><Copy text={c.webhookUrl} /></div>
            {c.extraWebhooks.map((w) => (
              <div key={w.url} style={{ marginTop: 6 }}>
                <div className="small">{w.label}</div>
                <div className="fh-row"><span className="fh-mono">{w.url}</span><Copy text={w.url} /></div>
              </div>
            ))}
            {c.handoff.map((h) => (
              <div key={h.envKey} style={{ marginTop: 6 }}>
                <div className="small">{h.label}</div>
                {!h.set ? <span className="badge badge-red">Not generated — run npm run food-hub:setup</span>
                  : h.value ? <div className="fh-row"><span className="fh-mono">{h.value}</span><Copy text={h.value} /></div>
                  : <span className="fh-mono small">•••••••• (Show secrets)</span>}
              </div>
            ))}
          </div>
        ))}
      </div>

      <Section title="Recent channel jobs">
        {data.jobs.length === 0 ? <p className="small">No menu, item or store actions yet.</p> : (
          <table>
            <thead><tr><th>When</th><th>Kind</th><th>Channel</th><th>Status</th><th>Detail</th></tr></thead>
            <tbody>{data.jobs.map((j) => (
              <tr key={j.id}><td className="small">{new Date(j.createdAt).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}</td><td>{j.kind}</td><td>{j.channel}</td><td><StatusBadge status={j.status === 'error' ? 'error' : j.status} /></td><td className="small">{j.result?.message || ''}{j.reference ? ` · ref ${j.reference}` : ''}</td></tr>
            ))}</tbody>
          </table>
        )}
      </Section>

      {data.unparsed.length > 0 && (
        <Section title={`Unparsed webhook payloads (${data.unparsed.length})`}>
          <p className="small">These arrived but did not match a known order shape. Nothing was lost — send one to your developer to finalize the parser.</p>
          {data.unparsed.slice(0, 5).map((j) => <pre key={j.id} style={{ maxHeight: 200 }}>{JSON.stringify(j.request?.body, null, 2)}</pre>)}
        </Section>
      )}
    </div>
  );
}
