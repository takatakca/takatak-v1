"use client";

import { MapPin, Search, UserRound, Target, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import { SceneShell } from "@/components/website/home/discovery/SceneShell";

/**
 * One connected local growth process: a mapped business profile (QMAPS)
 * flowing into a captured opportunity and follow-up (FLEXS).
 */
export function LocalGrowthScene() {
  const { t } = useLanguage();
  return (
    <SceneShell ratio="aspect-[16/10]" className="bg-[color-mix(in_oklab,var(--primary)_5%,var(--background))]">
      {/* topographic map environment */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in oklab, var(--primary) 14%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--primary) 14%, transparent) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          transform: "perspective(420px) rotateX(34deg) scale(1.25)",
          transformOrigin: "50% 30%",
          maskImage: "linear-gradient(to bottom, black 5%, transparent 78%)",
        }}
      />
      {/* roads */}
      <svg viewBox="0 0 320 200" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <path d="M-10 70 H330" stroke="color-mix(in oklab, var(--foreground) 10%, transparent)" strokeWidth="6" fill="none" />
        <path d="M110 -10 V210" stroke="color-mix(in oklab, var(--foreground) 8%, transparent)" strokeWidth="5" fill="none" />
        <path
          className="tk-dash"
          d="M80 62 C 140 62, 150 120, 230 128"
          stroke="var(--primary)"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      </svg>

      {/* QMAPS profile */}
      <div className="tk-step absolute left-3 top-3 w-[45%] rounded-lg border border-border bg-card/95 p-2 shadow-[var(--shadow-card)] backdrop-blur" style={{ animationDelay: "120ms" }}>
        <p className="flex items-center gap-1 text-[9px] font-bold tracking-wide text-primary">
          <MapPin size={10} /> QMAPS
        </p>
        <p className="mt-0.5 text-[10px] font-semibold leading-tight text-foreground">{t("upg.local.s1")}</p>
        <span className="mt-1 block h-1 w-[80%] rounded-full bg-foreground/12" />
        <span className="mt-1 block h-1 w-[55%] rounded-full bg-foreground/10" />
      </div>

      {/* map pin */}
      <div className="tk-step absolute left-[24%] top-[46%]" style={{ animationDelay: "400ms" }}>
        <span className="tk-pin grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
          <MapPin size={12} />
        </span>
        <span className="mt-1 block rounded bg-background/85 px-1 py-0.5 text-[7px] font-semibold text-foreground">
          {t("upg.local.s2")}
        </span>
      </div>

      {/* customer discovery */}
      <div className="tk-step absolute left-[40%] top-[24%] inline-flex items-center gap-1 rounded-full border border-border bg-background/90 px-2 py-1 text-[8px] font-semibold text-foreground backdrop-blur" style={{ animationDelay: "620ms" }}>
        <Search size={9} className="text-primary" /> {t("upg.local.s3")}
      </div>
      <div className="tk-step absolute left-[46%] top-[46%] grid h-6 w-6 place-items-center rounded-full border border-border bg-card text-foreground" style={{ animationDelay: "760ms" }}>
        <UserRound size={12} />
      </div>

      {/* FLEXS opportunity */}
      <div className="tk-step absolute bottom-3 right-3 w-[47%] rounded-lg border border-primary/40 bg-card/95 p-2 shadow-[var(--shadow-card)] backdrop-blur" style={{ animationDelay: "900ms" }}>
        <p className="flex items-center gap-1 text-[9px] font-bold tracking-wide text-primary">
          <Target size={10} /> FLEXS
        </p>
        <p className="mt-0.5 text-[10px] font-semibold leading-tight text-foreground">{t("upg.local.s4")}</p>
        <div className="mt-1.5 space-y-1">
          <span className="block h-1 w-[75%] rounded-full bg-foreground/12" />
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/45 px-1.5 py-0.5 text-[7px] font-semibold text-primary">
            <CheckCircle2 size={8} /> {t("upg.local.s5")}
          </span>
        </div>
      </div>
    </SceneShell>
  );
}