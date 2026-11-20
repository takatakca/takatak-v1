import crypto from 'node:crypto';
import { foodHubDb, hasFoodHubDatabase } from './db';
import { nowIso } from './config';
import type { ActivityEntry, ActivityKind, ChannelKey, ChannelStore, FoodHubJob, MasterMenu, NormalizedOrder, OrderEvent, OrderStatus, StoredOrder } from './types';

export interface OrderFilter { limit?: number; statuses?: OrderStatus[]; since?: string; until?: string; locationCodes?: string[] }
export interface ActivityFilter { limit?: number; since?: string; until?: string; kinds?: ActivityKind[]; locationCodes?: string[] }
/** Generic document store (payout lines, statement imports, reconciliation cases, ledger approvals…). */
export interface Doc<T = Record<string, unknown>> { id: string; key?: string | null; at?: string | null; data: T }
export interface DocFilter { since?: string; until?: string; keys?: string[]; limit?: number }

export interface FoodHubRepo {
  mode: 'supabase' | 'memory';
  insertOrderIfNew(order: NormalizedOrder & { locationCode?: string; createdAt?: string }): Promise<{ order: StoredOrder; isNew: boolean }>;
  getOrder(id: string): Promise<StoredOrder | null>;
  findOrder(channel: ChannelKey, externalOrderId: string): Promise<StoredOrder | null>;
  updateOrder(id: string, patch: Partial<StoredOrder>): Promise<StoredOrder | null>;
  listOrders(filter?: OrderFilter): Promise<StoredOrder[]>;
  addEvent(orderId: string, type: string, detail?: Record<string, unknown>): Promise<void>;
  listEvents(orderId: string): Promise<OrderEvent[]>;
  listStores(channel?: ChannelKey): Promise<ChannelStore[]>;
  findStore(channel: ChannelKey, channelStoreId: string): Promise<ChannelStore | null>;
  getStore(id: string): Promise<ChannelStore | null>;
  upsertStore(store: Omit<ChannelStore, 'id'> & { id?: string }): Promise<ChannelStore>;
  updateStore(id: string, patch: Partial<ChannelStore>): Promise<ChannelStore | null>;
  deleteStore(id: string): Promise<void>;
  getMenu(brandName: string): Promise<MasterMenu | null>;
  saveMenu(menu: MasterMenu): Promise<MasterMenu>;
  listMenus(): Promise<MasterMenu[]>;
  addJob(job: Omit<FoodHubJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<FoodHubJob>;
  findJobByReference(reference: string): Promise<FoodHubJob | null>;
  updateJob(id: string, patch: Partial<FoodHubJob>): Promise<void>;
  listJobs(limit?: number): Promise<FoodHubJob[]>;
  /** Small key/value store (last sync report, Clover sales cache). */
  getKv<T = unknown>(key: string): Promise<T | null>;
  setKv(key: string, value: unknown): Promise<void>;
  addActivity(entry: ActivityEntry): Promise<void>;
  listActivity(filter?: ActivityFilter): Promise<ActivityEntry[]>;
  putDocs<T>(collection: string, docs: Doc<T>[]): Promise<void>;
  listDocs<T>(collection: string, filter?: DocFilter): Promise<Doc<T>[]>;
  getDoc<T>(collection: string, id: string): Promise<Doc<T> | null>;
  deleteDocs(collection: string, ids: string[]): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory repository — used before Supabase is configured (demo / tests).
// Data lives in process memory and is lost on restart; the UI says so.
// ---------------------------------------------------------------------------

type MemState = {
  orders: Map<string, StoredOrder>;
  events: OrderEvent[];
  stores: Map<string, ChannelStore>;
  menus: Map<string, MasterMenu>;
  jobs: Map<string, FoodHubJob>;
  kv: Map<string, unknown>;
  activity: ActivityEntry[];
  docs: Map<string, Map<string, Doc<any>>>;
};

function memState(): MemState {
  const g = globalThis as unknown as { __foodhubMem?: MemState };
  if (!g.__foodhubMem) {
    g.__foodhubMem = { orders: new Map(), events: [], stores: new Map(), menus: new Map(), jobs: new Map(), kv: new Map(), activity: [], docs: new Map() };
  }
  return g.__foodhubMem;
}

const memoryRepo: FoodHubRepo = {
  mode: 'memory',
  async insertOrderIfNew(order) {
    const s = memState();
    for (const o of s.orders.values()) {
      if (o.channel === order.channel && o.externalOrderId === order.externalOrderId) return { order: o, isNew: false };
    }
    const stored: StoredOrder = { ...order, id: crypto.randomUUID(), status: 'new', createdAt: order.createdAt ?? nowIso(), updatedAt: nowIso() };
    s.orders.set(stored.id, stored);
    return { order: stored, isNew: true };
  },
  async getOrder(id) { return memState().orders.get(id) ?? null; },
  async findOrder(channel, externalOrderId) {
    for (const o of memState().orders.values()) if (o.channel === channel && o.externalOrderId === externalOrderId) return o;
    return null;
  },
  async updateOrder(id, patch) {
    const s = memState();
    const cur = s.orders.get(id);
    if (!cur) return null;
    const next = { ...cur, ...patch, updatedAt: nowIso() };
    s.orders.set(id, next);
    return next;
  },
  async listOrders(filter = {}) {
    let list = [...memState().orders.values()];
    if (filter.statuses?.length) list = list.filter((o) => filter.statuses!.includes(o.status));
    if (filter.since) list = list.filter((o) => o.createdAt >= filter.since!);
    if (filter.until) list = list.filter((o) => o.createdAt < filter.until!);
    if (filter.locationCodes?.length) list = list.filter((o) => o.locationCode && filter.locationCodes!.includes(o.locationCode));
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, filter.limit ?? 200);
  },
  async addEvent(orderId, type, detail = {}) {
    memState().events.push({ id: crypto.randomUUID(), orderId, type, detail, at: nowIso() });
  },
  async listEvents(orderId) { return memState().events.filter((e) => e.orderId === orderId); },
  async listStores(channel) {
    const list = [...memState().stores.values()];
    return (channel ? list.filter((s) => s.channel === channel) : list).sort((a, b) => (a.brandName + a.locationCode).localeCompare(b.brandName + b.locationCode));
  },
  async findStore(channel, channelStoreId) {
    for (const s of memState().stores.values()) if (s.channel === channel && s.channelStoreId === channelStoreId) return s;
    return null;
  },
  async getStore(id) { return memState().stores.get(id) ?? null; },
  async upsertStore(store) {
    const s = memState();
    const existing = store.id ? s.stores.get(store.id) : await memoryRepo.findStore(store.channel, store.channelStoreId);
    const next: ChannelStore = { ...(existing ?? {}), ...store, id: existing?.id ?? store.id ?? crypto.randomUUID(), updatedAt: nowIso(), createdAt: existing?.createdAt ?? nowIso() } as ChannelStore;
    s.stores.set(next.id, next);
    return next;
  },
  async updateStore(id, patch) {
    const s = memState();
    const cur = s.stores.get(id);
    if (!cur) return null;
    const next = { ...cur, ...patch, updatedAt: nowIso() };
    s.stores.set(id, next);
    return next;
  },
  async deleteStore(id) { memState().stores.delete(id); },
  async getMenu(brandName) { return memState().menus.get(brandName) ?? null; },
  async saveMenu(menu) {
    const next = { ...menu, updatedAt: nowIso() };
    memState().menus.set(menu.brandName, next);
    return next;
  },
  async listMenus() { return [...memState().menus.values()]; },
  async addJob(job) {
    const full: FoodHubJob = { ...job, id: crypto.randomUUID(), createdAt: nowIso(), updatedAt: nowIso() };
    memState().jobs.set(full.id, full);
    return full;
  },
  async findJobByReference(reference) {
    // Newest first, same as the Supabase implementation.
    return [...memState().jobs.values()].reverse().find((j) => j.reference === reference) ?? null;
  },
  async updateJob(id, patch) {
    const s = memState();
    const cur = s.jobs.get(id);
    if (cur) s.jobs.set(id, { ...cur, ...patch, updatedAt: nowIso() });
  },
  async listJobs(limit = 50) {
    return [...memState().jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  },
  async getKv<T>(key: string) { return (memState().kv.get(key) as T) ?? null; },
  async setKv(key, value) { memState().kv.set(key, JSON.parse(JSON.stringify(value))); },
  async addActivity(entry) { memState().activity.push({ ...entry, id: entry.id ?? crypto.randomUUID() }); },
  async listActivity(filter = {}) {
    let list = [...memState().activity];
    if (filter.since) list = list.filter((a) => a.at >= filter.since!);
    if (filter.until) list = list.filter((a) => a.at < filter.until!);
    if (filter.kinds?.length) list = list.filter((a) => filter.kinds!.includes(a.kind));
    if (filter.locationCodes?.length) list = list.filter((a) => !a.locationCode || filter.locationCodes!.includes(a.locationCode));
    return list.sort((a, b) => b.at.localeCompare(a.at)).slice(0, filter.limit ?? 500);
  },
  async putDocs(collection, docs) {
    const st = memState();
    if (!st.docs) st.docs = new Map();
    const col = st.docs.get(collection) ?? new Map();
    for (const d of docs) col.set(d.id, JSON.parse(JSON.stringify(d)));
    st.docs.set(collection, col);
  },
  async listDocs<T>(collection: string, filter: DocFilter = {}) {
    const col = memState().docs?.get(collection);
    let list = col ? [...col.values()] as Doc<T>[] : [];
    if (filter.since) list = list.filter((d) => (d.at ?? '') >= filter.since!);
    if (filter.until) list = list.filter((d) => (d.at ?? '') < filter.until!);
    if (filter.keys?.length) list = list.filter((d) => d.key && filter.keys!.includes(d.key));
    list.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
    return list.slice(0, filter.limit ?? 100_000);
  },
  async getDoc<T>(collection: string, id: string) { return (memState().docs?.get(collection)?.get(id) as Doc<T> | undefined) ?? null; },
  async deleteDocs(collection, ids) { const col = memState().docs?.get(collection); for (const id of ids) col?.delete(id); },
};

// ---------------------------------------------------------------------------
// Supabase repository — production. Tables live in the `foodhub` schema of the shared TAKATAK Supabase project
// (prisma/migrations/*_food_hub_schema).
// ---------------------------------------------------------------------------

type Row = Record<string, any>;

function orderToRow(o: Partial<StoredOrder>): Row {
  const row: Row = {};
  if (o.channel !== undefined) row.channel = o.channel;
  if (o.marketplace !== undefined) row.marketplace = o.marketplace;
  if (o.externalOrderId !== undefined) row.external_order_id = o.externalOrderId;
  if (o.channelStoreId !== undefined) row.channel_store_id = o.channelStoreId;
  if (o.brandName !== undefined) row.brand_name = o.brandName;
  if (o.locationCode !== undefined) row.location_code = o.locationCode;
  if (o.status !== undefined) row.status = o.status;
  if (o.total !== undefined) row.total = o.total;
  if (o.posOrderId !== undefined) row.pos_order_id = o.posOrderId;
  if (o.posError !== undefined) row.pos_error = o.posError;
  if (o.channelError !== undefined) row.channel_error = o.channelError;
  if (o.placedAt !== undefined) row.placed_at = o.placedAt;
  if (o.timeline !== undefined) row.timeline = o.timeline;
  return row;
}

const DATA_FIELDS = ['lines', 'subtotal', 'tax', 'total', 'discount', 'deliveryFee', 'tip', 'notes', 'customerName', 'courier', 'readyBy', 'fulfillment'] as const;

function rowToOrder(r: Row): StoredOrder {
  return {
    ...(r.data as NormalizedOrder),
    id: r.id,
    status: r.status,
    locationCode: r.location_code ?? undefined,
    brandName: r.brand_name ?? (r.data as NormalizedOrder)?.brandName,
    posOrderId: r.pos_order_id ?? undefined,
    posError: r.pos_error ?? undefined,
    channelError: r.channel_error ?? undefined,
    timeline: r.timeline ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function storeToRow(s: Partial<ChannelStore>): Row {
  const row: Row = {};
  if (s.channel !== undefined) row.channel = s.channel;
  if (s.channelStoreId !== undefined) row.channel_store_id = s.channelStoreId;
  if (s.brandName !== undefined) row.brand_name = s.brandName;
  if (s.locationCode !== undefined) row.location_code = s.locationCode;
  if (s.cloverMerchantId !== undefined) row.clover_merchant_id = s.cloverMerchantId;
  if (s.autoAccept !== undefined) row.auto_accept = s.autoAccept;
  if (s.online !== undefined) row.online = s.online;
  if (s.pausedUntil !== undefined) row.paused_until = s.pausedUntil;
  if (s.lastStatusSource !== undefined) row.last_status_source = s.lastStatusSource;
  if (s.meta !== undefined) row.meta = s.meta;
  return row;
}

function rowToStore(r: Row): ChannelStore {
  return {
    id: r.id,
    channel: r.channel,
    channelStoreId: r.channel_store_id,
    brandName: r.brand_name,
    locationCode: r.location_code,
    cloverMerchantId: r.clover_merchant_id,
    autoAccept: r.auto_accept,
    online: r.online,
    pausedUntil: r.paused_until,
    lastStatusSource: r.last_status_source,
    meta: r.meta ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToJob(r: Row): FoodHubJob {
  return { id: r.id, kind: r.kind, channel: r.channel, reference: r.reference, status: r.status, request: r.request ?? {}, result: r.result, createdAt: r.created_at, updatedAt: r.updated_at };
}


function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data;
}

function supabaseRepo(): FoodHubRepo {
  const db = foodHubDb();
  const repo: FoodHubRepo = {
    mode: 'supabase',
    async insertOrderIfNew(order) {
      const existing = await repo.findOrder(order.channel, order.externalOrderId);
      if (existing) return { order: existing, isNew: false };
      const { createdAt, ...rest } = order;
      const row: Row = { ...orderToRow({ ...rest, status: 'new' }), data: rest };
      if (createdAt) row.created_at = createdAt;
      const res = await db.from('fh_orders').insert(row).select('*').single();
      if (res.error) {
        // Unique (channel, external_order_id) race: another webhook delivery won. Treat as duplicate.
        const again = await repo.findOrder(order.channel, order.externalOrderId);
        if (again) return { order: again, isNew: false };
        throw new Error(`Supabase: ${res.error.message}`);
      }
      return { order: rowToOrder(res.data), isNew: true };
    },
    async getOrder(id) {
      const res = await db.from('fh_orders').select('*').eq('id', id).maybeSingle();
      const data = must(res);
      return data ? rowToOrder(data) : null;
    },
    async findOrder(channel, externalOrderId) {
      const res = await db.from('fh_orders').select('*').eq('channel', channel).eq('external_order_id', externalOrderId).maybeSingle();
      const data = must(res);
      return data ? rowToOrder(data) : null;
    },
    async updateOrder(id, patch) {
      const row: Row = { ...orderToRow(patch), updated_at: nowIso() };
      // Order details (lines, amounts…) live in the data column: merge them when they change.
      if (DATA_FIELDS.some((f) => f in patch)) {
        const cur = must(await db.from('fh_orders').select('data').eq('id', id).maybeSingle());
        if (cur) {
          const merged = { ...(cur.data ?? {}) } as Row;
          for (const f of DATA_FIELDS) if (f in patch) merged[f] = (patch as Row)[f];
          row.data = merged;
        }
      }
      const res = await db.from('fh_orders').update(row).eq('id', id).select('*').maybeSingle();
      const data = must(res);
      return data ? rowToOrder(data) : null;
    },
    async listOrders(filter = {}) {
      // PostgREST returns at most 1000 rows per request on Supabase: page through.
      const limit = filter.limit ?? 200;
      const out: StoredOrder[] = [];
      for (let from = 0; from < limit; from += 1000) {
        const to = Math.min(limit, from + 1000) - 1;
        let q = db.from('fh_orders').select('*').order('created_at', { ascending: false }).range(from, to);
        if (filter.statuses?.length) q = q.in('status', filter.statuses);
        if (filter.since) q = q.gte('created_at', filter.since);
        if (filter.until) q = q.lt('created_at', filter.until);
        if (filter.locationCodes?.length) q = q.in('location_code', filter.locationCodes);
        const rows = (must(await q) ?? []) as Row[];
        out.push(...rows.map(rowToOrder));
        if (rows.length < to - from + 1) break;
      }
      return out;
    },
    async addEvent(orderId, type, detail = {}) {
      must(await db.from('fh_order_events').insert({ order_id: orderId, type, detail }));
    },
    async listEvents(orderId) {
      const data = must(await db.from('fh_order_events').select('*').eq('order_id', orderId).order('created_at'));
      return (data ?? []).map((r: Row) => ({ id: r.id, orderId: r.order_id, type: r.type, detail: r.detail, at: r.created_at }));
    },
    async listStores(channel) {
      let q = db.from('fh_channel_stores').select('*').order('brand_name').order('location_code');
      if (channel) q = q.eq('channel', channel);
      return (must(await q) ?? []).map(rowToStore);
    },
    async findStore(channel, channelStoreId) {
      const data = must(await db.from('fh_channel_stores').select('*').eq('channel', channel).eq('channel_store_id', channelStoreId).maybeSingle());
      return data ? rowToStore(data) : null;
    },
    async getStore(id) {
      const data = must(await db.from('fh_channel_stores').select('*').eq('id', id).maybeSingle());
      return data ? rowToStore(data) : null;
    },
    async upsertStore(store) {
      const row = { ...storeToRow(store), updated_at: nowIso() };
      const res = store.id
        ? await db.from('fh_channel_stores').update(row).eq('id', store.id).select('*').single()
        : await db.from('fh_channel_stores').upsert(row, { onConflict: 'channel,channel_store_id' }).select('*').single();
      return rowToStore(must(res));
    },
    async updateStore(id, patch) {
      const data = must(await db.from('fh_channel_stores').update({ ...storeToRow(patch), updated_at: nowIso() }).eq('id', id).select('*').maybeSingle());
      return data ? rowToStore(data) : null;
    },
    async deleteStore(id) { must(await db.from('fh_channel_stores').delete().eq('id', id)); },
    async getMenu(brandName) {
      const data = must(await db.from('fh_menus').select('*').eq('brand_name', brandName).maybeSingle());
      return data ? (data.menu as MasterMenu) : null;
    },
    async saveMenu(menu) {
      const next = { ...menu, updatedAt: nowIso() };
      must(await db.from('fh_menus').upsert({ brand_name: menu.brandName, menu: next, updated_at: next.updatedAt }, { onConflict: 'brand_name' }));
      return next;
    },
    async listMenus() {
      const data = must(await db.from('fh_menus').select('menu').order('brand_name'));
      return (data ?? []).map((r: Row) => r.menu as MasterMenu);
    },
    async addJob(job) {
      const data = must(await db.from('fh_jobs').insert({ kind: job.kind, channel: job.channel, reference: job.reference, status: job.status, request: job.request, result: job.result ?? null }).select('*').single());
      return rowToJob(data);
    },
    async findJobByReference(reference) {
      const data = must(await db.from('fh_jobs').select('*').eq('reference', reference).order('created_at', { ascending: false }).limit(1).maybeSingle());
      return data ? rowToJob(data) : null;
    },
    async updateJob(id, patch) {
      const row: Row = { updated_at: nowIso() };
      if (patch.status) row.status = patch.status;
      if (patch.result !== undefined) row.result = patch.result;
      if (patch.reference !== undefined) row.reference = patch.reference;
      must(await db.from('fh_jobs').update(row).eq('id', id));
    },
    async listJobs(limit = 50) {
      const data = must(await db.from('fh_jobs').select('*').order('created_at', { ascending: false }).limit(limit));
      return (data ?? []).map(rowToJob);
    },
    async getKv<T>(key: string) {
      const data = must(await db.from('fh_kv').select('value').eq('key', key).maybeSingle());
      return data ? (data.value as T) : null;
    },
    async setKv(key, value) {
      must(await db.from('fh_kv').upsert({ key, value, updated_at: nowIso() }, { onConflict: 'key' }));
    },
    async addActivity(e) {
      must(await db.from('fh_activity').insert({
        at: e.at, actor: e.actor, source: e.source, kind: e.kind, action: e.action, status: e.status, summary: e.summary,
        channel: e.channel ?? null, brand_name: e.brandName ?? null, location_code: e.locationCode ?? null, store_id: e.storeId ?? null, order_id: e.orderId ?? null, detail: e.detail ?? {},
      }));
    },
    async listActivity(filter = {}) {
      const limit = filter.limit ?? 500;
      const out: ActivityEntry[] = [];
      for (let from = 0; from < limit; from += 1000) {
        const to = Math.min(limit, from + 1000) - 1;
        let q = db.from('fh_activity').select('*').order('at', { ascending: false }).range(from, to);
        if (filter.since) q = q.gte('at', filter.since);
        if (filter.until) q = q.lt('at', filter.until);
        if (filter.kinds?.length) q = q.in('kind', filter.kinds);
        if (filter.locationCodes?.length) q = q.or(`location_code.is.null,location_code.in.(${filter.locationCodes.map((c) => `"${c}"`).join(',')})`);
        const rows = (must(await q) ?? []) as Row[];
        out.push(...rows.map((r) => ({
          id: r.id, at: r.at, actor: r.actor, source: r.source, kind: r.kind, action: r.action, status: r.status, summary: r.summary,
          channel: r.channel, brandName: r.brand_name, locationCode: r.location_code, storeId: r.store_id, orderId: r.order_id, detail: r.detail ?? {},
        })));
        if (rows.length < to - from + 1) break;
      }
      return out;
    },
    async putDocs(collection, docs) {
      for (let i = 0; i < docs.length; i += 500) {
        const rows = docs.slice(i, i + 500).map((d) => ({ collection, id: d.id, key: d.key ?? null, at: d.at ?? null, data: d.data, updated_at: nowIso() }));
        must(await db.from('fh_docs').upsert(rows, { onConflict: 'collection,id' }));
      }
    },
    async listDocs<T>(collection: string, filter: DocFilter = {}) {
      const limit = filter.limit ?? 100_000;
      const out: Doc<T>[] = [];
      const keys = filter.keys?.length ? filter.keys : null;
      for (let from = 0; from < limit; from += 1000) {
        const to = Math.min(limit, from + 1000) - 1;
        let q = db.from('fh_docs').select('id,key,at,data').eq('collection', collection).order('at', { ascending: false, nullsFirst: false }).range(from, to);
        if (filter.since) q = q.gte('at', filter.since);
        if (filter.until) q = q.lt('at', filter.until);
        if (keys) q = q.in('key', keys.slice(0, 500));
        const rows = (must(await q) ?? []) as Row[];
        out.push(...rows.map((r) => ({ id: r.id, key: r.key, at: r.at, data: r.data as T })));
        if (rows.length < to - from + 1) break;
      }
      return out;
    },
    async getDoc<T>(collection: string, id: string) {
      const r = must(await db.from('fh_docs').select('id,key,at,data').eq('collection', collection).eq('id', id).maybeSingle());
      return r ? { id: r.id, key: r.key, at: r.at, data: r.data as T } : null;
    },
    async deleteDocs(collection, ids) {
      for (let i = 0; i < ids.length; i += 500) must(await db.from('fh_docs').delete().eq('collection', collection).in('id', ids.slice(i, i + 500)));
    },
  };
  return repo;
}

let cached: FoodHubRepo | null = null;
export function getRepo(): FoodHubRepo {
  if (process.env.FOODHUB_FORCE_MEMORY === 'true' || !hasFoodHubDatabase()) return memoryRepo;
  if (!cached) cached = supabaseRepo();
  return cached;
}
