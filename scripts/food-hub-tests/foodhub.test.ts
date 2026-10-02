import crypto from 'node:crypto';
import { describe, expect, it, beforeEach } from './shim';
import { buildMatrix } from '../../src/lib/food-hub/command';
import { doorDashJwt, normalizeDoorDashDetails, parseDoorDashOrder } from '../../src/lib/food-hub/adapters/doordash';
import { localHour, startOfLocalDayMs } from '../../src/lib/food-hub/time';
import { parseGenericOrder } from '../../src/lib/food-hub/adapters/partner';
import { localTimestamp, parseSkipOrder, skipAdapter, verifyJetHash } from '../../src/lib/food-hub/adapters/skip';
import { normalizeUberStatus, parseUberOrder, uberEatsAdapter } from '../../src/lib/food-hub/adapters/uber-eats';
import { toDoorDashMenu, toSkipMenu, toUberMenu } from '../../src/lib/food-hub/menu/translate';
import type { MasterMenu } from '../../src/lib/food-hub/types';

const menu: MasterMenu = {
  brandName: 'Po Poulet',
  categories: [{ ref: 'c1', name: 'Plats', sortOrder: 0 }],
  items: [{ ref: 'i1', name: 'Poulet', price: 14.99, categoryRef: 'c1', available: true, modifierGroupRefs: ['g1'], channelPrices: { doordash: 15.99 } }],
  modifierGroups: [{ ref: 'g1', name: 'Sauce', min: 0, max: 1, modifiers: [{ ref: 'm1', name: 'Piri', price: 1, available: true }] }],
  updatedAt: new Date().toISOString(),
};

describe('Food Hub webhook security', () => {
  beforeEach(() => {
    process.env.UBER_CLIENT_SECRET = 'secret';
    process.env.SKIP_WEBHOOK_HMAC_SECRET = 'key';
    process.env.SKIP_WEBHOOK_API_KEY = 'skip-api-key';
  });
  it('accepts a correct Uber signature and rejects a wrong one', () => {
    const body = '{"event_type":"orders.notification"}';
    const sig = crypto.createHmac('sha256', 'secret').update(body).digest('hex');
    expect(uberEatsAdapter.verifyWebhook(new Headers({ 'x-uber-signature': sig }), body)).toBe(true);
    expect(uberEatsAdapter.verifyWebhook(new Headers({ 'x-uber-signature': 'abc' }), body)).toBe(false);
  });
  it('verifies JET Connect HMAC exactly like JET\'s published example (secret "key", body "example")', () => {
    expect(verifyJetHash('HMAC-SHA256 t=1673428038618,signature=FGwot7AqiDIthEv6TippJm35DaRpRac5NSLd/wSp9go=', 'example', 'key')).toBe(true);
    expect(verifyJetHash('HMAC-SHA256 t=1673428038618,signature=FGwot7AqiDIthEv6TippJm35DaRpRac5NSLd/wSp9go=', 'tampered', 'key')).toBe(false);
  });
  it('accepts Skip notifications by API key and rejects unsigned calls', () => {
    expect(skipAdapter.verifyWebhook(new Headers({ authorization: 'skip-api-key' }), '{}')).toBe(true);
    expect(skipAdapter.verifyWebhook(new Headers({ authorization: 'wrong' }), '{}')).toBe(false);
    expect(skipAdapter.verifyWebhook(new Headers(), '{}')).toBe(false);
  });
  it('formats JET onlineAt as local Montréal time', () => {
    expect(localTimestamp(Date.UTC(2026, 9, 1, 18, 30, 0), 'America/Toronto')).toBe('2026-10-01 14:30:00');
  });
});

describe('DoorDash JWT', () => {
  it('produces an HS256 token with dd-ver and doordash audience', () => {
    process.env.DOORDASH_DEVELOPER_ID = 'dev';
    process.env.DOORDASH_KEY_ID = 'key';
    process.env.DOORDASH_SIGNING_SECRET = Buffer.from('s3cret-s3cret').toString('base64');
    const [h, p, s] = doorDashJwt(1700000000).split('.');
    const dec = (x: string) => JSON.parse(Buffer.from(x, 'base64url').toString());
    expect(dec(h)['dd-ver']).toBe('DD-JWT-V1');
    expect(dec(p)).toMatchObject({ aud: 'doordash', iss: 'dev', kid: 'key', iat: 1700000000, exp: 1700000300 });
    const expected = crypto.createHmac('sha256', Buffer.from('s3cret-s3cret')).update(`${h}.${p}`).digest('base64url');
    expect(s).toBe(expected);
  });
});

