import { logActivity } from '@/lib/food-hub/activity';
import { withPerm } from '@/lib/food-hub/auth';
import { fail, ok, readJson } from '@/lib/food-hub/http';
import { importMenuFromClover } from '@/lib/food-hub/pos/clover';
import { getRepo } from '@/lib/food-hub/repo';

export const dynamic = 'force-dynamic';

// Pull the brand's menu from Clover inventory (keeps Clover item ids for order injection).
export const POST = withPerm('menu:edit', async (req, _ctx, actor) => {
  const b = await readJson(req);
  if (!b.brand) return fail('brand is required');
  const repo = getRepo();
  const imported = await importMenuFromClover(String(b.brand), b.merchantId ? String(b.merchantId) : undefined);
  const existing = await repo.getMenu(String(b.brand));
  // Keep what the owner set in Food Hub (platform prices, descriptions, photos, tags, allergens,
  // category schedules, 86 state); Clover stays the source of names, prices and modifiers.
  const before = new Map((existing?.items ?? []).map((i) => [i.ref, i]));
  const catHours = new Map((existing?.categories ?? []).map((c) => [c.ref, c.hours]));
  const merged = {
    ...imported,
    hours: existing?.hours,
    unavailableByLocation: existing?.unavailableByLocation,
    unavailableUntil: existing?.unavailableUntil,
    categories: imported.categories.map((c) => {
      const prevCat = (existing?.categories ?? []).find((x) => x.ref === c.ref);
      return { ...c, ...(catHours.get(c.ref) ? { hours: catHours.get(c.ref) } : {}), ...(prevCat?.nameFr ? { nameFr: prevCat.nameFr } : {}) };
    }),
    items: imported.items.map((i) => {
      const prev = before.get(i.ref);
      if (!prev) return i;
      return { ...i, channelPrices: prev.channelPrices, description: i.description || prev.description, imageUrl: i.imageUrl || prev.imageUrl, tags: prev.tags, allergens: prev.allergens, calories: prev.calories, nameFr: prev.nameFr, descriptionFr: prev.descriptionFr };
    }),
    // Keep French names typed in Food Hub for option groups and options.
    modifierGroups: imported.modifierGroups.map((g) => {
      const prevG = (existing?.modifierGroups ?? []).find((x) => x.ref === g.ref);
      if (!prevG) return g;
      return { ...g, nameFr: prevG.nameFr, modifiers: g.modifiers.map((m) => ({ ...m, nameFr: prevG.modifiers.find((x) => x.ref === m.ref)?.nameFr })) };
    }),
  };
  const saved = await repo.saveMenu(merged);
  await logActivity({ actor: actor.name, source: actor.source, kind: 'menu_publish', action: 'menu_import', status: 'success', brandName: String(b.brand), summary: `Menu imported from Clover for ${b.brand}: ${saved.items.length} items` });
  return ok({ menu: saved, imported: { categories: saved.categories.length, items: saved.items.length, modifierGroups: saved.modifierGroups.length } });
});
