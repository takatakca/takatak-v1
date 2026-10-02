import { logActivity } from '@/lib/food-hub/activity';
import { withPerm } from '@/lib/food-hub/auth';
import { getHours, saveHours } from '@/lib/food-hub/hours';
import { fail, ok, readJson } from '@/lib/food-hub/http';
import type { HoursConfig } from '@/lib/food-hub/types';

export const dynamic = 'force-dynamic';

export const GET = withPerm('view', async () => ok({ hours: await getHours() }));

// Save store hours / brand overrides / holidays. Publish menus afterwards to send them to the platforms.
export const PUT = withPerm('menu:edit', async (req, _ctx, actor) => {
  const b = await readJson(req);
  const cfg = b.hours as HoursConfig | undefined;
  if (!cfg || typeof cfg !== 'object') return fail('hours is required');
  let saved: HoursConfig;
  try {
    saved = await saveHours({ locations: cfg.locations ?? {}, brands: cfg.brands ?? {}, holidays: Array.isArray(cfg.holidays) ? cfg.holidays : [] });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  await logActivity({ actor: actor.name, source: actor.source, kind: 'hours', action: 'hours_saved', status: 'success',
    summary: `Store hours saved: ${Object.keys(saved.locations).length} location(s), ${Object.keys(saved.brands).length} brand override(s), ${saved.holidays.length} holiday(s)` });
  return ok({ hours: saved });
});
