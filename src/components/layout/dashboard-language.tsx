"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { DashboardLanguage } from "@/lib/dashboard/nav-fr";

const DashboardLanguageContext = createContext<DashboardLanguage>("en");

/** The account's dashboard language (Account settings › Preferences). */
export function DashboardLanguageProvider({ language, children }: { language: DashboardLanguage; children: ReactNode }) {
  return <DashboardLanguageContext.Provider value={language}>{children}</DashboardLanguageContext.Provider>;
}

export function useDashboardLanguage(): DashboardLanguage {
  return useContext(DashboardLanguageContext);
}