describe('order parsers', () => {
  it('parses the JET Connect order example (Skip)', () => {
    const o = parseSkipOrder({
      id: '38bbeb45-f520-4438-a44f-0fcdbb29e166', transmission_id: 'tx-1', third_party_order_reference: '22721763', type: 'delivery-by-delivery-partner', posLocationId: 'AKZ12',
      items: [{ name: 'Cheeseburger', plu: 'M2', price: 1700, notes: '', children: [{ name: 'Extra Sauce', plu: 'R3', price: 100 }] }],
      created_at: '1606780145', collect_at: '1606780980', kitchen_notes: 'No onions',
      payment: { items_in_cart: { inc_tax: 2160, tax: 360 }, final: { inc_tax: 2160, tax: 360 } }, delivery: { first_name: '****' }, total: 2160,
    })!;
    expect(o).toMatchObject({ marketplace: 'skip', externalOrderId: '38bbeb45-f520-4438-a44f-0fcdbb29e166', displayId: '22721763', channelStoreId: 'AKZ12', total: 21.6, tax: 3.6, subtotal: 18, fulfillment: 'delivery', notes: 'No onions' });
    expect(o.customerName).toBeUndefined();
    expect(o.lines[0]).toMatchObject({ externalId: 'M2', unitPrice: 17, total: 18, quantity: 1 });
    expect(o.lines[0].modifiers[0]).toMatchObject({ name: 'Extra Sauce', unitPrice: 1 });
    expect(o.placedAt).toBe(new Date(1606780145000).toISOString());
  });
  it('parses Uber money in cents and amount_e5', () => {
    const o = parseUberOrder({ id: 'u1', store: { id: 's1' }, cart: { items: [{ title: 'A', quantity: 1, price: { unit_price: { amount: 1250 } } }] }, payment: { charges: { total: { amount_e5: 1437500 } } }, type: 'PICK_UP' })!;
    expect(o.lines[0].unitPrice).toBe(12.5);
    expect(o.total).toBe(14.375);
    expect(o.fulfillment).toBe('pickup');
  });
  it('parses a DoorDash order (cents)', () => {
    const o = parseDoorDashOrder({ id: 'd1', store: { merchant_supplied_id: 'm1' }, subtotal: 1000, tax: 150, categories: [{ items: [{ name: 'A', quantity: 1, price: 1000, extras: [{ options: [{ name: 'X', price: 50 }] }] }] }] })!;
    expect(o).toMatchObject({ channelStoreId: 'm1', subtotal: 10, tax: 1.5, total: 11.5 });
    expect(o.lines[0].modifiers[0].unitPrice).toBe(0.5);
  });
  it('returns null for unknown partner payloads instead of guessing', () => {
    expect(parseGenericOrder('skip', 'skip', { hello: 'world' })).toBeNull();
  });
});

describe('menu translators', () => {
  it('builds a Skip (JET Connect) menu with PLUs, cents and pick rules', () => {
    const m = toSkipMenu(menu, ['NDG-POPOULET'], 'https://x/cb');
    expect(m.restaurants).toEqual(['NDG-POPOULET']);
    expect(m.callback_url).toBe('https://x/cb');
    const item = m.menus[0].categories[0].items[0];
    expect(item).toMatchObject({ name: 'Poulet', plu: 'i1', price: 1499, out_of_stock: false });
    expect(item.modifiers[0].pick).toEqual({ pick_same_option: false, range: { from: 0, to: 1 } });
    expect(item.modifiers[0].options[0]).toMatchObject({ plu: 'm1', price: 100 });
    expect(m.menus[0].availability.monday).toEqual(['00:00 - 23:59']);
  });
  it('builds an Uber menu in cents with modifiers as items', () => {
    const u = toUberMenu(menu);
    expect(u.items.find((i) => i.id === 'i1')?.price_info.price).toBe(1499);
    expect(u.modifier_groups[0].modifier_options).toEqual([{ id: 'mod:m1', type: 'ITEM' }]);
    expect(u.menus[0].service_availability).toHaveLength(7);
  });
  it('builds a DoorDash menu using the DoorDash price', () => {
    const d = toDoorDashMenu(menu, 'msid', 'prov', 'ref');
    expect(d.store).toEqual({ merchant_supplied_id: 'msid', provider_type: 'prov' });
    expect(d.menu.categories[0].items[0].price).toBe(1599);
    expect(d.open_hours).toHaveLength(7);
  });
});

