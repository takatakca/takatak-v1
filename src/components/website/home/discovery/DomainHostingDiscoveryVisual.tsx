import { Globe2, Lock, Search, Server, HardDriveDownload } from "lucide-react";
import { SceneShell, SceneChip, SceneBar } from "./SceneShell";

/**
 * Domains & Hosting: search → selected → DNS → hosting → secured → online.
 * Decorative explanation only — real lookups run through the domain overlay.
 */
export function DomainHostingDiscoveryVisual() {
  return (
    <SceneShell ratio="aspect-[16/10]">
      <div className="absolute inset-0 flex flex-col justify-between p-4">
        <div
          style={{ animationDelay: "0ms" }}
          className="tk-step flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5"
        >
          <Search size={11} className="shrink-0 text-primary" />
          <span className="text-[10px] text-muted-foreground">yourbusiness</span>
          <span className="ml-auto flex gap-1">
            <SceneChip delay={280}>.ca</SceneChip>
            <SceneChip delay={360} className="opacity-60">.com</SceneChip>
          </span>
        </div>

        <svg viewBox="0 0 300 60" className="h-14 w-full text-primary" preserveAspectRatio="none">
          <path d="M 20 12 C 90 12, 90 48, 150 48 C 210 48, 210 12, 280 12" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
          <path className="tk-dash" d="M 20 12 C 90 12, 90 48, 150 48 C 210 48, 210 12, 280 12" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="20" cy="12" r="3" fill="currentColor" />
          <circle cx="150" cy="48" r="3" fill="currentColor" />
          <circle cx="280" cy="12" r="3" fill="currentColor" />
        </svg>

        <div className="grid grid-cols-4 gap-1.5">
          {[
            { icon: Globe2, label: "DNS", d: 480 },
            { icon: Server, label: "Hosting", d: 640 },
            { icon: Lock, label: "SSL", d: 800 },
            { icon: HardDriveDownload, label: "Backups", d: 960 },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <span
                key={s.label}
                style={{ animationDelay: `${s.d}ms` }}
                className="tk-step flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-1 py-1.5"
              >
                <Icon size={12} className="text-primary" />
                <span className="text-[8px] font-semibold text-foreground">{s.label}</span>
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <SceneBar delay={1100} tone="primary" className="h-1 flex-1" />
          <SceneChip delay={1180} className="text-primary">Online</SceneChip>
        </div>
      </div>
    </SceneShell>
  );
}