import { logActivity } from '@/lib/food-hub/activity';
import { withPerm } from '@/lib/food-hub/auth';
import { ok, readJson } from '@/lib/food-hub/http';
import { getMenuLanguages, saveMenuLanguages } from '@/lib/food-hub/menu/language';

export const dynamic = 'force-dynamic';

export const GET = withPerm('view', async () => ok({ languages: await getMenuLanguages() }));

// { languages: { doordash: 'fr' | 'en' | 'both', skip: …, uber_eats: … } }
export const PUT = withPerm('menu:edit', async (req, _ctx, actor) => {
  const b = await readJson(req);
  const languages = await saveMenuLanguages(b.languages ?? {});
  await logActivity({ actor: actor.name, source: actor.source, kind: 'menu_publish', action: 'menu_languages', status: 'success', summary: `Menu languages: Uber Eats ${languages.uber_eats}, DoorDash ${languages.doordash}, Skip ${languages.skip}` });
  return ok({ languages });
});
