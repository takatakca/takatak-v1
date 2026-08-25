import { CalendarDays, MousePointerClick, Search, Sparkles } from "lucide-react";
import { SceneShell, SceneBar, SceneChip } from "./SceneShell";

/** Marketing & Social: brief → scheduled content → placement → customer action. */
export function MarketingDiscoveryVisual() {
  return (
    <SceneShell ratio="aspect-[16/9]">
      <div className="absolute inset-0 grid grid-cols-[1.1fr_1fr] gap-2 p-4">
        <div className="flex flex-col gap-2">
          <div style={{ animationDelay: "0ms" }} className="tk-step rounded-lg border border-border bg-card p-2">
            <span className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wider text-primary">
              <Sparkles size={9} /> Campaign brief
            </span>
            <SceneBar className="mt-1.5 h-1 w-full" />
            <SceneBar className="mt-1 h-1 w-[72%]" />
          </div>

          <div style={{ animationDelay: "320ms" }} className="tk-step rounded-lg border border-border bg-card p-2">
            <span className="flex items-center gap-1 text-[8px] font-semibold text-foreground">
              <CalendarDays size={9} className="text-primary" /> Content calendar
            </span>
            <div className="mt-1.5 grid grid-cols-7 gap-[3px]">
              {Array.from({ length: 14 }).map((_, i) => (
                <span
                  key={i}
                  style={{ animationDelay: `${420 + i * 35}ms` }}
                  className={`tk-step h-2 rounded-[2px] ${i % 4 === 1 ? "bg-primary/80" : "bg-foreground/10"}`}
                />
              ))}
            </div>
          </div>

          <div style={{ animationDelay: "980ms" }} className="tk-step mt-auto flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5">
            <Search size={10} className="text-primary" />
            <SceneBar className="h-1 flex-1" />
            <SceneChip>Ad</SceneChip>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div style={{ animationDelay: "560ms" }} className="tk-step overflow-hidden rounded-lg border border-border bg-card">
            <div className="relative h-10 bg-secondary">
              <span className="tk-sweep absolute inset-y-0 -left-1/3 w-1/3 bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--primary)_22%,transparent),transparent)]" />
            </div>
            <div className="p-1.5">
              <SceneBar className="h-1 w-[80%]" />
              <SceneBar className="mt-1 h-1 w-[55%]" />
            </div>
          </div>

          <div style={{ animationDelay: "1120ms" }} className="tk-step flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1.5">
            <MousePointerClick size={11} className="text-primary" />
            <span className="text-[9px] font-semibold text-foreground">Website click</span>
          </div>

          <div style={{ animationDelay: "1320ms" }} className="tk-step mt-auto rounded-lg border border-border bg-card p-2">
            <span className="text-[9px] font-semibold text-foreground">New inquiry</span>
            <SceneBar className="mt-1 h-1 w-[70%]" />
          </div>
        </div>
      </div>
    </SceneShell>
  );
}