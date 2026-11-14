// Translates the TAKATAK master menu into each platform's menu format.
// Formats follow the published specs:
//   SkipTheDishes  POST https://api.flytplatform.com/menus   (JET Connect)
//   Uber Eats      PUT  /v2/eats/stores/{store_id}/menus
//   DoorDash       POST /marketplace/api/v1/menus
// Store hours, holidays and category schedules come from the PublishContext (lib/food-hub/hours.ts).
import { toCents } from '../config';
import { allDayWeek, dayKeyOf, DAYS, intersectWeeks, normalizeWeek, weekIsEmpty } from '../hours';
import type { DayKey, Holiday, Marketplace, MasterMenu, MenuCategory, MenuItem, MenuLanguage, PublishContext, WeeklyHours } from '../types';
import { label } from './language';

/** 24/7 — only used when no store hours were ever set (the menu verifier warns about it). */
export function defaultHours(): WeeklyHours {
  return allDayWeek();
}

export function priceFor(item: MenuItem, marketplace: Marketplace): number {
  const override = item.channelPrices?.[marketplace];
  return typeof override === 'number' && override > 0 ? override : item.price;
}

/** Items that are in a valid category, in category order. */
function liveItems(menu: MasterMenu) {
  const cats = new Set(menu.categories.map((c) => c.ref));
  return menu.items.filter((i) => cats.has(i.categoryRef));
}

const TAG_LABELS: Record<string, string> = { vegetarian: 'Vegetarian', vegan: 'Vegan', gluten_free: 'Gluten-free', spicy: 'Spicy', halal: 'Halal', alcohol: 'Contains alcohol' };
const TAG_LABELS_FR: Record<string, string> = { vegetarian: 'Végétarien', vegan: 'Végétalien', gluten_free: 'Sans gluten', spicy: 'Épicé', halal: 'Halal', alcohol: "Contient de l'alcool" };

/** Description shown on every platform: text + dietary tags + allergens + calories (English or French). */
export function platformDescription(item: MenuItem, lang: 'en' | 'fr' = 'en'): string {
  const fr = lang === 'fr';
  const extras = [
    (item.tags ?? []).map((t) => (fr ? TAG_LABELS_FR : TAG_LABELS)[t] ?? t).join(' · '),
    item.allergens?.length ? `${fr ? 'Contient' : 'Contains'}: ${item.allergens.join(', ')}` : '',
    typeof item.calories === 'number' && item.calories > 0 ? `${Math.round(item.calories)} cal` : '',
  ].filter(Boolean);
  const body = fr ? (item.descriptionFr?.trim() || item.description?.trim() || '') : (item.description?.trim() || '');
  return [body, extras.join(' — ')].filter(Boolean).join('\n').slice(0, 500);
}

/** Description in the platform's chosen language ("both" = French first, then English). */
function describe(item: MenuItem, lang: MenuLanguage = 'en'): string {
  if (lang === 'fr') return platformDescription(item, 'fr');
  if (lang === 'both' && (item.descriptionFr || item.nameFr)) {
    const fr = platformDescription(item, 'fr'); const en = platformDescription(item, 'en');
    return (fr === en ? en : `${fr}\n—\n${en}`).slice(0, 500);
  }
  return platformDescription(item, 'en');
}

function storeWeek(menu: MasterMenu, ctx?: PublishContext): WeeklyHours {
  if (ctx?.hours && !weekIsEmpty(ctx.hours)) return normalizeWeek(ctx.hours);
  if (ctx?.hours) return normalizeWeek(ctx.hours); // explicitly closed every day
  return menu.hours ? normalizeWeek(menu.hours) : defaultHours();
}

/** Categories grouped by the hours they are sold: [store-hours group, ...scheduled groups]. */
export function scheduleGroups(menu: MasterMenu, store: WeeklyHours): Array<{ key: string; hours: WeeklyHours; categories: MenuCategory[] }> {
  const groups = new Map<string, { key: string; hours: WeeklyHours; categories: MenuCategory[] }>();
  for (const c of menu.categories) {
    const own = c.hours && !weekIsEmpty(c.hours) ? intersectWeeks(normalizeWeek(c.hours), store) : null;
    const hours = own ?? store;
    const key = own ? JSON.stringify(own) : 'store';
    if (own && weekIsEmpty(own)) continue; // category schedule never overlaps store hours → not sold
    const g = groups.get(key) ?? { key, hours, categories: [] };
    g.categories.push(c);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => (a.key === 'store' ? -1 : b.key === 'store' ? 1 : 0));
}

