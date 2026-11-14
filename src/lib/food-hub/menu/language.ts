// Menu language per platform (Quebec: French is expected; Uber Eats takes both languages natively).
import { getRepo } from '../repo';
import type { ChannelKey, MenuLanguage } from '../types';

const KEY = 'menu_language';
export type LanguageSettings = Record<Exclude<ChannelKey, 'tgtg'>, MenuLanguage>;
export const DEFAULT_LANGUAGES: LanguageSettings = { uber_eats: 'both', doordash: 'en', skip: 'en' };

export async function getMenuLanguages(): Promise<LanguageSettings> {
  return { ...DEFAULT_LANGUAGES, ...((await getRepo().getKv<Partial<LanguageSettings>>(KEY).catch(() => null)) ?? {}) };
}

export async function saveMenuLanguages(input: Partial<LanguageSettings>): Promise<LanguageSettings> {
  const cur = await getMenuLanguages();
  const ok = (v: unknown): v is MenuLanguage => v === 'en' || v === 'fr' || v === 'both';
  const next = { ...cur };
  for (const k of Object.keys(DEFAULT_LANGUAGES) as Array<keyof LanguageSettings>) if (ok(input[k])) next[k] = input[k]!;
  await getRepo().setKv(KEY, next);
  return next;
}

/** One label in the chosen language: "Poulet grillé", "Grilled chicken" or "Poulet grillé / Grilled chicken". */
export function label(en: string, fr: string | undefined, lang: MenuLanguage = 'en'): string {
  const f = fr?.trim();
  if (!f || f === en.trim()) return en;
  if (lang === 'fr') return f;
  if (lang === 'both') return `${f} / ${en}`.slice(0, 120);
  return en;
}
