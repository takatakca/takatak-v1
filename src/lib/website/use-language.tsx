"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  detectLanguage,
  storeLanguage,
  translate,
  pick,
  type Language,
  type TranslationKey,
} from "@/lib/website/i18n";

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggle: () => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  tx: <T>(value: { en: T; fr: T }) => T;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // SSR-safe: always start in English, then adopt the stored/browser language
  // after hydration so markup matches on the first paint.
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    const detected = detectLanguage();
    if (detected !== "en") setLangState(detected);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    storeLanguage(next);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLang,
      toggle: () => setLang(lang === "en" ? "fr" : "en"),
      t: (key, vars) => translate(lang, key, vars),
      tx: (v) => pick(lang, v),
    }),
    [lang, setLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (ctx) return ctx;
  // Safe fallback so components never crash outside the provider.
  return {
    lang: "en",
    setLang: () => undefined,
    toggle: () => undefined,
    t: (key, vars) => translate("en", key, vars),
    tx: (v) => v.en,
  };
}