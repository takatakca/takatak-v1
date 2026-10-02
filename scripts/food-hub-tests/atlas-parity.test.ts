import { describe, expect, it, beforeEach } from './shim';
import { unzipSync, strFromU8 } from 'fflate';
import { offlineIntervals, customerKey } from '../../src/lib/food-hub/analytics';
import { scopeFilter, inScope } from '../../src/lib/food-hub/session';
import { allDayWeek, emptyWeek, intersectWeeks, normalizeWeek, openIntervals, dayKeyOf } from '../../src/lib/food-hub/hours';
import { scheduleGroups, toDoorDashMenu, toSkipMenu, toUberHolidayHours, toUberMenu, platformDescription } from '../../src/lib/food-hub/menu/translate';
import { verifyMenu } from '../../src/lib/food-hub/menu/verify';
import { menuForLocation, offRefsAt } from '../../src/lib/food-hub/ops';
import { duePeriod, toCsv, toXlsx } from '../../src/lib/food-hub/reports';
import { can, WORKSPACE_ROLE_TO_FOOD_HUB } from '../../src/lib/food-hub/session';
import type { ActivityEntry, MasterMenu, PublishContext, StoredOrder, WeeklyHours } from '../../src/lib/food-hub/types';

const week = (open: string, close: string, days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']): WeeklyHours => {
  const w = emptyWeek();
  for (const d of days) (w as any)[d] = [{ open, close }];
  return w;
};

const menu: MasterMenu = {
  brandName: 'Po Poulet',
  categories: [{ ref: 'c1', name: 'Plats', sortOrder: 0 }, { ref: 'c2', name: 'Déjeuner', sortOrder: 1, hours: week('07:00', '11:00') }],
  items: [
    { ref: 'i1', name: 'Poulet', price: 14.99, categoryRef: 'c1', available: true, modifierGroupRefs: ['g1'], posItemRef: 'i1', tags: ['spicy'], allergens: ['peanuts'] },
    { ref: 'i2', name: 'Oeufs', price: 9.5, categoryRef: 'c2', available: true, modifierGroupRefs: [], posItemRef: 'i2' },
  ],
  modifierGroups: [{ ref: 'g1', name: 'Sauce', min: 0, max: 1, modifiers: [{ ref: 'm1', name: 'Piri', price: 1, available: true }] }],
  updatedAt: new Date().toISOString(),
};
const ctx: PublishContext = { hours: week('10:00', '22:00'), holidays: [{ id: 'h', date: '2026-12-25', name: 'Noël', locationCodes: [], closed: true }], timezone: 'America/Toronto', today: '2026-10-01' };

describe('store hours', () => {
  it('splits overnight slots and merges overlaps', () => {
    const w = normalizeWeek({ friday: [{ open: '22:00', close: '02:00' }, { open: '11:00', close: '15:00' }, { open: '14:00', close: '16:00' }] } as any);
    expect(w.friday).toEqual([{ open: '11:00', close: '16:00' }, { open: '22:00', close: '23:59' }]);
    expect(w.saturday).toEqual([{ open: '00:00', close: '02:00' }]);
  });
  it('intersects a category schedule with store hours', () => {
    expect(intersectWeeks(week('07:00', '11:00'), week('10:00', '22:00')).monday).toEqual([{ open: '10:00', close: '11:00' }]);
  });
  it('computes open intervals honouring a closed holiday', () => {
    const from = Date.parse('2026-12-24T05:00:00Z'); // Dec 24 00:00 Montréal
    const to = Date.parse('2026-12-26T05:00:00Z');
    const open = openIntervals(week('10:00', '22:00'), ctx.holidays, from, to, 'America/Toronto');
    expect(open).toHaveLength(1); // only Dec 24, Dec 25 is closed
    expect(new Date(open[0][0]).toISOString()).toBe('2026-12-24T15:00:00.000Z');
    expect(dayKeyOf('2026-10-01')).toBe('thursday');
  });
});

