"use client";

import { Globe } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import type { Language } from "@/lib/website/i18n";

const OPTIONS: readonly { value: Language; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "fr", label: "FR" },
];

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t("lang.switch")}
      className={`inline-flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5 ${className}`}
    >
      <Globe size={13} className="mx-1 shrink-0 text-muted-foreground" aria-hidden />
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setLang(o.value)}
          aria-pressed={lang === o.value}
          className={`rounded px-2 py-1 text-[12px] font-semibold transition-colors ${
            lang === o.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}