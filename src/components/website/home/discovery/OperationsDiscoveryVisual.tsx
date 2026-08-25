import { Bell, CheckCircle2, PhoneCall, Voicemail, Workflow } from "lucide-react";
import { SceneShell, SceneBar, SceneChip } from "./SceneShell";

/** Communications & Automation: call → routing → workflow → task → notification. */
export function OperationsDiscoveryVisual() {
  return (
    <SceneShell ratio="aspect-[16/10]">
      <div className="absolute inset-0 flex flex-col justify-between p-4">
        <div style={{ animationDelay: "0ms" }} className="tk-step flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1.5">
          <PhoneCall size={11} className="text-primary" />
          <span className="text-[9px] font-semibold text-foreground">Incoming business call</span>
          <SceneChip delay={140} className="ml-auto">Routing</SceneChip>
        </div>

        <svg viewBox="0 0 300 44" className="h-11 w-full text-primary" preserveAspectRatio="none">
          <path d="M150 2 V14 M150 14 H40 V40 M150 14 H150 V40 M150 14 H260 V40" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.32" />
          <path className="tk-dash" d="M150 2 V14 H40 V40" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="150" cy="14" r="3" fill="currentColor" />
        </svg>

        <div className="grid grid-cols-3 gap-1.5">
          {[
            { icon: Voicemail, label: "Transcribed", d: 420 },
            { icon: Workflow, label: "Workflow", d: 620 },
            { icon: CheckCircle2, label: "Task done", d: 820 },
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

        <div style={{ animationDelay: "1020ms" }} className="tk-step flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
          <Bell size={11} className="text-primary" />
          <span className="text-[9px] font-semibold text-foreground">Team notified</span>
          <SceneBar delay={1120} tone="primary" className="ml-auto h-1 w-10" />
        </div>
      </div>
    </SceneShell>
  );
}