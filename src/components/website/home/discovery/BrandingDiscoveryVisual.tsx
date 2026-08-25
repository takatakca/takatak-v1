import { SceneShell, SceneBar, SceneChip } from "./SceneShell";

/** Branding & Design: concept sketch → brand system → real applications. */
export function BrandingDiscoveryVisual() {
  return (
    <SceneShell ratio="aspect-[16/10]">
      <div className="absolute inset-0 grid grid-cols-[1fr_1fr] gap-2 p-4">
        <div className="flex flex-col gap-2">
          {/* rough mark → finished mark */}
          <div className="flex items-center gap-2">
            <span
              style={{ animationDelay: "0ms" }}
              className="tk-step grid h-9 w-9 place-items-center rounded-lg border border-dashed border-foreground/25"
            >
              <span className="h-4 w-4 rotate-12 rounded-sm border border-foreground/30" />
            </span>
            <span
              style={{ animationDelay: "420ms" }}
              className="tk-step grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"
            >
              <span className="text-[11px] font-black tracking-tight">TK</span>
            </span>
          </div>

          {/* typography sample */}
          <div style={{ animationDelay: "560ms" }} className="tk-step rounded-lg border border-border bg-card px-2 py-1.5">
            <p className="text-[13px] font-black leading-none tracking-tight text-foreground">Aa</p>
            <p className="mt-0.5 text-[8px] text-muted-foreground">Display / Body</p>
          </div>

          {/* palette fans slightly on hover */}
          <div className="mt-auto flex items-end gap-1">
            {["bg-primary", "bg-primary/70", "bg-foreground/70", "bg-foreground/30", "bg-secondary"].map((c, i) => (
              <span
                key={c}
                style={{ animationDelay: `${700 + i * 70}ms`, ["--tk-fan" as string]: `${(i - 2) * 4}deg` }}
                className={`tk-step tk-fan h-7 w-4 origin-bottom rounded-sm transition-transform duration-300 ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {/* website header application */}
          <div style={{ animationDelay: "900ms" }} className="tk-step rounded-lg border border-border bg-card p-1.5">
            <div className="flex items-center gap-1">
              <span className="grid h-3 w-3 place-items-center rounded-sm bg-primary text-[5px] font-black text-primary-foreground">T</span>
              <SceneBar className="h-1 w-5" />
              <SceneBar className="h-1 w-4" />
              <SceneBar tone="primary" className="ml-auto h-2 w-6 rounded" />
            </div>
            <SceneBar tone="strong" className="mt-1.5 h-1.5 w-[70%]" />
          </div>

          {/* business card */}
          <div
            style={{ animationDelay: "1040ms" }}
            className="tk-step rounded-md border border-border bg-secondary/60 p-1.5 shadow-sm"
          >
            <span className="text-[8px] font-black tracking-widest text-foreground">TAKATAK</span>
            <SceneBar className="mt-1 h-1 w-[60%]" />
            <SceneBar className="mt-0.5 h-1 w-[40%]" />
          </div>

          {/* print / menu application */}
          <div style={{ animationDelay: "1180ms" }} className="tk-step mt-auto rounded-md border border-border bg-card p-1.5">
            <SceneBar tone="primary" className="h-1 w-6" />
            <SceneBar className="mt-1 h-1 w-full" />
            <SceneBar className="mt-0.5 h-1 w-[80%]" />
            <SceneBar className="mt-0.5 h-1 w-[65%]" />
          </div>
        </div>
      </div>

      <SceneChip delay={1320} className="absolute right-3 top-3 text-primary">Brand system</SceneChip>
    </SceneShell>
  );
}