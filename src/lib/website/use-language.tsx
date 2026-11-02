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

export function LanguageProvider({ children, initialLanguage }: { children: ReactNode; initialLanguage?: Language }) {
  // The homepage's explicit URL locale must match its server-rendered HTML.
  const [lang, setLangState] = useState<Language>(initialLanguage ?? "en");

  useEffect(() => {
    if (initialLanguage) return;
    const detected = detectLanguage();
    if (detected !== "en") setLangState(detected);
  }, [initialLanguage]);

  useEffect(() => {
    if (initialLanguage) setLangState(initialLanguage);
  }, [initialLanguage]);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    storeLanguage(next);
    if (window.location.pathname === "/") {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", next);
      window.history.replaceState(null, "", url);
    }
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
