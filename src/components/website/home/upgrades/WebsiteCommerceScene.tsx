"use client";

import { Globe2, Server, Smartphone, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import { SceneShell, SceneChip } from "@/components/website/home/discovery/SceneShell";

/**
 * Premium website commerce scene: a large browser holding a believable
 * business site, a responsive phone in the foreground and floating
 * foundation badges. Decorative — the card copy carries the meaning.
 */
export function WebsiteCommerceScene() {
  const { t } = useLanguage();
  return (
    <SceneShell
      ratio="aspect-[16/10] md:aspect-auto md:h-full md:min-h-[300px]"
      className="bg-[color-mix(in_oklab,var(--foreground)_5%,var(--background))]"
    >
      {/* browser */}
      <div className="tk-step absolute inset-x-4 top-4 bottom-10 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] md:inset-x-8 md:top-6 md:bottom-12">
        <div className="flex items-center gap-1.5 border-b border-border bg-secondary/70 px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-foreground/15" />
          <span className="h-2 w-2 rounded-full bg-foreground/15" />
          <span className="h-2 w-2 rounded-full bg-foreground/15" />
          <span className="ml-2 truncate rounded bg-background px-2 py-0.5 text-[9px] text-muted-foreground">
            yourbusiness.ca
          </span>
        </div>

        {/* site nav */}
        <div className="flex items-center gap-3 border-b border-border px-3 py-2 text-[9px] font-semibold text-foreground/70">
          <span className="tk-step rounded bg-primary/85 px-1.5 py-0.5 text-[8px] text-primary-foreground" style={{ animationDelay: "160ms" }}>
            TAKATAK
          </span>
          <span className="tk-step" style={{ animationDelay: "220ms" }}>{t("upg.website.nav1")}</span>
          <span className="tk-step" style={{ animationDelay: "260ms" }}>{t("upg.website.nav2")}</span>
          <span className="tk-step" style={{ animationDelay: "300ms" }}>{t("upg.website.nav3")}</span>
          <span className="tk-step ml-auto rounded border border-primary/50 px-2 py-0.5 text-[8px] text-primary" style={{ animationDelay: "360ms" }}>
            {t("upg.website.cta3")}
          </span>
        </div>

        {/* hero */}
        <div className="grid grid-cols-[1.15fr_1fr] gap-3 px-3 py-3">
          <div>
            <p className="tk-step text-[11px] font-bold leading-tight text-foreground md:text-[13px]" style={{ animationDelay: "440ms" }}>
              {t("upg.website.hero")}
            </p>
            <span className="tk-step mt-2 block h-1.5 w-[86%] rounded-full bg-foreground/10" style={{ animationDelay: "500ms" }} />
            <span className="tk-step mt-1.5 block h-1.5 w-[62%] rounded-full bg-foreground/10" style={{ animationDelay: "540ms" }} />
            <span className="tk-step mt-3 inline-block rounded-md bg-primary px-2.5 py-1 text-[8px] font-semibold text-primary-foreground" style={{ animationDelay: "620ms" }}>
              {t("upg.website.cta3")}
            </span>
          </div>
          <div
            className="tk-step rounded-md border border-border bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_22%,transparent),color-mix(in_oklab,var(--foreground)_8%,transparent))]"
            style={{ animationDelay: "560ms" }}
          />
        </div>

        {/* service blocks */}
        <div className="px-3">
          <p className="tk-step text-[8px] font-semibold uppercase tracking-[0.16em] text-muted-foreground" style={{ animationDelay: "700ms" }}>
            {t("upg.website.blocks")}
          </p>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {[760, 820, 880].map((d) => (
              <div key={d} className="tk-step rounded-md border border-border bg-secondary/50 p-1.5" style={{ animationDelay: `${d}ms` }}>
                <span className="block h-4 w-full rounded bg-foreground/10" />
                <span className="mt-1 block h-1 w-[80%] rounded-full bg-foreground/15" />
                <span className="mt-1 block h-1 w-[55%] rounded-full bg-foreground/10" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* responsive phone */}
      <div
        className="tk-step absolute bottom-2 right-4 w-[62px] overflow-hidden rounded-[10px] border border-border bg-card shadow-[var(--shadow-card)] md:right-8 md:w-[86px]"
        style={{ animationDelay: "960ms" }}
      >
        <div className="flex justify-center bg-secondary/70 py-1">
          <span className="h-1 w-6 rounded-full bg-foreground/20" />
        </div>
        <div className="space-y-1 p-1.5">
          <span className="block h-6 w-full rounded bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_25%,transparent),transparent)]" />
          <span className="block h-1 w-[85%] rounded-full bg-foreground/15" />
          <span className="block h-1 w-[60%] rounded-full bg-foreground/10" />
          <span className="block h-2.5 w-[70%] rounded bg-primary/80" />
        </div>
      </div>

      {/* foundation badges */}
      <div className="absolute left-3 top-3 flex flex-col gap-1.5 md:left-5">
        <SceneChip delay={1040}><Globe2 size={9} className="text-primary" /> {t("upg.website.c1")}</SceneChip>
        <SceneChip delay={1120}><Server size={9} className="text-primary" /> {t("upg.website.c2")}</SceneChip>
        <SceneChip delay={1200}><Smartphone size={9} className="text-primary" /> {t("upg.website.c3")}</SceneChip>
        <SceneChip delay={1280} className="border-primary/60 text-primary">
          <ShieldCheck size={9} /> {t("upg.website.status")}
        </SceneChip>
      </div>
    </SceneShell>
  );
}