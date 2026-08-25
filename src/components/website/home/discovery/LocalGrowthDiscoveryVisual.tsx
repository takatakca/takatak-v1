import { MapPin, Star, UserRound, Workflow } from "lucide-react";
import { SceneShell, SceneBar, SceneChip } from "./SceneShell";

/**
 * Local Visibility & Leads — the TAKATAK signature scene.
 * Left half is QMAPS (local discovery), right half is FLEXS (opportunity
 * capture); the connector shows a customer moving between them.
 */
export function LocalGrowthDiscoveryVisual() {
  return (
    <SceneShell ratio="aspect-[16/8]">
      <div className="absolute inset-0 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 p-4">
        {/* QMAPS */}
        <div className="relative overflow-hidden rounded-lg border border-border bg-card p-2">
          <span className="text-[8px] font-black uppercase tracking-[0.18em] text-primary">QMAPS</span>
          <div className="relative mt-1.5 h-[58px] overflow-hidden rounded-md bg-secondary/70">
            <svg viewBox="0 0 120 60" className="absolute inset-0 h-full w-full text-foreground/15">
              <path d="M0 18 H120 M0 40 H120 M28 0 V60 M74 0 V60" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
            <span style={{ animationDelay: "260ms" }} className="tk-step absolute left-[38%] top-[28%]">
              <span className="tk-pin absolute -inset-2 rounded-full bg-primary/40" />
              <MapPin size={14} className="relative text-primary" />
            </span>
            {[
              { x: "12%", y: "68%", d: 520 },
              { x: "72%", y: "22%", d: 640 },
              { x: "82%", y: "70%", d: 760 },
            ].map((n) => (
              <span
                key={n.d}
                style={{ left: n.x, top: n.y, animationDelay: `${n.d}ms` }}
                className="tk-step absolute h-1.5 w-1.5 rounded-full bg-primary/60"
              />
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-1">
            <SceneChip delay={880}>
              <Star size={8} className="text-primary" /> Listing consistent
            </SceneChip>
          </div>
        </div>

        {/* Connector */}
        <div className="flex w-10 flex-col items-center justify-center">
          <svg viewBox="0 0 40 20" className="h-5 w-10 text-primary">
            <path d="M2 10 H38" stroke="currentColor" strokeWidth="1.2" opacity="0.3" fill="none" />
            <path className="tk-dash" d="M2 10 H38" stroke="currentColor" strokeWidth="1.6" fill="none" />
            <path d="M32 6 L38 10 L32 14" fill="none" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          <span style={{ animationDelay: "980ms" }} className="tk-step mt-1 grid h-5 w-5 place-items-center rounded-full border border-primary/40 bg-background">
            <UserRound size={10} className="text-primary" />
          </span>
        </div>

        {/* FLEXS */}
        <div className="relative overflow-hidden rounded-lg border border-border bg-card p-2">
          <span className="text-[8px] font-black uppercase tracking-[0.18em] text-primary">FLEXS</span>
          <div style={{ animationDelay: "1120ms" }} className="tk-step mt-1.5 rounded-md border border-primary/35 bg-primary/5 p-1.5">
            <span className="text-[9px] font-semibold text-foreground">New opportunity</span>
            <SceneBar className="mt-1 h-1 w-[75%]" />
          </div>
          <div className="mt-1.5 grid gap-1">
            {["Qualified", "Pipeline", "Follow-up"].map((s, i) => (
              <span
                key={s}
                style={{ animationDelay: `${1260 + i * 130}ms` }}
                className="tk-step flex items-center gap-1 text-[8px] text-muted-foreground"
              >
                <span className="h-1 w-1 rounded-full bg-primary" /> {s}
              </span>
            ))}
          </div>
          <span style={{ animationDelay: "1720ms" }} className="tk-step absolute bottom-2 right-2 text-primary">
            <Workflow size={11} />
          </span>
        </div>
      </div>
    </SceneShell>
  );
}