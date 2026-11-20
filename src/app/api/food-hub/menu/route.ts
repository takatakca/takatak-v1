import { logActivity } from '@/lib/food-hub/activity';
import { withPerm } from '@/lib/food-hub/auth';
import { getCatalog } from '@/lib/food-hub/catalog';
import { fail, ok, readJson } from '@/lib/food-hub/http';
import { getRepo } from '@/lib/food-hub/repo';
import type { MasterMenu } from '@/lib/food-hub/types';

export const dynamic = 'force-dynamic';

function emptyMenu(brandName: string): MasterMenu {
  return { brandName, categories: [], items: [], modifierGroups: [], updatedAt: new Date().toISOString() };
}

export const GET = withPerm('view', async (req) => {
  const repo = getRepo();
  const brand = new URL(req.url).searchParams.get('brand');
  if (brand) return ok({ menu: (await repo.getMenu(brand)) ?? emptyMenu(brand) });
  const menus = await repo.listMenus();
  const catalog = await getCatalog();
  const brands = [...new Set([...catalog.brands.filter((b) => b.active).map((b) => b.name), ...menus.map((m) => m.brandName)])];
  return ok({ brands, summary: menus.map((m) => ({ brandName: m.brandName, items: m.items.length, updatedAt: m.updatedAt })) });
});

// Save the full master menu for a brand.
export const PUT = withPerm('menu:edit', async (req, _ctx, actor) => {
  const b = await readJson(req);
  const menu = b.menu as MasterMenu | undefined;
  if (!menu?.brandName || !Array.isArray(menu.items) || !Array.isArray(menu.categories)) return fail('menu with brandName, categories and items is required');
  const refs = new Set<string>();
  for (const item of menu.items) {
    if (!item.ref || !item.name) return fail('Every item needs a ref and a name');
    if (refs.has(item.ref)) return fail(`Duplicate item ref: ${item.ref}`);
    refs.add(item.ref);
    if (!(Number(item.price) >= 0)) return fail(`Invalid price for ${item.name}`);
  }
  // Keep the 86 state managed on the 86 Board (the editor may hold an older copy).
  const current = await getRepo().getMenu(menu.brandName);
  const saved = await getRepo().saveMenu({ ...menu, modifierGroups: menu.modifierGroups ?? [], unavailableByLocation: current?.unavailableByLocation ?? menu.unavailableByLocation, unavailableUntil: current?.unavailableUntil ?? menu.unavailableUntil });
  await logActivity({ actor: actor.name, source: actor.source, kind: 'menu_publish', action: 'menu_saved', status: 'success', brandName: menu.brandName, summary: `Menu saved for ${menu.brandName} (${menu.items.length} items, ${menu.categories.length} categories)` });
  return ok({ menu: saved });
});
