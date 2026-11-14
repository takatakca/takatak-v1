'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fullWeekUi, Marketplace, Modal, ResultsTable, Section, StatusBadge, useCatalog, useMe, WeekEditor, weekProblems, type Week } from '../ui';

type Item = {
  ref: string; name: string; description?: string; nameFr?: string; descriptionFr?: string; tags?: string[]; allergens?: string[]; calories?: number; price: number; imageUrl?: string;
  categoryRef: string; available: boolean; posItemRef?: string; channelPrices?: Record<string, number>; modifierGroupRefs: string[];
};
type Mod = { ref: string; name: string; nameFr?: string; price: number; available: boolean; posModifierRef?: string };
type Group = { ref: string; name: string; nameFr?: string; min: number; max: number; modifiers: Mod[] };
type Category = { ref: string; name: string; nameFr?: string; sortOrder: number; hours?: Week | null };
type PriceChange = { brandName: string; ref: string; name: string; foodhubPrice: number; cloverPrice: number; at: string };
type Languages = { uber_eats: string; doordash: string; skip: string };
const LANG_LABEL: Record<string, string> = { en: 'English', fr: 'Français', both: 'Français / English' };
type Menu = { brandName: string; categories: Category[]; items: Item[]; modifierGroups: Group[]; updatedAt: string; [k: string]: unknown };
type Issue = { level: 'error' | 'warning' | 'tip'; code: string; message: string; ref?: string };
type Check = { ok: boolean; errors: Issue[]; warnings: Issue[]; tips: Issue[] };
type StoreStatus = { storeId: string; channel: string; locationCode: string; channelStoreId: string; status: string; at: string | null; message: string | null };
type Scheduled = { id: string; at: string; status: string; createdBy: string; storeIds?: string[]; result?: string };

