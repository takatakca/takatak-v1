"use client";

import { Check } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import type { Language } from "@/lib/website/i18n";

export function LanguageChoiceStep({ onSelect }: { onSelect: (lang: Language) => void }) {
  const { t, lang } = useLanguage();
  const options: Array<{ value: Language; label: string; sub: string }> = [
    { value: "en", label: "English", sub: "Canada · CAD" },
    { value: "fr", label: "Français", sub: "Québec · CAD" },
  ];
  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">{t("offer.lang.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("offer.lang.body")}</p>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onSelect(o.value)}
            className={`flex items-center justify-between rounded-xl border p-4 text-left transition-all hover:border-primary/60 hover:shadow-[var(--shadow-card)] ${
              lang === o.value ? "border-primary/60 bg-primary/5" : "border-border bg-card"
            }`}
          >
            <span>
              <span className="block text-base font-semibold text-foreground">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.sub}</span>
            </span>
            {lang === o.value && <Check size={18} className="text-primary" />}
          </button>
        ))}
      </div>
    </div>
  );
}