describe('menu translators with hours, holidays and schedules', () => {
  it('groups scheduled categories separately, intersected with store hours', () => {
    const g = scheduleGroups(menu, ctx.hours!);
    expect(g.map((x) => x.categories.map((c) => c.ref))).toEqual([['c1'], ['c2']]);
    expect(g[1].hours.monday).toEqual([{ open: '10:00', close: '11:00' }]);
  });
  it('Uber: one menu per schedule with service availability + holiday-hours body', () => {
    const u = toUberMenu(menu, ctx);
    expect(u.menus).toHaveLength(2);
    expect(u.menus[0].service_availability[0]).toEqual({ day_of_week: 'monday', time_periods: [{ start_time: '10:00', end_time: '22:00' }] });
    expect(u.menus[1].category_ids).toEqual(['c2']);
    expect(toUberHolidayHours(ctx.holidays)).toEqual({ holiday_hours: { '2026-12-25': { open_time_periods: [{ start_time: '00:00', end_time: '00:00' }] } } });
    expect((u.items.find((i: any) => i.id === 'i1') as any).description.translations.en).toContain('Spicy');
  });
  it('DoorDash: open_hours with seconds, closed days as 00:00, special_hours, item hours for scheduled categories', () => {
    const d = toDoorDashMenu(menu, 'msid', 'prov', 'ref', { ...ctx, hours: week('10:00', '22:00', ['monday']) });
    expect(d.open_hours.find((h: any) => h.day_index === 'MON')).toEqual({ day_index: 'MON', start_time: '10:00:00', end_time: '22:00:00' });
    expect(d.open_hours.find((h: any) => h.day_index === 'TUE')).toEqual({ day_index: 'TUE', start_time: '00:00:00', end_time: '00:00:00' });
    expect(d.special_hours).toEqual([{ date: '2026-12-25', closed: true, start_time: '00:00:00', end_time: '00:00:00' }]);
    const breakfast = d.menu.categories.find((c: any) => c.merchant_supplied_id === 'c2')!.items[0] as any;
    expect(breakfast.item_special_hours[0]).toMatchObject({ day_index: 'MON', start_time: '10:00:00', end_time: '11:00:00', start_date: '2026-10-01' });
  });
  it('Skip: availability per menu, breakfast as its own menu', () => {
    const s = toSkipMenu(menu, ['R1'], undefined, new Set(), ctx);
    expect(s.menus).toHaveLength(2);
    expect(s.menus[0].availability.monday).toEqual(['10:00 - 22:00']);
    expect(s.menus[1].availability.monday).toEqual(['10:00 - 11:00']);
  });
  it('description carries tags and allergens', () => {
    expect(platformDescription(menu.items[0])).toBe('Spicy — Contains: peanuts');
  });
});

describe('86 at a location incl. modifiers and timers', () => {
  it('switches off items and modifiers, ignores expired timers', () => {
    const m: MasterMenu = { ...menu, unavailableByLocation: { NDG_MAIN: ['i1', 'm1', 'i2'] }, unavailableUntil: { 'NDG_MAIN|i2': Date.now() - 1000 } };
    expect([...offRefsAt(m, 'NDG_MAIN')].sort()).toEqual(['i1', 'm1']);
    const eff = menuForLocation(m, 'NDG_MAIN');
    expect(eff.items.find((i) => i.ref === 'i1')!.available).toBe(false);
    expect(eff.items.find((i) => i.ref === 'i2')!.available).toBe(true);
    expect(eff.modifierGroups[0].modifiers[0].available).toBe(false);
  });
});

describe('menu verification', () => {
  it('blocks real errors and warns about missing hours', () => {
    const bad: MasterMenu = { ...menu, items: [...menu.items, { ref: 'i1', name: '', price: -1, categoryRef: 'nope', available: true, modifierGroupRefs: ['ghost'] }] };
    const r = verifyMenu(bad, { stores: [{ id: 's', channel: 'uber_eats', channelStoreId: 'u', brandName: 'Po Poulet', locationCode: 'NDG_MAIN', autoAccept: true, online: true, meta: {} }], hours: { locations: {}, brands: {}, holidays: [] } });
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toEqual(expect.arrayContaining(['duplicate_ref', 'item_name', 'item_category', 'item_price', 'missing_group']));
    expect(r.warnings.map((e) => e.code)).toContain('no_hours');
    expect(verifyMenu(menu, { stores: [], hours: { locations: {}, brands: {}, holidays: [] } }).ok).toBe(true);
  });
});

