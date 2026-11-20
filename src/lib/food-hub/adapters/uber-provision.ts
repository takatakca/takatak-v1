// Uber Eats store provisioning ("integration activation") — self-serve, no aggregator.
// https://developer.uber.com/docs/eats/guides/integration-activation-flows
//  1. Owner clicks "Connect Uber Eats stores" → Uber login (scope eats.pos_provisioning).
//  2. Uber redirects back with a code → exchanged for a MERCHANT token (kept 15 min, server-side only).
//  3. GET /v1/eats/stores with that token lists the owner's stores; Food Hub suggests brand + location.
//  4. Owner confirms → POST /v1/eats/stores/{id}/pos_data activates each store for this app.
//  After that, the normal client-credentials token can read orders and manage the store.
import crypto from 'node:crypto';
import rawBrands from '../seed/brands.json';
import rawLocations from '../seed/locations.json';
import { callApi, publicBaseUrl, stripSlash, timedFetch } from '../config';
import { getRepo } from '../repo';
import type { ChannelResult } from '../types';

export const UBER_CONNECT_CALLBACK = '/api/food-hub/uber-connect/callback';
const SESSION_TTL_MS = 15 * 60_000;

type Session = { createdAt: number; token?: string | null; stores?: UberMerchantStore[]; error?: string | null };
export type UberMerchantStore = { id: string; name: string; address?: string; suggestedBrand?: string; suggestedLocation?: string };

function apiBase() { return stripSlash(process.env.UBER_BASE_URL || 'https://api.uber.com'); }
function redirectUri() { return `${publicBaseUrl()}${UBER_CONNECT_CALLBACK}`; }
const key = (id: string) => `uber-connect:${id}`;

export async function startUberConnect(): Promise<string> {
  const state = crypto.randomBytes(18).toString('hex');
  await getRepo().setKv(key(state), { createdAt: Date.now() } satisfies Session);
  const qs = new URLSearchParams({ response_type: 'code', client_id: process.env.UBER_CLIENT_ID || '', scope: 'eats.pos_provisioning', redirect_uri: redirectUri(), state });
  return `${process.env.UBER_LOGIN_URL || 'https://login.uber.com/oauth/v2/authorize'}?${qs}`;
}

async function getSession(id: string): Promise<Session | null> {
  if (!/^[a-f0-9]{36}$/.test(id)) return null;
  const s = await getRepo().getKv<Session>(key(id));
  if (!s || Date.now() - s.createdAt > SESSION_TTL_MS) return null;
  return s;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** Suggests the brand (longest brand name found in the store name) and location (street number in the address). */
export function suggestMapping(name: string, address = ''): { suggestedBrand?: string; suggestedLocation?: string } {
  const n = norm(name);
  const brand = (rawBrands as string[]).filter((b) => b !== 'Too Good To Go' && n.includes(norm(b))).sort((a, b) => norm(b).length - norm(a).length)[0];
  const text = `${address} ${name}`;
  const loc = (rawLocations as Array<{ code: string; address_line_1: string }>).find((l) => new RegExp(`\\b${l.address_line_1.split(' ')[0]}\\b`).test(text));
  let suggestedLocation = loc?.code;
  if (!suggestedLocation && /hochelaga/i.test(text)) suggestedLocation = 'HOCHELAGA';
  if (!suggestedLocation && /l[eé]onard/i.test(text)) suggestedLocation = 'SAINT_LEONARD';
  return { suggestedBrand: brand, suggestedLocation };
}

/** Callback: validates state, exchanges the code, lists the owner's stores. Returns the session id to show in the UI. */
export async function finishUberConnect(state: string, code: string): Promise<{ ok: boolean; id: string; error?: string }> {
  const session = await getSession(state);
  if (!session || session.token !== undefined) return { ok: false, id: state, error: 'This Uber connection link expired or was already used. Click “Connect Uber Eats stores” again.' };
  const save = (s: Session) => getRepo().setKv(key(state), s);
  try {
    const res = await timedFetch(process.env.UBER_AUTH_URL || 'https://auth.uber.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: process.env.UBER_CLIENT_ID || '', client_secret: process.env.UBER_CLIENT_SECRET || '', grant_type: 'authorization_code', redirect_uri: redirectUri(), code }).toString(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.access_token) throw new Error(`Uber did not return a merchant token (HTTP ${res.status}).`);
    const token = String(json.access_token);
    const list = await timedFetch(`${apiBase()}/v1/eats/stores`, { headers: { Authorization: `Bearer ${token}` } });
    if (!list.ok) throw new Error(`Uber store list failed (HTTP ${list.status}).`);
    const body = await list.json();
    const rows: any[] = Array.isArray(body?.stores) ? body.stores : Array.isArray(body?.data) ? body.data : [];
    const stores: UberMerchantStore[] = rows.map((s) => {
      const address = [s.location?.address, s.location?.address_2, s.location?.city].filter(Boolean).join(', ') || undefined;
      const name = String(s.name ?? s.store_name ?? s.store_id);
      return { id: String(s.store_id ?? s.id), name, address, ...suggestMapping(name, address) };
    });
    await save({ ...session, token, stores, error: null });
    return { ok: true, id: state };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await save({ ...session, token: null, stores: [], error: message });
    return { ok: false, id: state, error: message };
  }
}

export async function uberConnectSession(id: string): Promise<{ stores: UberMerchantStore[]; error: string | null; active: boolean } | null> {
  const s = await getSession(id);
  if (!s) return null;
  return { stores: s.stores ?? [], error: s.error ?? null, active: Boolean(s.token) };
}

/** Activates the selected stores for this app (merchant token) — the token is discarded afterwards. */
export async function activateUberStores(id: string, picks: Array<{ storeId: string; brandName: string; locationCode: string }>): Promise<Array<{ storeId: string; result: ChannelResult }>> {
  const s = await getSession(id);
  if (!s?.token) throw new Error('Uber connection expired. Click “Connect Uber Eats stores” again.');
  const out: Array<{ storeId: string; result: ChannelResult }> = [];
  for (const p of picks) {
    const result = await callApi('uber_eats', `${apiBase()}/v1/eats/stores/${encodeURIComponent(p.storeId)}/pos_data`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_order_manager: true, integrator_store_id: `${p.locationCode}:${p.brandName}`.slice(0, 100), integrator_brand_id: p.brandName.slice(0, 100) }),
    });
    out.push({ storeId: p.storeId, result });
  }
  await getRepo().setKv(key(id), { ...s, token: null });
  return out;
}
