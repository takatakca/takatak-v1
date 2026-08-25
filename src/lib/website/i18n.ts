import { en, type TranslationKey } from "./translations/en";
import { fr } from "./translations/fr";

export type Language = "en" | "fr";
export const LANGUAGES: readonly Language[] = ["en", "fr"];
export const STORAGE_KEY = "takatak.lang";

const dicts: Record<Language, Record<string, string>> = { en, fr };

/** Locale used for CAD formatting and speech recognition. */
export const speechLocale: Record<Language, string> = { en: "en-CA", fr: "fr-CA" };

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "fr";
}

export function detectLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    /* storage may be unavailable */
  }
  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  return nav?.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export function storeLanguage(lang: Language): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

export function translate(
  lang: Language,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const raw = dicts[lang]?.[key] ?? dicts.en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in vars ? String(vars[name]) : m,
  );
}

/** Pick the right side of a bilingual content pair. */
export function pick<T>(lang: Language, value: { en: T; fr: T }): T {
  return lang === "fr" ? value.fr : value.en;
}

export type { TranslationKey };