describe('platform status normalizers', () => {
  it('maps Uber store status (ONLINE / OUT_OF_MENU_HOURS / PAUSED / INVISIBLE)', () => {
    expect(normalizeUberStatus({ status: 'ONLINE' }).state).toBe('online');
    expect(normalizeUberStatus({ status: 'OFFLINE', offlineReason: 'OUT_OF_MENU_HOURS' }).state).toBe('closed');
    expect(normalizeUberStatus({ status: 'PAUSED', offlineReason: 'PAUSED_BY_RESTAURANT' }).state).toBe('paused');
    expect(normalizeUberStatus({ status: 'OFFLINE', offlineReason: 'INVISIBLE' }).state).toBe('deactivated');
  });
  it('maps DoorDash store_details current_deactivations', () => {
    expect(normalizeDoorDashDetails({ merchant_supplied_id: 'x', current_deactivations: [] }).state).toBe('online');
    expect(normalizeDoorDashDetails({ current_deactivations: [{ reason: 'Merchant operational issues', end_time: '2026-10-01T20:00:00Z' }] })).toMatchObject({ state: 'paused', until: '2026-10-01T20:00:00Z' });
    expect(normalizeDoorDashDetails({ current_deactivations: [{ reason: 'Merchant operational issues', notes: 'store deactivated' }] })).toMatchObject({ state: 'deactivated', detail: 'Merchant operational issues — store deactivated' });
  });
});

describe('business day + command center matrix', () => {
  it('starts the business day at Montréal midnight (EDT and EST)', () => {
    expect(new Date(startOfLocalDayMs(Date.UTC(2026, 9, 1, 18, 0), 'America/Toronto')).toISOString()).toBe('2026-10-01T04:00:00.000Z');
    expect(new Date(startOfLocalDayMs(Date.UTC(2026, 0, 15, 3, 30), 'America/Toronto')).toISOString()).toBe('2026-01-14T05:00:00.000Z');
    expect(localHour(Date.UTC(2026, 9, 1, 18, 0), 'America/Toronto')).toBe(14);
  });
  it('builds brand × location × channel cells from mappings and screenshot seed', () => {
    const rows = buildMatrix([
      { id: 's1', channel: 'uber_eats', channelStoreId: 'u1', brandName: 'Po Poulet', locationCode: 'NDG_MAIN', autoAccept: true, online: true, meta: { platformStatus: { state: 'online', checkedAt: '2026-10-01T00:00:00Z', source: 'sync' } } },
    ]);
    const po = rows.find((r) => r.brandName === 'Po Poulet' && r.locationCode === 'NDG_MAIN')!;
    expect(po.cells.uber_eats).toMatchObject({ state: 'online', source: 'live' });
    expect(po.cells.skip).toMatchObject({ state: 'missing', source: 'none' });
    const nut = rows.find((r) => r.brandName === 'Nutrition Shake' && r.locationCode === 'NDG_6284')!;
    expect(nut.cells.doordash).toMatchObject({ state: 'closed', source: 'screenshot' });
    const nutMain = rows.find((r) => r.brandName === 'Nutrition Shake' && r.locationCode === 'NDG_MAIN')!;
    expect(nutMain.cells.doordash.state).toBe('deactivated');
  });
});

describe('sync housekeeping', () => {
  it('closes in-kitchen orders after FOODHUB_AUTO_COMPLETE_MIN and logs it', async () => {
    process.env.FOODHUB_FORCE_MEMORY = 'true';
    process.env.FOODHUB_AUTO_COMPLETE_MIN = '90';
    const { getRepo } = await import('../../src/lib/food-hub/repo');
    const { autoCompleteOldOrders } = await import('../../src/lib/food-hub/sync');
    const repo = getRepo();
    const base = { channel: 'uber_eats' as const, marketplace: 'uber_eats' as const, channelStoreId: 's', fulfillment: 'delivery' as const, placedAt: new Date().toISOString(), currency: 'CAD', subtotal: 10, tax: 0, deliveryFee: 0, tip: 0, discount: 0, total: 10, lines: [], raw: {} };
    const { order: a } = await repo.insertOrderIfNew({ ...base, externalOrderId: 'old-1' });
    const { order: b } = await repo.insertOrderIfNew({ ...base, externalOrderId: 'new-1' });
    await repo.updateOrder(a.id, { status: 'accepted' });
    expect(await autoCompleteOldOrders(Date.now() + 60 * 60_000)).toBe(0);
    expect(await autoCompleteOldOrders(Date.now() + 2 * 3600_000)).toBe(1);
    expect((await repo.getOrder(a.id))?.status).toBe('completed');
    expect((await repo.getOrder(b.id))?.status).toBe('new');
    expect((await repo.listEvents(a.id)).some((e) => e.type === 'auto_completed')).toBe(true);
  });
});
