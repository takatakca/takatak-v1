"use client";

import { useLanguage } from "@/lib/website/use-language";
import { SceneShell } from "@/components/website/home/discovery/SceneShell";

/**
 * Identity presentation board: mark, wordmark, typography, palette and the
 * applications the identity lands on. Overlapping objects, warm editorial
 * light — it should read like a designer's board, not an icon.
 */
export function BrandBoardScene() {
  const { t } = useLanguage();
  return (
    <SceneShell ratio="aspect-[16/10]" className="bg-[color-mix(in_oklab,var(--foreground)_4%,var(--background))]">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(420px 220px at 22% 18%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 70%)",
        }}
      />
      <div className="absolute inset-0 p-3 md:p-4">
        {/* logo mark + wordmark */}
        <div className="tk-step inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-[var(--shadow-card)]" style={{ animationDelay: "120ms" }}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-[13px] font-black text-primary-foreground">T</span>
          <span className="leading-tight">
            <span className="block text-[12px] font-black tracking-[0.18em] text-foreground">TAKATAK</span>
            <span className="block text-[8px] uppercase tracking-[0.18em] text-muted-foreground">{t("upg.brand.s2")}</span>
          </span>
        </div>

        {/* typography specimen */}
        <div className="tk-step absolute left-3 top-[42%] w-[38%] rounded-lg border border-border bg-card p-2 shadow-[var(--shadow-card)] md:left-4" style={{ animationDelay: "420ms" }}>
          <p className="text-[8px] uppercase tracking-[0.16em] text-muted-foreground">{t("upg.brand.s3")}</p>
          <p className="text-[15px] font-bold leading-none text-foreground">Aa</p>
          <p className="text-[9px] leading-none text-muted-foreground">Aa Bb Cc — 123</p>
        </div>

        {/* palette */}
        <div className="tk-step absolute right-3 top-3 rounded-lg border border-border bg-card p-2 shadow-[var(--shadow-card)] md:right-4" style={{ animationDelay: "300ms" }}>
          <p className="text-[8px] uppercase tracking-[0.16em] text-muted-foreground">{t("upg.brand.s4")}</p>
          <div className="mt-1 flex gap-1">
            <span className="h-4 w-4 rounded bg-primary" />
            <span className="h-4 w-4 rounded bg-foreground/70" />
            <span className="h-4 w-4 rounded bg-foreground/30" />
            <span className="h-4 w-4 rounded border border-border bg-background" />
          </div>
        </div>

        {/* business card */}
        <div className="tk-step absolute bottom-3 left-[30%] w-[34%] -rotate-3 rounded-lg border border-border bg-card p-2 shadow-[var(--shadow-card)]" style={{ animationDelay: "620ms" }}>
          <span className="block text-[8px] font-black tracking-[0.16em] text-foreground">TAKATAK</span>
          <span className="mt-1 block h-1 w-[70%] rounded-full bg-foreground/15" />
          <span className="mt-1 block h-1 w-[45%] rounded-full bg-foreground/10" />
          <span className="mt-1.5 block text-[7px] uppercase tracking-[0.14em] text-muted-foreground">{t("upg.brand.s5")}</span>
        </div>

        {/* digital profile */}
        <div className="tk-step absolute bottom-6 right-4 w-[30%] rotate-2 rounded-lg border border-border bg-card p-2 shadow-[var(--shadow-card)]" style={{ animationDelay: "760ms" }}>
          <div className="flex items-center gap-1.5">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-[7px] font-black text-primary-foreground">T</span>
            <span className="h-1 w-[60%] rounded-full bg-foreground/15" />
          </div>
          <span className="mt-1.5 block h-6 w-full rounded bg-foreground/8" />
          <span className="mt-1 block text-[7px] uppercase tracking-[0.14em] text-muted-foreground">{t("upg.brand.s6")}</span>
        </div>

        {/* flyer */}
        <div className="tk-step absolute right-[34%] top-[34%] w-[22%] -rotate-6 rounded-md border border-border bg-card p-1.5 shadow-[var(--shadow-card)]" style={{ animationDelay: "880ms" }}>
          <span className="block h-5 w-full rounded bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_30%,transparent),transparent)]" />
          <span className="mt-1 block h-1 w-[80%] rounded-full bg-foreground/15" />
          <span className="mt-1 block text-[7px] uppercase tracking-[0.14em] text-muted-foreground">{t("upg.brand.s7")}</span>
        </div>
      </div>
    </SceneShell>
  );
}