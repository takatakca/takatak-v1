"use client";

import { Mail, Phone, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import { SceneShell } from "@/components/website/home/discovery/SceneShell";

/** Professional workflow node card (not a circle with an icon). */
function Node({ k, v, delay, done = false }: { k: string; v: string; delay: number; done?: boolean }) {
  return (
    <div
      className={`tk-step min-w-0 rounded-lg border bg-card p-2 shadow-[var(--shadow-card)] ${done ? "border-primary/60" : "border-border"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{k}</p>
      <p className="mt-0.5 truncate text-[10px] font-semibold text-foreground">{v}</p>
      <span className={`mt-1.5 block h-1 rounded-full ${done ? "w-full bg-primary" : "w-[60%] bg-foreground/12"}`} />
    </div>
  );
}

/**
 * Wide operations workflow: a real business event enters on the left, moves
 * through the builder nodes, and locks into a completed outcome.
 */
export function AutomationFlowScene() {
  const { t } = useLanguage();
  return (
    <SceneShell ratio="aspect-[16/9] md:aspect-[21/9]" className="bg-[color-mix(in_oklab,var(--foreground)_7%,var(--background))]">
      <svg viewBox="0 0 400 120" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
        <path
          className="tk-dash"
          d="M20 60 H380"
          stroke="color-mix(in oklab, var(--primary) 65%, transparent)"
          strokeWidth="1.4"
          fill="none"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col justify-center gap-2 p-3 md:p-5">
        <div className="flex items-center justify-between gap-2 text-[8px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <span>{t("upg.auto.manual")}</span>
          <span className="hidden sm:inline">{t("upg.auto.builder")}</span>
          <span>{t("upg.auto.outcome")}</span>
        </div>

        <div className="grid grid-cols-3 items-center gap-2 sm:grid-cols-5">
          <Node k={t("upg.auto.n1k")} v={t("upg.auto.n1v")} delay={140} />
          <Node k={t("upg.auto.n2k")} v={t("upg.auto.n2v")} delay={340} />
          <Node k={t("upg.auto.n3k")} v={t("upg.auto.n3v")} delay={540} />
          <div className="hidden sm:block">
            <Node k={t("upg.auto.n4k")} v={t("upg.auto.n4v")} delay={740} />
          </div>
          <div className="hidden sm:block">
            <Node k={t("upg.auto.n5k")} v={t("upg.auto.n5v")} delay={940} done />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="tk-step inline-flex items-center gap-1 rounded-full border border-border bg-background/85 px-2 py-0.5 text-[8px] font-semibold text-foreground" style={{ animationDelay: "80ms" }}>
            <Phone size={9} className="text-primary" /> {t("upg.auto.n1v")}
          </span>
          <span className="tk-step inline-flex items-center gap-1 rounded-full border border-border bg-background/85 px-2 py-0.5 text-[8px] font-semibold text-foreground" style={{ animationDelay: "200ms" }}>
            <Mail size={9} className="text-primary" /> {t("upg.auto.n4v")}
          </span>
          <span className="tk-step ml-auto inline-flex items-center gap-1 rounded-full border border-primary/60 bg-primary/10 px-2 py-0.5 text-[8px] font-semibold text-primary" style={{ animationDelay: "1120ms" }}>
            <CheckCircle2 size={9} /> {t("upg.auto.done")}
          </span>
        </div>
      </div>
    </SceneShell>
  );
}