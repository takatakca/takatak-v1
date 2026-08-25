"use client";

import { Bot, PhoneCall, Workflow } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import { Panel, Plane, StageBadge, StepRow } from "./stageParts";

/**
 * Operate world: an illustrative TAKATAK operations command center. This is a
 * public product demonstration, never a copy of the private dashboard.
 */
export function OperateScene({ beat }: { beat: number; animated?: boolean }) {
  const { tx } = useLanguage();
  const callState =
    beat >= 3 ? { en: "Connected", fr: "Connecté" } : beat >= 2 ? { en: "Routing", fr: "Acheminement" } : { en: "Incoming", fr: "Entrant" };

  return (
    <div className="relative min-h-[420px] md:min-h-[520px]">
      {/* Central workspace */}
      <Plane depth={1} shown className="relative z-20 md:absolute md:left-1/2 md:top-[6%] md:w-[54%] md:-translate-x-1/2">
        <Panel title={tx({ en: "TAKATAK workspace", fr: "Espace TAKATAK" })} active={beat >= 1}>
          <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-3">
            <div className="grid gap-1">
              {[
                { en: "Services", fr: "Services" },
                { en: "Tasks", fr: "Tâches" },
                { en: "Calls", fr: "Appels" },
                { en: "Automation", fr: "Automatisation" },
                { en: "Activity", fr: "Activité" },
              ].map((n, i) => (
                <span
                  key={n.en}
                  className={`truncate rounded-md px-2 py-1 text-[10px] font-medium ${i === 2 && beat >= 2 ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
                >
                  {tx(n)}
                </span>
              ))}
            </div>
            <div className="grid gap-1.5">
              <StepRow label={tx({ en: "Customer call received", fr: "Appel client reçu" })} reached={beat >= 1} current={beat === 1} />
              <StepRow label={tx({ en: "Routed to the right person", fr: "Acheminé à la bonne personne" })} reached={beat >= 2} current={beat === 2} />
              <StepRow label={tx({ en: "Task created", fr: "Tâche créée" })} reached={beat >= 4} current={beat === 4} />
              <StepRow label={tx({ en: "Workspace activity updated", fr: "Activité mise à jour" })} reached={beat >= 6} current={beat === 6} />
            </div>
          </div>
        </Panel>
      </Plane>

      {/* Left — business phone */}
      <Plane depth={2} shown={beat >= 1} className="relative z-30 mt-4 md:absolute md:bottom-[10%] md:left-0 md:mt-0 md:w-[30%]">
        <Panel title={tx({ en: "Business phone", fr: "Téléphonie" })} active={beat >= 1} meta={<PhoneCall size={13} className="text-primary" aria-hidden />}>
          <p className="text-[12px] font-semibold text-foreground/90">+1 (514) 000-0000</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{tx(callState)}</p>
          <div className="mt-2 flex h-6 items-end gap-0.5">
            {Array.from({ length: 16 }).map((_, i) => (
              <span
                key={i}
                className={`w-1 rounded-sm transition-all duration-500 ${beat >= 1 ? "bg-primary/60" : "bg-white/10"}`}
                style={{ height: `${beat >= 1 ? 20 + ((i * 37) % 70) : 12}%` }}
              />
            ))}
          </div>
        </Panel>
      </Plane>

      {/* Right — automation workflow */}
      <Plane depth={1} shown={beat >= 3} className="relative z-30 mt-4 md:absolute md:bottom-[6%] md:right-0 md:mt-0 md:w-[34%]">
        <Panel title={tx({ en: "Automation", fr: "Automatisation" })} active={beat >= 3} meta={<Workflow size={13} className="text-primary" aria-hidden />}>
          <div className="grid gap-1.5">
            <StepRow label={tx({ en: "Trigger", fr: "Déclencheur" })} reached={beat >= 3} current={beat === 3} />
            <StepRow label={tx({ en: "Condition", fr: "Condition" })} reached={beat >= 4} />
            <StepRow label={tx({ en: "Action", fr: "Action" })} reached={beat >= 5} current={beat === 5} />
            <StepRow label={tx({ en: "Complete", fr: "Terminé" })} reached={beat >= 6} />
          </div>
        </Panel>
      </Plane>

      <div className="pointer-events-none relative z-40 mt-4 flex flex-wrap gap-2 md:absolute md:right-[6%] md:top-0 md:mt-0 md:flex-col md:items-end">
        <StageBadge shown={beat >= 1} tone="progress">
          <PhoneCall size={11} aria-hidden /> {tx({ en: "Incoming call", fr: "Appel entrant" })}
        </StageBadge>
        <StageBadge shown={beat >= 6} tone="done">
          <Workflow size={11} aria-hidden /> {tx({ en: "Automation complete", fr: "Automatisation terminée" })}
        </StageBadge>
        <StageBadge shown={beat >= 5} tone="progress">
          <Bot size={11} aria-hidden /> {tx({ en: "Follow-up prepared for review", fr: "Suivi préparé pour révision" })}
        </StageBadge>
      </div>
    </div>
  );
}