const PRICE_CHANNELS: Array<[string, string]> = [['uber_eats', 'Uber'], ['doordash', 'DoorDash'], ['skip', 'Skip']];
const TAGS: Array<[string, string]> = [['vegetarian', 'Vegetarian'], ['vegan', 'Vegan'], ['gluten_free', 'Gluten-free'], ['spicy', 'Spicy'], ['halal', 'Halal'], ['alcohol', 'Contains alcohol']];
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export default function MenuPage() {
  const { locName } = useCatalog();
  const { can } = useMe();
  const [brands, setBrands] = useState<string[]>([]);
  const [brand, setBrand] = useState('');
  const [menu, setMenu] = useState<Menu | null>(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [newCat, setNewCat] = useState('');
  const [check, setCheck] = useState<Check | null>(null);
  const [stores, setStores] = useState<StoreStatus[]>([]);
  const [scheduled, setScheduled] = useState<Scheduled[]>([]);
  const [showTips, setShowTips] = useState(false);
  const [editItem, setEditItem] = useState<string | null>(null);
  const [editHours, setEditHours] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [languages, setLanguages] = useState<Languages | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const editable = can('menu:edit');

  useEffect(() => {
    api<{ brands: string[] }>('/api/food-hub/menu').then((d) => { setBrands(d.brands); setBrand((b) => b || d.brands[0] || ''); }).catch((e) => setMsg(e.message));
  }, []);

  const loadStatus = useCallback(async (b: string) => {
    if (!b || !editable) return;
    const d = await api<{ check: Check | null; stores: StoreStatus[]; scheduled: Scheduled[] }>(`/api/food-hub/menu/publish?brand=${encodeURIComponent(b)}`).catch(() => null);
    if (d) { setCheck(d.check); setStores(d.stores); setScheduled(d.scheduled); }
  }, [editable]);

  const load = useCallback(async (b: string) => {
    if (!b) return;
    const d = await api<{ menu: Menu }>(`/api/food-hub/menu?brand=${encodeURIComponent(b)}`);
    setMenu(d.menu); setDirty(false); setResults([]);
    loadStatus(b);
  }, [loadStatus]);
  useEffect(() => { load(brand).catch((e) => setMsg(e.message)); }, [brand, load]);
  const loadPrices = useCallback(() => { if (brand) api<{ changes: PriceChange[] }>(`/api/food-hub/menu/clover-prices?brand=${encodeURIComponent(brand)}`).then((d) => setPriceChanges(d.changes)).catch(() => undefined); }, [brand]);
  useEffect(() => { loadPrices(); }, [loadPrices]);
  useEffect(() => { api<{ languages: Languages }>('/api/food-hub/menu/languages').then((d) => setLanguages(d.languages)).catch(() => undefined); }, []);
  async function resolvePrice(c: PriceChange, accept: boolean) {
    if (dirty && !window.confirm('You have unsaved changes — they will be reloaded. Continue?')) return;
    await run('price', async () => { await api('/api/food-hub/menu/clover-prices', { method: 'POST', json: { brand: c.brandName, ref: c.ref, accept } }); await load(brand); loadPrices(); setMsg(accept ? `${c.name} now ${c.cloverPrice.toFixed(2)} $ — publish to send it to the platforms.` : `Kept ${c.foodhubPrice.toFixed(2)} $ for ${c.name}.`); });
  }

  function update(fn: (m: Menu) => Menu) { setMenu((m) => (m ? fn(m) : m)); setDirty(true); }
  function updateItem(ref: string, patch: Partial<Item>) { update((m) => ({ ...m, items: m.items.map((i) => (i.ref === ref ? { ...i, ...patch } : i)) })); }
  function updateGroup(ref: string, patch: Partial<Group>) { update((m) => ({ ...m, modifierGroups: m.modifierGroups.map((g) => (g.ref === ref ? { ...g, ...patch } : g)) })); }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setMsg('');
    try { await fn(); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(''); }
  }

  const save = () => run('save', async () => {
    const d = await api<{ menu: Menu }>('/api/food-hub/menu', { method: 'PUT', json: { menu } });
    setMenu(d.menu); setDirty(false); setMsg('Saved. The checks below are now up to date.');
    loadStatus(brand);
  });
  const importClover = () => run('import', async () => {
    if (menu?.items.length && !window.confirm('Re-import from Clover? Names, prices and modifiers come from Clover; your platform prices, descriptions, photos, tags and category schedules are kept.')) return;
    const d = await api<{ menu: Menu; imported: { items: number; categories: number; modifierGroups: number } }>('/api/food-hub/menu/import', { method: 'POST', json: { brand } });
    setMenu(d.menu); setDirty(false);
    setMsg(`Imported ${d.imported.items} items, ${d.imported.categories} categories, ${d.imported.modifierGroups} modifier groups from Clover.`);
    loadStatus(brand);
  });

  function addCategory() {
    if (!newCat.trim()) return;
    update((m) => ({ ...m, categories: [...m.categories, { ref: `cat-${slug(newCat)}-${Date.now().toString(36)}`, name: newCat.trim(), sortOrder: m.categories.length }] }));
    setNewCat('');
  }
  function moveCategory(ref: string, dir: -1 | 1) {
    update((m) => {
      const cats = [...m.categories].sort((a, b) => a.sortOrder - b.sortOrder);
      const i = cats.findIndex((c) => c.ref === ref); const j = i + dir;
      if (j < 0 || j >= cats.length) return m;
      [cats[i], cats[j]] = [cats[j], cats[i]];
      return { ...m, categories: cats.map((c, k) => ({ ...c, sortOrder: k })) };
    });
  }
  function addItem() {
    if (!menu?.categories.length) { setMsg('Add a category first.'); return; }
    const ref = uid('item');
    update((m) => ({ ...m, items: [...m.items, { ref, name: 'New item', price: 0, categoryRef: m.categories[0].ref, available: true, modifierGroupRefs: [] }] }));
    setEditItem(ref);
  }

  const cats = useMemo(() => [...(menu?.categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), [menu]);
  const items = useMemo(() => (menu?.items ?? []).filter((i) => !search.trim() || i.name.toLowerCase().includes(search.toLowerCase())), [menu, search]);
  const issuesFor = (ref: string) => [...(check?.errors ?? []), ...(check?.warnings ?? [])].filter((x) => x.ref === ref);
  const item = menu?.items.find((i) => i.ref === editItem) ?? null;
  const hoursCat = menu?.categories.find((c) => c.ref === editHours) ?? null;

  return (
    <div>
      <div className="fh-head">
        <div>
          <h1>Menu Manager</h1>
          <div className="small">One master menu per brand → checked, then published to Uber Eats, DoorDash and SkipTheDishes with its store hours, holidays and category schedules.</div>
        </div>
        <div className="fh-row">
          <select value={brand} onChange={(e) => { if (dirty && !window.confirm('Discard unsaved changes?')) return; setBrand(e.target.value); }} aria-label="Brand">{brands.map((b) => <option key={b}>{b}</option>)}</select>
          {editable && <>
            <button className="btn-light" disabled={!!busy} onClick={importClover}>{busy === 'import' ? 'Importing…' : 'Import from Clover'}</button>
            <button className="btn-light" disabled={!!busy} onClick={() => setCopyOpen(true)}>Copy from brand…</button>
            <button disabled={!!busy || !dirty} onClick={save}>{busy === 'save' ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
            <button className="btn-ok" disabled={!!busy} onClick={() => { if (dirty) { setMsg('Save your changes before publishing.'); return; } setPublishOpen(true); }}>Publish…</button>
          </>}
        </div>
      </div>
      {msg && <div className="fh-banner info">{msg}</div>}
      {priceChanges.length > 0 && (
        <div className="fh-banner warn">
          <strong>Prices changed in Clover:</strong>
          {priceChanges.map((c) => (
            <div key={c.ref} className="fh-row" style={{ marginTop: 6 }}>
              <span>{c.name}: Food Hub {c.foodhubPrice.toFixed(2)} $ → Clover <strong>{c.cloverPrice.toFixed(2)} $</strong></span>
              {editable && <><button className="btn-sm" disabled={!!busy} onClick={() => resolvePrice(c, true)}>Use Clover price</button><button className="btn-sm btn-light" disabled={!!busy} onClick={() => resolvePrice(c, false)}>Keep {c.foodhubPrice.toFixed(2)} $</button></>}
            </div>
          ))}
        </div>
      )}
      {languages && (
        <div className="small fh-row" style={{ marginBottom: 10 }}>
          Menu language — Uber Eats: <strong>{LANG_LABEL[languages.uber_eats]}</strong> · DoorDash: <strong>{LANG_LABEL[languages.doordash]}</strong> · Skip: <strong>{LANG_LABEL[languages.skip]}</strong>
          {editable && <button className="btn-sm btn-light" onClick={() => setLangOpen(true)}>Change</button>}
        </div>
      )}
      {langOpen && languages && <LanguageDialog value={languages} onClose={() => setLangOpen(false)} onSaved={(l) => { setLanguages(l); setLangOpen(false); setMsg('Menu languages saved — publish to apply them.'); loadStatus(brand); }} />}
      <ResultsTable results={results} />

      {check && editable && (
        <Section title="Menu check" right={<span className="fh-row">
          <span className={`badge ${check.errors.length ? 'badge-red' : 'badge-green'}`}>{check.errors.length} error{check.errors.length === 1 ? '' : 's'}</span>
          <span className="badge badge-yellow">{check.warnings.length} warning{check.warnings.length === 1 ? '' : 's'}</span>
          <button className="btn-sm btn-light" onClick={() => setShowTips(!showTips)}>{showTips ? 'Hide' : 'Show'} {check.tips.length} tip{check.tips.length === 1 ? '' : 's'}</button>
        </span>}>
          {check.errors.length === 0 && check.warnings.length === 0 && <p className="small">✓ Ready to publish.</p>}
          <ul className="fh-issues">
            {check.errors.map((x, i) => <li key={`e${i}`} className="err"><span aria-hidden>✕</span> {x.message} {x.ref && menu?.items.some((it) => it.ref === x.ref) && <button className="fh-link" onClick={() => setEditItem(x.ref!)}>Fix</button>}</li>)}
            {check.warnings.map((x, i) => <li key={`w${i}`} className="warn"><span aria-hidden>!</span> {x.message} {x.ref && menu?.items.some((it) => it.ref === x.ref) && <button className="fh-link" onClick={() => setEditItem(x.ref!)}>Edit</button>}</li>)}
            {showTips && check.tips.map((x, i) => <li key={`t${i}`} className="tip"><span aria-hidden>i</span> {x.message} {x.ref && menu?.items.some((it) => it.ref === x.ref) && <button className="fh-link" onClick={() => setEditItem(x.ref!)}>Edit</button>}</li>)}
          </ul>
          <p className="small">Errors block publishing. Checks run on the saved menu{dirty ? ' — save to re-check' : ''}.</p>
        </Section>
      )}

      {menu && (
        <>
          <Section title={`Categories (${menu.categories.length})`} right={editable ? <div className="fh-row"><input placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCategory()} /><button className="btn-sm" onClick={addCategory}>Add</button></div> : undefined}>
            <table>
              <thead><tr><th>Order</th><th>Category</th><th>Items</th><th>Schedule</th><th></th></tr></thead>
              <tbody>
                {cats.map((c, idx) => {
                  const n = menu.items.filter((i) => i.categoryRef === c.ref).length;
                  return (
                    <tr key={c.ref}>
                      <td className="fh-row">{editable && <><button className="btn-sm btn-light" disabled={idx === 0} onClick={() => moveCategory(c.ref, -1)} aria-label="Move up">↑</button><button className="btn-sm btn-light" disabled={idx === cats.length - 1} onClick={() => moveCategory(c.ref, 1)} aria-label="Move down">↓</button></>}</td>
                      <td>
                        <input value={c.name} disabled={!editable} onChange={(e) => update((m) => ({ ...m, categories: m.categories.map((x) => (x.ref === c.ref ? { ...x, name: e.target.value } : x)) }))} aria-label="Category name (English)" />
                        <input value={c.nameFr ?? ''} placeholder="Nom en français" disabled={!editable} onChange={(e) => update((m) => ({ ...m, categories: m.categories.map((x) => (x.ref === c.ref ? { ...x, nameFr: e.target.value || undefined } : x)) }))} aria-label="Category name (French)" style={{ marginLeft: 6 }} />
                      </td>
                      <td>{n}</td>
                      <td>{c.hours && Object.values(c.hours).some((d) => d.length) ? <span className="badge badge-blue">Custom schedule</span> : <span className="small">Same as store hours</span>} {editable && <button className="btn-sm btn-light" onClick={() => setEditHours(c.ref)}>Edit</button>}</td>
                      <td>{editable && <button className="btn-sm btn-light" disabled={n > 0} title={n ? 'Move or remove its items first' : ''} onClick={() => update((m) => ({ ...m, categories: m.categories.filter((x) => x.ref !== c.ref) }))}>Remove</button>}</td>
                    </tr>
                  );
                })}
                {menu.categories.length === 0 && <tr><td colSpan={5} className="small">No categories yet. Import from Clover or add one.</td></tr>}
              </tbody>
            </table>
          </Section>

          <Section title={`Items (${menu.items.length})`} right={<div className="fh-row"><input type="search" placeholder="Search items" value={search} onChange={(e) => setSearch(e.target.value)} />{editable && <button className="btn-sm" onClick={addItem}>Add item</button>}</div>}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Item</th><th>Category</th><th>Base price</th>
                    {PRICE_CHANNELS.map(([, l]) => <th key={l}>{l} price</th>)}
                    <th>Details</th><th>On sale</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const issues = issuesFor(i.ref);
                    return (
                      <tr key={i.ref}>
                        <td>
                          <div className="fh-row" style={{ flexWrap: 'nowrap' }}>
                            {i.imageUrl ? <img src={i.imageUrl} alt="" className="fh-thumb" /> : <span className="fh-thumb empty" aria-hidden />}
                            <input value={i.name} disabled={!editable} onChange={(e) => updateItem(i.ref, { name: e.target.value })} style={{ minWidth: 170 }} />
                          </div>
                          {issues.length > 0 && <div className="small" style={{ color: issues.some((x) => x.level === 'error') ? '#b42318' : '#b54708' }}>{issues[0].message}</div>}
                        </td>
                        <td>
                          <select value={i.categoryRef} disabled={!editable} onChange={(e) => updateItem(i.ref, { categoryRef: e.target.value })}>
                            {cats.map((c) => <option key={c.ref} value={c.ref}>{c.name}</option>)}
                          </select>
                        </td>
                        <td><input type="number" step="0.01" min="0" value={i.price} disabled={!editable} onChange={(e) => updateItem(i.ref, { price: Number(e.target.value) })} style={{ width: 90 }} /></td>
                        {PRICE_CHANNELS.map(([k]) => (
                          <td key={k}>
                            <input type="number" step="0.01" min="0" placeholder="same" value={i.channelPrices?.[k] ?? ''} disabled={!editable} style={{ width: 90 }}
                              onChange={(e) => {
                                const v = e.target.value;
                                const next = { ...(i.channelPrices || {}) };
                                if (v === '') delete next[k]; else next[k] = Number(v);
                                updateItem(i.ref, { channelPrices: next });
                              }} />
                          </td>
                        ))}
                        <td className="small">
                          {[i.description ? 'description' : null, i.tags?.length ? `${i.tags.length} tag(s)` : null, i.modifierGroupRefs.length ? `${i.modifierGroupRefs.length} option group(s)` : null, i.posItemRef ? 'Clover ✓' : 'no Clover link'].filter(Boolean).join(' · ')}
                          {' '}<button className="fh-link" onClick={() => setEditItem(i.ref)}>{editable ? 'Edit' : 'View'}</button>
                        </td>
                        <td><input type="checkbox" checked={i.available} disabled={!editable} onChange={(e) => updateItem(i.ref, { available: e.target.checked })} aria-label="On sale everywhere" /></td>
                        <td>{editable && <button className="btn-sm btn-light" onClick={() => { if (window.confirm(`Remove ${i.name}?`)) update((m) => ({ ...m, items: m.items.filter((x) => x.ref !== i.ref) })); }}>Remove</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {menu.items.length === 0 && <p className="small">No items yet. “Import from Clover” pulls the brand’s items, prices and modifiers in one click.</p>}
            <p className="small">Leave a platform price empty to use the base price. “On sale” turns an item off on every platform at every location; to 86 at one location only, use the 86 Board.</p>
          </Section>

          <Section title={`Modifier groups (${menu.modifierGroups.length})`} right={editable ? <button className="btn-sm" onClick={() => update((m) => ({ ...m, modifierGroups: [...m.modifierGroups, { ref: uid('grp'), name: 'New options', min: 0, max: 1, modifiers: [{ ref: uid('mod'), name: 'Option', price: 0, available: true }] }] }))}>Add group</button> : undefined}>
            <div className="fh-groups">
              {menu.modifierGroups.map((g) => {
                const usedBy = menu.items.filter((i) => i.modifierGroupRefs.includes(g.ref)).length;
                return (
                  <div key={g.ref} className="fh-group">
                    <div className="fh-row">
                      <input value={g.name} disabled={!editable} onChange={(e) => updateGroup(g.ref, { name: e.target.value })} style={{ flex: 1, fontWeight: 700 }} aria-label="Group name" />
                      <input value={g.nameFr ?? ''} placeholder="Français" disabled={!editable} onChange={(e) => updateGroup(g.ref, { nameFr: e.target.value || undefined })} style={{ width: 120 }} aria-label="Group name (French)" />
                      <label className="small">min <input type="number" min={0} value={g.min} disabled={!editable} onChange={(e) => updateGroup(g.ref, { min: Math.max(0, Number(e.target.value)) })} style={{ width: 56 }} /></label>
                      <label className="small">max <input type="number" min={0} value={g.max} disabled={!editable} onChange={(e) => updateGroup(g.ref, { max: Math.max(0, Number(e.target.value)) })} style={{ width: 56 }} /></label>
                    </div>
                    <div className="small" style={{ margin: '4px 0' }}>{g.min > 0 ? `Required — pick ${g.min}${g.max > g.min ? `–${g.max}` : ''}` : `Optional — up to ${g.max || 'any'}`} · used by {usedBy} item(s)</div>
                    {g.modifiers.map((md) => (
                      <div key={md.ref} className="fh-row" style={{ marginBottom: 4 }}>
                        <input value={md.name} disabled={!editable} onChange={(e) => updateGroup(g.ref, { modifiers: g.modifiers.map((x) => (x.ref === md.ref ? { ...x, name: e.target.value } : x)) })} style={{ flex: 1 }} aria-label="Option name" />
                        <input value={md.nameFr ?? ''} placeholder="Français" disabled={!editable} onChange={(e) => updateGroup(g.ref, { modifiers: g.modifiers.map((x) => (x.ref === md.ref ? { ...x, nameFr: e.target.value || undefined } : x)) })} style={{ width: 110 }} aria-label="Option name (French)" />
                        <input type="number" step="0.01" min="0" value={md.price} disabled={!editable} onChange={(e) => updateGroup(g.ref, { modifiers: g.modifiers.map((x) => (x.ref === md.ref ? { ...x, price: Number(e.target.value) } : x)) })} style={{ width: 80 }} aria-label="Extra price" />
                        <label className="small fh-row"><input type="checkbox" checked={md.available} disabled={!editable} onChange={(e) => updateGroup(g.ref, { modifiers: g.modifiers.map((x) => (x.ref === md.ref ? { ...x, available: e.target.checked } : x)) })} /> on</label>
                        {editable && <button className="btn-sm btn-light" aria-label="Remove option" onClick={() => updateGroup(g.ref, { modifiers: g.modifiers.filter((x) => x.ref !== md.ref) })}>×</button>}
                      </div>
                    ))}
                    {editable && (
                      <div className="fh-row">
                        <button className="btn-sm btn-light" onClick={() => updateGroup(g.ref, { modifiers: [...g.modifiers, { ref: uid('mod'), name: 'Option', price: 0, available: true }] })}>+ option</button>
                        <button className="btn-sm btn-light" disabled={usedBy > 0} title={usedBy ? 'Remove it from its items first' : ''} onClick={() => update((m) => ({ ...m, modifierGroups: m.modifierGroups.filter((x) => x.ref !== g.ref) }))}>Remove group</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {menu.modifierGroups.length === 0 && <p className="small">No modifier groups. Clover modifiers come in with “Import from Clover”, or add your own.</p>}
            </div>
          </Section>

          {editable && (
            <Section title="Publish status" right={<button className="btn-sm btn-light" onClick={() => loadStatus(brand)}>Refresh</button>}>
              <table>
                <thead><tr><th>Platform</th><th>Location</th><th>Store id</th><th>Last publish</th><th>Result</th></tr></thead>
                <tbody>
                  {stores.map((s) => (
                    <tr key={s.storeId}>
                      <td><Marketplace value={s.channel} /></td>
                      <td className="small">{locName(s.locationCode)}</td>
                      <td className="small fh-mono">{s.channelStoreId}</td>
                      <td className="small">{s.at ? new Date(s.at).toLocaleString('fr-CA') : 'never'}</td>
                      <td>{s.status === 'never' ? <span className="small">—</span> : <><StatusBadge status={s.status} /> <span className="small">{s.message}</span></>}</td>
                    </tr>
                  ))}
                  {stores.length === 0 && <tr><td colSpan={5} className="small">No stores mapped for {brand} yet — map them under Stores.</td></tr>}
                </tbody>
              </table>
              {scheduled.length > 0 && (
                <>
                  <h3 style={{ fontSize: 15, margin: '16px 0 6px' }}>Scheduled publishes</h3>
                  <table>
                    <thead><tr><th>When</th><th>Stores</th><th>By</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {scheduled.map((s) => (
                        <tr key={s.id}>
                          <td>{new Date(s.at).toLocaleString('fr-CA')}</td>
                          <td className="small">{s.storeIds?.length ? `${s.storeIds.length} selected` : 'All mapped stores'}</td>
                          <td className="small">{s.createdBy}</td>
                          <td><span className={`badge ${s.status === 'done' ? 'badge-green' : s.status === 'failed' ? 'badge-red' : s.status === 'cancelled' ? 'badge-blue' : 'badge-yellow'}`}>{s.status}</span> <span className="small">{s.result ?? ''}</span></td>
                          <td>{s.status === 'scheduled' && <button className="btn-sm btn-light" onClick={() => run('cancel', async () => { await api(`/api/food-hub/menu/publish?id=${s.id}`, { method: 'DELETE' }); setMsg('Scheduled publish cancelled.'); loadStatus(brand); })}>Cancel</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </Section>
          )}
        </>
      )}

      {item && menu && (
        <ItemDialog item={item} groups={menu.modifierGroups} editable={editable} onChange={(p) => updateItem(item.ref, p)} onClose={() => setEditItem(null)} />
      )}
      {hoursCat && (
        <CategoryHoursDialog category={hoursCat} onSave={(hours) => { update((m) => ({ ...m, categories: m.categories.map((c) => (c.ref === hoursCat.ref ? { ...c, hours } : c)) })); setEditHours(null); }} onClose={() => setEditHours(null)} />
      )}
      {publishOpen && menu && (
        <PublishDialog brand={brand} stores={stores} check={check} locName={locName}
          onClose={() => setPublishOpen(false)}
          onDone={(m, res) => { setPublishOpen(false); setMsg(m); setResults(res ?? []); loadStatus(brand); }} />
      )}
      {copyOpen && menu && (
        <CopyDialog brands={brands.filter((b) => b !== brand)} target={brand}
          onClose={() => setCopyOpen(false)}
          onCopy={(src) => { update((m) => ({ ...m, categories: src.categories, items: src.items, modifierGroups: src.modifierGroups })); setCopyOpen(false); setMsg(`Copied ${src.items.length} items from ${src.brandName}. Review, then Save.`); }} />
      )}
    </div>
  );
}

function ItemDialog({ item, groups, editable, onChange, onClose }: { item: Item; groups: Group[]; editable: boolean; onChange: (p: Partial<Item>) => void; onClose: () => void }) {
  const [allergens, setAllergens] = useState((item.allergens ?? []).join(', '));
  return (
    <Modal title={item.name || 'Item'} wide onClose={onClose}>
      <div className="grid grid-2">
        <div className="fh-col-form">
          <label>Name (English)<input style={{ width: '100%' }} value={item.name} disabled={!editable} onChange={(e) => onChange({ name: e.target.value })} /></label>
          <label>Nom (français)<input style={{ width: '100%' }} value={item.nameFr ?? ''} disabled={!editable} onChange={(e) => onChange({ nameFr: e.target.value || undefined })} placeholder="Ex. Poulet grillé" /></label>
          <label>Description (English)<textarea rows={3} style={{ width: '100%' }} value={item.description ?? ''} disabled={!editable} onChange={(e) => onChange({ description: e.target.value })} /></label>
          <label>Description (français)<textarea rows={3} style={{ width: '100%' }} value={item.descriptionFr ?? ''} disabled={!editable} onChange={(e) => onChange({ descriptionFr: e.target.value || undefined })} /></label>
          <label>Photo URL (https, at least 1200×800 recommended)<input style={{ width: '100%' }} value={item.imageUrl ?? ''} disabled={!editable} onChange={(e) => onChange({ imageUrl: e.target.value.trim() || undefined })} placeholder="https://…" /></label>
          {item.imageUrl && <img src={item.imageUrl} alt={item.name} style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 10, objectFit: 'cover' }} />}
          <div className="small">Clover item: <span className="fh-mono">{item.posItemRef || 'not linked — reaches Clover as a custom line'}</span></div>
        </div>
        <div className="fh-col-form">
          <div>
            <div className="small" style={{ marginBottom: 4 }}>Dietary tags</div>
            <div className="fh-row">
              {TAGS.map(([k, l]) => (
                <label key={k} className="fh-row small"><input type="checkbox" disabled={!editable} checked={(item.tags ?? []).includes(k)} onChange={(e) => onChange({ tags: e.target.checked ? [...(item.tags ?? []), k] : (item.tags ?? []).filter((t) => t !== k) })} /> {l}</label>
              ))}
            </div>
          </div>
          <label>Allergens (comma-separated)<input style={{ width: '100%' }} value={allergens} disabled={!editable} onChange={(e) => setAllergens(e.target.value)} onBlur={() => onChange({ allergens: allergens.split(',').map((a) => a.trim()).filter(Boolean) })} placeholder="peanuts, milk, wheat" /></label>
          <label>Calories<input type="number" min={0} value={item.calories ?? ''} disabled={!editable} onChange={(e) => onChange({ calories: e.target.value === '' ? undefined : Number(e.target.value) })} style={{ width: 120 }} /></label>
          <div>
            <div className="small" style={{ marginBottom: 4 }}>Option groups on this item</div>
            {groups.length === 0 && <div className="small">No modifier groups in this menu.</div>}
            {groups.map((g) => (
              <label key={g.ref} className="fh-row small"><input type="checkbox" disabled={!editable} checked={item.modifierGroupRefs.includes(g.ref)} onChange={(e) => onChange({ modifierGroupRefs: e.target.checked ? [...item.modifierGroupRefs, g.ref] : item.modifierGroupRefs.filter((r) => r !== g.ref) })} /> {g.name} <span className="small">({g.modifiers.length} options{g.min ? ', required' : ''})</span></label>
            ))}
          </div>
        </div>
      </div>
      <div className="fh-row" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button onClick={() => { if (editable) onChange({ allergens: allergens.split(',').map((a) => a.trim()).filter(Boolean) }); onClose(); }}>Done</button></div>
    </Modal>
  );
}

function CategoryHoursDialog({ category, onSave, onClose }: { category: Category; onSave: (hours: Week | null) => void; onClose: () => void }) {
  const [week, setWeek] = useState<Week>(() => (category.hours && Object.values(category.hours).some((d) => d.length) ? JSON.parse(JSON.stringify(category.hours)) : fullWeekUi('07:00', '11:00')));
  const problems = weekProblems(week);
  return (
    <Modal title={`Schedule — ${category.name}`} wide onClose={onClose}>
      <p className="small">Only sold during these times (and only while the store is open). Example: breakfast 7:00–11:00. Uber Eats and SkipTheDishes get it as a separate menu; DoorDash as item hours.</p>
      <WeekEditor value={week} onChange={setWeek} />
      {problems.length > 0 && <div className="fh-banner warn" style={{ marginTop: 8 }}>{problems.join(' · ')}</div>}
      <div className="fh-row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <button className="btn-light" onClick={() => onSave(null)}>Same as store hours</button>
        <span className="fh-row"><button className="btn-light" onClick={onClose}>Cancel</button><button disabled={problems.length > 0} onClick={() => onSave(week)}>Use this schedule</button></span>
      </div>
    </Modal>
  );
}

function PublishDialog({ brand, stores, check, locName, onClose, onDone }: { brand: string; stores: StoreStatus[]; check: Check | null; locName: (c?: string | null) => string; onClose: () => void; onDone: (msg: string, results?: any[]) => void }) {
  const [selected, setSelected] = useState<string[]>(stores.map((s) => s.storeId));
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [at, setAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const blocked = Boolean(check && !check.ok);
  async function go() {
    setBusy(true); setErr('');
    try {
      const body: Record<string, unknown> = { brand, storeIds: selected.length === stores.length ? undefined : selected };
      if (when === 'later') body.at = new Date(at).toISOString();
      const d = await api<{ results?: any[]; scheduled?: { at: string } }>('/api/food-hub/menu/publish', { method: 'POST', json: body });
      if (d.scheduled) onDone(`Publish scheduled for ${new Date(d.scheduled.at).toLocaleString('fr-CA')}.`);
      else onDone('Publish sent. Skip and DoorDash confirm in the background — see Publish status.', d.results);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return (
    <Modal title={`Publish ${brand}`} wide onClose={onClose}>
      {blocked && <div className="fh-banner warn">Fix the {check!.errors.length} error(s) in Menu check first.</div>}
      <div className="fh-row" style={{ marginBottom: 8 }}>
        <button className="btn-sm btn-light" onClick={() => setSelected(stores.map((s) => s.storeId))}>All</button>
        <button className="btn-sm btn-light" onClick={() => setSelected([])}>None</button>
        <span className="small">{selected.length}/{stores.length} store(s)</span>
      </div>
      <div className="fh-table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
        <table>
          <tbody>
            {stores.map((s) => (
              <tr key={s.storeId}>
                <td><input type="checkbox" checked={selected.includes(s.storeId)} onChange={(e) => setSelected(e.target.checked ? [...selected, s.storeId] : selected.filter((x) => x !== s.storeId))} aria-label={`${s.channel} ${s.locationCode}`} /></td>
                <td><Marketplace value={s.channel} /></td>
                <td>{locName(s.locationCode)}</td>
                <td className="small fh-mono">{s.channelStoreId}</td>
              </tr>
            ))}
            {stores.length === 0 && <tr><td className="small">No stores mapped for this brand.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="fh-row" style={{ marginTop: 12 }}>
        <label className="fh-row"><input type="radio" checked={when === 'now'} onChange={() => setWhen('now')} /> Publish now</label>
        <label className="fh-row"><input type="radio" checked={when === 'later'} onChange={() => setWhen('later')} /> Schedule for</label>
        <input type="datetime-local" value={at} disabled={when !== 'later'} onChange={(e) => setAt(e.target.value)} />
      </div>
      {err && <div className="fh-banner warn" style={{ marginTop: 8 }}>{err}</div>}
      <div className="fh-row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn-light" onClick={onClose}>Cancel</button>
        <button className="btn-ok" disabled={busy || blocked || selected.length === 0 || (when === 'later' && !at)} onClick={go}>{busy ? 'Working…' : when === 'now' ? `Publish to ${selected.length} store(s)` : 'Schedule'}</button>
      </div>
    </Modal>
  );
}

function CopyDialog({ brands, target, onCopy, onClose }: { brands: string[]; target: string; onCopy: (m: Menu) => void; onClose: () => void }) {
  const [src, setSrc] = useState(brands[0] ?? '');
  const [err, setErr] = useState('');
  async function go() {
    try {
      const d = await api<{ menu: Menu }>(`/api/food-hub/menu?brand=${encodeURIComponent(src)}`);
      if (!d.menu.items.length) { setErr(`${src} has no items to copy.`); return; }
      if (!window.confirm(`Replace ${target}'s categories, items and options with a copy of ${src}'s?`)) return;
      onCopy(d.menu);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  return (
    <Modal title={`Copy a menu into ${target}`} onClose={onClose}>
      <p className="small">Copies categories, items, options, prices, descriptions and schedules. Nothing is saved until you press Save. Clover links are copied too — re-import from Clover afterwards if this brand uses different Clover items.</p>
      <select value={src} onChange={(e) => setSrc(e.target.value)}>{brands.map((b) => <option key={b}>{b}</option>)}</select>
      {err && <div className="fh-banner warn" style={{ marginTop: 8 }}>{err}</div>}
      <div className="fh-row" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button className="btn-light" onClick={onClose}>Cancel</button><button disabled={!src} onClick={go}>Copy</button></div>
    </Modal>
  );
}

function LanguageDialog({ value, onSaved, onClose }: { value: Languages; onSaved: (l: Languages) => void; onClose: () => void }) {
  const [v, setV] = useState<Languages>(value);
  const [err, setErr] = useState('');
  async function save() {
    try { const d = await api<{ languages: Languages }>('/api/food-hub/menu/languages', { method: 'PUT', json: { languages: v } }); onSaved(d.languages); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  const row = (k: keyof Languages, labelText: string, note: string) => (
    <label className="fh-col-form" style={{ gap: 2 }}>
      <span><strong>{labelText}</strong> <span className="small">{note}</span></span>
      <select value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })}>{Object.entries(LANG_LABEL).map(([kk, l]) => <option key={kk} value={kk}>{l}</option>)}</select>
    </label>
  );
  return (
    <Modal title="Menu language per platform" onClose={onClose}>
      <div className="fh-col-form">
        {row('uber_eats', 'Uber Eats', 'Uber shows each customer their own language — French and English are both sent when you fill in the French names.')}
        {row('doordash', 'DoorDash', 'One language per menu.')}
        {row('skip', 'SkipTheDishes', 'One language per menu.')}
        <p className="small">“Français / English” shows both, e.g. “Poulet grillé / Grilled chicken”. Items without a French name keep their English name.</p>
        {err && <div className="fh-banner warn">{err}</div>}
        <div className="fh-row" style={{ justifyContent: 'flex-end' }}><button className="btn-light" onClick={onClose}>Cancel</button><button onClick={save}>Save</button></div>
      </div>
    </Modal>
  );
}
