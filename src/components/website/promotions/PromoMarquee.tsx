"use client";

import { useLanguage } from "@/lib/website/use-language";
import type { TranslationKey } from "@/lib/website/i18n";

const KEYS: readonly TranslationKey[] = [
  "promo.marquee.1",
  "promo.marquee.2",
  "promo.marquee.3",
  "promo.marquee.4",
  "promo.marquee.5",
  "promo.marquee.6",
  "promo.marquee.7",
];

export function PromoMarquee() {
  const { t } = useLanguage();
  const items = KEYS.map((k) => t(k));
  const loop = [...items, ...items];
  return (
    <div className="border-y border-border bg-card/40 overflow-hidden">
      <div
        className="flex gap-12 py-3 whitespace-nowrap text-sm"
        style={{ animation: "promoMarquee 60s linear infinite" }}
      >
        {loop.map((label, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-foreground/80">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
            {label}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes promoMarquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
