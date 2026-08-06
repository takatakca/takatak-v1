import { Badge, toneForStatus } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { STATUS_LABELS } from "@/lib/dashboard/dashboard-config";
import type { ModulePlaceholderDef } from "@/lib/dashboard/types";

// Shared placeholder page body for every Phase 1 module route.
export function ModulePlaceholder({ def }: { def: ModulePlaceholderDef }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{def.title}</h1>
        <Badge tone={toneForStatus(def.status)}>{STATUS_LABELS[def.status]}</Badge>
        <Badge tone="neutral">Foundation placeholder</Badge>
      </div>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600">{def.purpose}</p>
      {def.engine ? (
        <p className="text-xs text-slate-400">
          Future engine: <span className="font-medium text-slate-600">{def.engine}</span>
        </p>
      ) : null}

      <Card>
        <CardHeader title="Planned functions" subtitle="From the master architecture. Built in later phases." />
        <CardBody className="grid gap-2 sm:grid-cols-2">
          {def.functions.map((fn) => (
            <div
              key={fn}
              className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700"
            >
              {fn}
            </div>
          ))}
        </CardBody>
      </Card>

      <p className="text-xs text-slate-400">
        {def.note ??
          "Real data and integrations are not connected yet. This module activates in its build phase — see docs/TAKATAK_DASHBOARD_V1_FULL_SCREEN_ARCHITECTURE.md."}
      </p>
    </div>
  );
}
