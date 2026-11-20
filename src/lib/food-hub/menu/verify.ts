// Menu verification engine (Atlas: "Our internal verification engine runs checks on your menu").
// Errors block a publish; warnings and tips are shown but do not block.
import { effectiveHours, intersectWeeks, normalizeWeek, weekIsEmpty } from '../hours';
import type { ChannelStore, HoursConfig, MasterMenu } from '../types';

export interface MenuIssue {
  level: 'error' | 'warning' | 'tip';
  code: string;
  message: string;
  ref?: string;
}

export interface MenuCheck {
  ok: boolean;
  errors: MenuIssue[];
  warnings: MenuIssue[];
  tips: MenuIssue[];
}

export function verifyMenu(menu: MasterMenu, ctx: { stores?: ChannelStore[]; hours?: HoursConfig; languages?: Record<string, string> } = {}): MenuCheck {
  const issues: MenuIssue[] = [];
  const add = (level: MenuIssue['level'], code: string, message: string, ref?: string) => issues.push({ level, code, message, ref });
  const catRefs = new Set(menu.categories.map((c) => c.ref));
  const groupRefs = new Map(menu.modifierGroups.map((g) => [g.ref, g]));
  const seen = new Set<string>();

  if (!menu.items.length) add('error', 'empty_menu', 'The menu has no items. Import from Clover or add items.');
  for (const c of menu.categories) {
    if (!c.name.trim()) add('error', 'category_name', 'A category has no name.', c.ref);
    if (!menu.items.some((i) => i.categoryRef === c.ref)) add('warning', 'empty_category', `Category "${c.name}" has no items — it will not show on the platforms.`, c.ref);
  }
  for (const i of menu.items) {
    if (seen.has(i.ref)) add('error', 'duplicate_ref', `Two items share the id ${i.ref}.`, i.ref);
    seen.add(i.ref);
    if (!i.name.trim()) add('error', 'item_name', `An item (${i.ref}) has no name.`, i.ref);
    if (!catRefs.has(i.categoryRef)) add('error', 'item_category', `"${i.name}" is not in any category, so it cannot be published.`, i.ref);
    if (!(Number(i.price) >= 0)) add('error', 'item_price', `"${i.name}" has an invalid price.`, i.ref);
    else if (Number(i.price) === 0) add('warning', 'item_free', `"${i.name}" is priced at $0.00.`, i.ref);
    for (const [mk, v] of Object.entries(i.channelPrices ?? {})) if (typeof v === 'number' && v > 0 && v < i.price) add('tip', 'platform_cheaper', `"${i.name}" is cheaper on ${mk} (${v.toFixed(2)}) than the base price (${i.price.toFixed(2)}).`, i.ref);
    for (const g of i.modifierGroupRefs) if (!groupRefs.has(g)) add('error', 'missing_group', `"${i.name}" uses a modifier group that no longer exists (${g}).`, i.ref);
    if (!i.posItemRef) add('warning', 'no_clover', `"${i.name}" is not linked to a Clover item — it reaches Clover as a custom line.`, i.ref);
    if (!i.description?.trim()) add('tip', 'no_description', `"${i.name}" has no description (platforms rank items with descriptions higher).`, i.ref);
    if (!i.imageUrl) add('tip', 'no_photo', `"${i.name}" has no photo.`, i.ref);
    if (ctx.languages && Object.values(ctx.languages).some((l) => l !== 'en') && !i.nameFr?.trim()) add('tip', 'no_french', `"${i.name}" has no French name (your menus are published in French).`, i.ref);
  }
  for (const g of menu.modifierGroups) {
    if (!g.modifiers.length) add('error', 'empty_group', `Modifier group "${g.name}" has no options.`, g.ref);
    if (g.max > 0 && g.min > g.max) add('error', 'group_min_max', `Modifier group "${g.name}": minimum (${g.min}) is above maximum (${g.max}).`, g.ref);
    if (g.min > 0 && g.modifiers.filter((m) => m.available).length < g.min) add('error', 'group_required_unavailable', `Modifier group "${g.name}" is required but has fewer available options than its minimum — customers could not order these items.`, g.ref);
  }

  // Hours: every mapped location needs store hours, and category schedules must overlap them.
  const stores = ctx.stores ?? [];
  if (ctx.hours) {
    const locations = [...new Set(stores.filter((s) => s.brandName === menu.brandName).map((s) => s.locationCode))];
    const noHours = locations.filter((loc) => !effectiveHours(ctx.hours!, menu.brandName, loc));
    if (noHours.length) add('warning', 'no_hours', `No store hours set for ${noHours.join(', ')} — the platforms would show the store open 24/7. Set them in Store Hours.`);
    for (const c of menu.categories) {
      if (!c.hours || weekIsEmpty(c.hours)) continue;
      for (const loc of locations) {
        const store = effectiveHours(ctx.hours, menu.brandName, loc);
        if (store && weekIsEmpty(intersectWeeks(normalizeWeek(c.hours), store))) add('warning', 'category_never_open', `Category "${c.name}" schedule never overlaps the store hours at ${loc} — it will not be sold there.`, c.ref);
      }
    }
  }
  if (!stores.some((s) => s.brandName === menu.brandName)) add('warning', 'no_stores', `No stores are mapped for ${menu.brandName} yet — publishing has nowhere to go.`);

  const errors = issues.filter((x) => x.level === 'error');
  return { ok: errors.length === 0, errors, warnings: issues.filter((x) => x.level === 'warning'), tips: issues.filter((x) => x.level === 'tip') };
}