// ---------------- SkipTheDishes (JET Connect) ----------------
// POST https://api.flytplatform.com/menus — items identified by PLU (we use the item ref,
// which is the Clover item id after an import), prices in cents, modifiers with pick rules.
// Scheduled categories (e.g. breakfast) become extra menus with their own availability.
export function toSkipMenu(menu: MasterMenu, restaurantRefs: string[], callbackUrl?: string, offRefs: Set<string> = new Set(), ctx?: PublishContext) {
  const items = liveItems(menu);
  const store = storeWeek(menu, ctx);
  const groups = new Map(menu.modifierGroups.map((g) => [g.ref, g]));
  const base = `takatak-${menu.brandName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}`;
  const availability = (week: WeeklyHours) => Object.fromEntries(DAYS.map((d) => [d, (week[d] ?? []).map((p) => `${p.open} - ${p.close}`)]));
  const lang = ctx?.language ?? 'en';
  const category = (c: MenuCategory) => ({
    name: label(c.name, c.nameFr, lang),
    description: '',
    items: items.filter((i) => i.categoryRef === c.ref).map((i) => ({
      name: label(i.name, i.nameFr, lang),
      description: describe(i, lang),
      plu: i.ref,
      price: toCents(priceFor(i, 'skip')),
      out_of_stock: !i.available || offRefs.has(i.ref),
      ...(i.imageUrl ? { gallery: [{ url: i.imageUrl }] } : {}),
      modifiers: i.modifierGroupRefs.map((ref) => groups.get(ref)).filter(Boolean).map((g) => ({
        name: label(g!.name, g!.nameFr, lang),
        description: '',
        pick: g!.min === g!.max && g!.max > 0
          ? { pick_same_option: false, exactly: g!.max }
          : { pick_same_option: false, range: { from: Math.max(0, g!.min), to: g!.max > 0 ? g!.max : g!.modifiers.length } },
        options: g!.modifiers.map((m) => ({
          name: label(m.name, m.nameFr, lang),
          plu: m.ref,
          price: toCents(m.price),
          out_of_stock: !m.available || offRefs.has(m.ref),
        })),
      })),
    })),
  });
  return {
    restaurants: restaurantRefs,
    menus: scheduleGroups(menu, store).map((g, i) => ({
      name: i === 0 && g.key === 'store' ? menu.brandName : `${menu.brandName} — ${g.categories.map((c) => c.name).join(', ')}`,
      default_language: lang === 'fr' ? 'fr-CA' : 'en-CA',
      reference: i === 0 && g.key === 'store' ? base : `${base}-schedule-${i}`,
      type: 'DELIVERY',
      availability: availability(g.hours),
      categories: g.categories.map(category),
    })),
    ...(callbackUrl ? { callback_url: callbackUrl } : {}),
  };
}

// ---------------- Uber Eats ----------------
/** Uber Eats takes every language at once: { translations: { en, fr } }. */
const text = (value: string, fr?: string) => ({ translations: { en: value, ...(fr?.trim() && fr.trim() !== value ? { fr: fr.trim() } : {}) } });
const SUSPEND_FOREVER = { suspension_info: { suspension: { suspend_until: 8640000000, reason: 'Unavailable' } } };

export function toUberMenu(menu: MasterMenu, ctx?: PublishContext, offRefs: Set<string> = new Set()) {
  const items = liveItems(menu);
  const store = storeWeek(menu, ctx);
  const modifierItems = menu.modifierGroups.flatMap((g) => g.modifiers.map((m) => ({
    id: `mod:${m.ref}`,
    external_data: m.ref,
    title: text(m.name, m.nameFr),
    price_info: { price: toCents(m.price) },
    quantity_info: {},
    ...(m.available && !offRefs.has(m.ref) ? {} : SUSPEND_FOREVER),
  })));
  const availability = (week: WeeklyHours) => DAYS.map((day) => ({
    day_of_week: day,
    time_periods: (week[day] ?? []).map((p) => ({ start_time: p.open, end_time: p.close })),
  })).filter((d) => d.time_periods.length > 0);
  return {
    menus: scheduleGroups(menu, store).map((g, i) => ({
      id: i === 0 && g.key === 'store' ? 'takatak-main' : `takatak-schedule-${i}`,
      title: text(i === 0 && g.key === 'store' ? menu.brandName : `${menu.brandName} — ${g.categories.map((c) => c.name).join(', ')}`),
      service_availability: availability(g.hours),
      category_ids: g.categories.map((c) => c.ref),
    })),
    categories: menu.categories.map((c) => ({
      id: c.ref,
      title: text(c.name, c.nameFr),
      entities: items.filter((i) => i.categoryRef === c.ref).map((i) => ({ id: i.ref, type: 'ITEM' })),
    })),
    items: [
      ...items.map((i) => ({
        id: i.ref,
        external_data: i.ref,
        title: text(i.name, i.nameFr),
        description: (() => { const en = platformDescription(i, 'en'); const fr = platformDescription(i, 'fr'); return text(en, i.descriptionFr || i.nameFr ? fr : undefined); })(),
        ...(i.imageUrl ? { image_url: i.imageUrl } : {}),
        price_info: { price: toCents(priceFor(i, 'uber_eats')) },
        modifier_group_ids: { ids: i.modifierGroupRefs },
        ...(typeof i.calories === 'number' && i.calories > 0 ? { nutritional_info: { calories: { lower_range: Math.round(i.calories), upper_range: Math.round(i.calories) } } } : {}),
        ...(i.available && !offRefs.has(i.ref) ? {} : SUSPEND_FOREVER),
      })),
      ...modifierItems,
    ],
    modifier_groups: menu.modifierGroups.map((g) => ({
      id: g.ref,
      title: text(g.name, g.nameFr),
      quantity_info: { quantity: { min_permitted: g.min, max_permitted: g.max <= 0 ? g.modifiers.length : g.max } },
      modifier_options: g.modifiers.map((m) => ({ id: `mod:${m.ref}`, type: 'ITEM' })),
    })),
    display_options: { disable_item_instructions: false },
  };
}