describe('TAKATAK roles in Food Hub', () => {
  it('maps every TAKATAK workspace role to a Food Hub role', () => {
    expect(WORKSPACE_ROLE_TO_FOOD_HUB).toEqual({ owner: 'owner', admin: 'owner', manager: 'manager', editor: 'menu', staff: 'operator', viewer: 'analyst' });
    expect(can(WORKSPACE_ROLE_TO_FOOD_HUB.viewer, 'orders:act')).toBe(false);
    expect(can(WORKSPACE_ROLE_TO_FOOD_HUB.staff, 'orders:act')).toBe(true);
    expect(can(WORKSPACE_ROLE_TO_FOOD_HUB.manager, 'finance:edit')).toBe(true);
    expect(can(WORKSPACE_ROLE_TO_FOOD_HUB.manager, 'admin')).toBe(false);
    expect(can(WORKSPACE_ROLE_TO_FOOD_HUB.admin, 'admin')).toBe(true);
  });
  it('applies role permissions and location scope', () => {
    expect(can('operator', 'orders:act')).toBe(true);
    expect(can('operator', 'menu:edit')).toBe(false);
    expect(can('analyst', 'orders:act')).toBe(false);
    const op = { username: 'm', name: 'M', role: 'operator' as const, locations: ['NDG_MAIN'], source: 'dashboard' as const };
    expect(inScope(op, 'NDG_MAIN')).toBe(true);
    expect(inScope(op, 'HOCHELAGA')).toBe(false);
    expect(scopeFilter(op, ['HOCHELAGA'])).toEqual(['__none__']);
    expect(scopeFilter({ ...op, locations: [] }, undefined)).toBeUndefined();
  });
});

describe('reports', () => {
  const table = { key: 'order_transactions' as const, title: 'Order Transactions', columns: ['Id', 'Customer', 'Total'], rows: [['o1', '=HYPERLINK("x")', 12.5], ['o2', 'Café, "Le"', -3]], filename: 'x' };
  it('CSV: BOM, quoting, formula injection neutralised', () => {
    const csv = toCsv(table);
    expect(csv.startsWith('﻿Id,Customer,Total')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"Café, ""Le"""');
  });
  it('XLSX is a valid zip with the sheet and numbers', () => {
    const files = unzipSync(toXlsx(table));
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']));
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('<v>12.5</v>');
    expect(sheet).toContain('Café, &quot;Le&quot;');
  });
  it('schedules: daily after 8:00, weekly on Mondays, monthly on the 1st', () => {
    process.env.FOODHUB_TIMEZONE = 'America/Toronto';
    expect(duePeriod('daily', Date.parse('2026-10-02T11:00:00Z'))).toBeNull(); // 07:00 local
    expect(duePeriod('daily', Date.parse('2026-10-02T13:00:00Z'))?.key).toBe('d:2026-10-01');
    expect(duePeriod('weekly', Date.parse('2026-10-02T13:00:00Z'))).toBeNull(); // Friday
    expect(duePeriod('weekly', Date.parse('2026-10-05T13:00:00Z'))?.key).toBe('w:2026-09-28');
    expect(duePeriod('monthly', Date.parse('2026-10-01T13:00:00Z'))?.key).toBe('m:2026-09');
  });
});

describe('analytics helpers', () => {
  it('offline intervals from the status history', () => {
    const e = (at: string, action: string): ActivityEntry => ({ at, action, kind: 'store_status', storeId: 's1', status: 'success', actor: 'x', source: 'dashboard', summary: '' });
    const from = Date.parse('2026-10-01T14:00:00Z'); const to = Date.parse('2026-10-01T18:00:00Z');
    const list = [e('2026-10-01T13:00:00Z', 'pause'), e('2026-10-01T15:00:00Z', 'resume'), e('2026-10-01T16:30:00Z', 'platform_deactivated')];
    const off = offlineIntervals(list, 's1', from, to);
    expect(off.map(([a, b]) => (b - a) / 60000)).toEqual([60, 90]);
  });
  it('customer key only when the platform shares an id', () => {
    expect(customerKey({ channel: 'uber_eats', raw: { eater: { id: 'e1' } } } as unknown as StoredOrder)).toBe('uber_eats:e1');
    expect(customerKey({ channel: 'skip', raw: { delivery: { first_name: '****' } } } as unknown as StoredOrder)).toBeNull();
    expect(allDayWeek().sunday).toEqual([{ open: '00:00', close: '23:59' }]);
  });
});
