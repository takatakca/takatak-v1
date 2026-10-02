'use client';

import { useState } from 'react';
import { api, Modal, Section, useCatalog } from '../ui';

type LocDraft = { code: string; name: string; address: string; city: string; postalCode: string; active: boolean; isNew: boolean };

// Brands & locations (Atlas "Locations & brands"): the business structure every other screen uses.
export default function BusinessPage() {
  const { locations, brands, reload } = useCatalog();
  const [loc, setLoc] = useState<LocDraft | null>(null);
  const [newBrand, setNewBrand] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function saveLocation() {
    if (!loc) return;
    setErr('');
    try {
      await api('/api/food-hub/catalog', { method: 'POST', json: { location: loc } });
      setMsg(`Location ${loc.code} saved.`); setLoc(null); reload();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  async function saveBrand(name: string, active: boolean) {
    try { await api('/api/food-hub/catalog', { method: 'POST', json: { brand: { name, active } } }); setMsg(`Brand ${name} ${active ? 'saved' : 'deactivated'}.`); setNewBrand(''); reload(); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div>
      <div className="fh-head">
        <div>
          <h1>Brands & locations</h1>
          <div className="small">Quadro Holdings LTEE. Locations and brands here drive the Command Center matrix, store mapping, hours, users and reports.</div>
        </div>
      </div>
      {msg && <div className="fh-banner info">{msg}</div>}

      <Section title={`Locations (${locations.length})`} right={<button className="btn-sm" onClick={() => { setErr(''); setLoc({ code: '', name: '', address: '', city: 'Montréal', postalCode: '', active: true, isNew: true }); }}>Add location</button>}>
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Address</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.code}>
                <td className="fh-mono">{l.code}</td>
                <td><strong>{l.name}</strong></td>
                <td className="small">{l.address}{l.city ? `, ${l.city}` : ''}</td>
                <td><span className={`badge ${l.active ? 'badge-green' : 'badge-red'}`}>{l.active ? 'active' : 'inactive'}</span></td>
                <td><button className="btn-sm btn-light" onClick={() => { setErr(''); setLoc({ code: l.code, name: l.name, address: l.address, city: l.city ?? '', postalCode: (l as any).postalCode ?? '', active: l.active, isNew: false }); }}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={`Brands (${brands.filter((b) => b.active).length} active)`} right={<div className="fh-row"><input placeholder="New brand name" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} /><button className="btn-sm" disabled={!newBrand.trim()} onClick={() => saveBrand(newBrand.trim(), true)}>Add brand</button></div>}>
        <div className="fh-brand-list">
          {brands.map((b) => (
            <span key={b.name} className={`fh-brand ${b.active ? '' : 'off'}`}>
              {b.name}
              <button className="btn-sm btn-light" onClick={() => saveBrand(b.name, !b.active)} title={b.active ? 'Hide from new screens (history is kept)' : 'Use again'}>{b.active ? 'Deactivate' : 'Activate'}</button>
            </span>
          ))}
        </div>
        <p className="small">Too Good To Go is a sales channel, not a brand — it is set up under Channels and Stores.</p>
      </Section>

      {loc && (
        <Modal title={loc.isNew ? 'Add location' : `Edit ${loc.code}`} onClose={() => setLoc(null)}>
          <div className="fh-col-form">
            <label>Code (A–Z, 0–9, _)<input style={{ width: '100%' }} value={loc.code} disabled={!loc.isNew} onChange={(e) => setLoc({ ...loc, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} placeholder="e.g. VERDUN" /></label>
            <label>Name<input style={{ width: '100%' }} value={loc.name} onChange={(e) => setLoc({ ...loc, name: e.target.value })} placeholder="VERDUN — 1234 Wellington" /></label>
            <label>Street address<input style={{ width: '100%' }} value={loc.address} onChange={(e) => setLoc({ ...loc, address: e.target.value })} /></label>
            <div className="fh-row"><label style={{ flex: 1 }}>City<input style={{ width: '100%' }} value={loc.city} onChange={(e) => setLoc({ ...loc, city: e.target.value })} /></label><label>Postal code<input value={loc.postalCode} onChange={(e) => setLoc({ ...loc, postalCode: e.target.value.toUpperCase() })} /></label></div>
            <label className="fh-row"><input type="checkbox" checked={loc.active} onChange={(e) => setLoc({ ...loc, active: e.target.checked })} /> Active</label>
            {err && <div className="fh-banner warn">{err}</div>}
            <div className="fh-row" style={{ justifyContent: 'flex-end' }}><button className="btn-light" onClick={() => setLoc(null)}>Cancel</button><button disabled={!loc.code || !loc.name} onClick={saveLocation}>Save</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
