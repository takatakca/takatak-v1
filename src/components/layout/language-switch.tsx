"use client";

import { setDashboardLanguageAction } from "@/app/dashboard/language-actions";
import { useDashboardLanguage } from "@/components/layout/dashboard-language";

/** One-click FR / EN switch for the dashboard (saved on the account). */
export function LanguageSwitch() {
  const language = useDashboardLanguage();
  const next = language === "fr" ? "en" : "fr";
  return (
    <form action={setDashboardLanguageAction}>
      <input type="hidden" name="language" value={next} />
      <button
        type="submit"
        title={next === "fr" ? "Afficher le tableau de bord en français" : "Show the dashboard in English"}
        aria-label={next === "fr" ? "Passer en français" : "Switch to English"}
        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
      >
        {next === "fr" ? "FR" : "EN"}
      </button>
    </form>
  );
}
