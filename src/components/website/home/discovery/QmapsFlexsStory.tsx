"use client";

import { ArrowDown, MapPin, Sparkles, UserRound, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import type { TranslationKey } from "@/lib/website/i18n";
import { useInViewport } from "@/lib/website/use-in-viewport";

const STEPS: readonly { k: string; icon: LucideIcon }[] = [
  { k: "qmaps", icon: MapPin },
  { k: "customer", icon: UserRound },
  { k: "flexs", icon: Sparkles },
  { k: "takatak", icon: Workflow },
];

/**
 * Short QMAPS → customer → FLEXS → TAKATAK connection story. Runs once when
 * visible; reduced-motion users see the complete static flow immediately.
 */
export function QmapsFlexsStory({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  const [ref, inView] = useInViewport<HTMLOListElement>({ once: true });
  return (
    <ol
      ref={ref}
      className={`${inView ? "tk-play" : ""} grid gap-1.5 sm:grid-cols-[repeat(4,minmax(0,1fr))] ${className}`}
    >
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        return (
          <li
            key={s.k}
            style={{ animationDelay: `${i * 220}ms` }}
            className="tk-step relative flex items-center gap-2 rounded-lg border border-border bg-background/70 px-2.5 py-2"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/12 text-primary">
              <Icon size={12} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold leading-tight text-foreground">
                {t(`story.qf.${s.k}.name` as TranslationKey)}
              </span>
              <span className="block text-[11px] leading-tight text-muted-foreground">
                {t(`story.qf.${s.k}.line` as TranslationKey)}
              </span>
            </span>
            {i < STEPS.length - 1 && (
              <ArrowDown
                aria-hidden
                size={12}
                className="absolute -bottom-2 left-4 text-primary/60 sm:-right-2.5 sm:bottom-auto sm:left-auto sm:top-1/2 sm:-translate-y-1/2 sm:-rotate-90"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}