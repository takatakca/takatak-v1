"use client";

// Homepage theme below the hero: light by default (owner, Oct 31 2026), dark
// on request. The choice is a per-visitor convenience kept in localStorage.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type HomeTheme = "light" | "dark";

const KEY = "takatak:home-theme";

const ThemeContext = createContext<{ theme: HomeTheme; toggle: () => void } | null>(null);

export function HomeThemeRoot({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<HomeTheme>("light");

  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY) === "dark") setTheme("dark");
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      try {
        window.localStorage.setItem(KEY, next);
      } catch {
        /* storage may be unavailable */
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      <div className="hp" data-theme={theme}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useHomeTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useHomeTheme must be used inside HomeThemeRoot");
  return ctx;
}