/** Uber holiday hours body: POST /v1/eats/stores/{id}/holiday-hours (closed day = 00:00–00:00). */
export function toUberHolidayHours(holidays: Holiday[]) {
  return {
    holiday_hours: Object.fromEntries(holidays.map((h) => [h.date, {
      open_time_periods: h.closed || !(h.slots?.length) ? [{ start_time: '00:00', end_time: '00:00' }] : h.slots!.map((s) => ({ start_time: s.open, end_time: s.close })),
    }])),
  };
}

// ---------------- DoorDash ----------------
const DD_DAY: Record<DayKey, string> = { monday: 'MON', tuesday: 'TUE', wednesday: 'WED', thursday: 'THU', friday: 'FRI', saturday: 'SAT', sunday: 'SUN' };
const sec = (t: string) => `${t}:00`;

export function toDoorDashMenu(menu: MasterMenu, merchantSuppliedId: string, providerType: string, reference: string, ctx?: PublishContext, offRefs: Set<string> = new Set()) {
  const items = liveItems(menu);
  const store = storeWeek(menu, ctx);
  const groups = new Map(menu.modifierGroups.map((g) => [g.ref, g]));
  const today = ctx?.today ?? new Date().toISOString().slice(0, 10);
  const lang = ctx?.language ?? 'en';
  const inAYear = new Date(Date.parse(`${today}T12:00:00Z`) + 365 * 86400_000).toISOString().slice(0, 10);
  // Scheduled categories → item-level hours (DoorDash "item_special_hours").
  const categoryHours = new Map<string, WeeklyHours>();
  for (const g of scheduleGroups(menu, store)) if (g.key !== 'store') for (const c of g.categories) categoryHours.set(c.ref, g.hours);
  const visibleCats = new Set(scheduleGroups(menu, store).flatMap((g) => g.categories.map((c) => c.ref)));
  return {
    reference,
    store: { merchant_supplied_id: merchantSuppliedId, provider_type: providerType },
    // DoorDash: a day that is always closed is sent as 00:00–00:00.
    open_hours: DAYS.flatMap((d) => (store[d]?.length ? store[d] : [{ open: '00:00', close: '00:00' }]).map((p) => ({ day_index: DD_DAY[d], start_time: sec(p.open), end_time: sec(p.close) }))),
    special_hours: (ctx?.holidays ?? []).flatMap((h) => (h.closed || !(h.slots?.length)
      ? [{ date: h.date, closed: true, start_time: '00:00:00', end_time: '00:00:00' }]
      : h.slots!.map((s) => ({ date: h.date, closed: false, start_time: sec(s.open), end_time: sec(s.close) })))),
    menu: {
      name: menu.brandName,
      subtitle: '',
      merchant_supplied_id: `menu-${merchantSuppliedId}`,
      active: true,
      categories: menu.categories.filter((c) => visibleCats.has(c.ref)).map((c, ci) => ({
        name: label(c.name, c.nameFr, lang),
        subtitle: '',
        merchant_supplied_id: c.ref,
        active: true,
        sort_id: ci,
        items: items.filter((i) => i.categoryRef === c.ref).map((i, ii) => {
          const ch = categoryHours.get(c.ref);
          return {
            name: label(i.name, i.nameFr, lang),
            description: describe(i, lang),
            merchant_supplied_id: i.ref,
            active: i.available && !offRefs.has(i.ref),
            price: toCents(priceFor(i, 'doordash')),
            sort_id: ii,
            ...((i.tags ?? []).includes('alcohol') ? { is_alcohol: true } : {}),
            ...(i.imageUrl ? { original_image_url: i.imageUrl } : {}),
            ...(ch ? { item_special_hours: DAYS.flatMap((d) => (ch[d] ?? []).map((p) => ({ day_index: DD_DAY[d], start_time: sec(p.open), end_time: sec(p.close), start_date: today, end_date: inAYear }))) } : {}),
            extras: i.modifierGroupRefs.map((ref) => groups.get(ref)).filter(Boolean).map((g, gi) => ({
              name: label(g!.name, g!.nameFr, lang),
              merchant_supplied_id: g!.ref,
              active: true,
              min_num_options: g!.min,
              max_num_options: g!.max <= 0 ? g!.modifiers.length : g!.max,
              num_free_options: 0,
              sort_id: gi,
              options: g!.modifiers.map((m, mi) => ({
                name: label(m.name, m.nameFr, lang),
                merchant_supplied_id: m.ref,
                active: m.available && !offRefs.has(m.ref),
                price: toCents(m.price),
                sort_id: mi,
              })),
            })),
          };
        }),
      })),
    },
  };
}

export { dayKeyOf };
