import type { IntegrationConnection } from "@/lib/data/types";
import { StatusBadge } from "./status-badge";

export function IntegrationStatusRow({ integration }: { integration: IntegrationConnection }) {
  return (
    <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-800">{integration.displayName}</p>
          <StatusBadge status={integration.status} />
        </div>
        <p className="mt-0.5 text-xs text-slate-500">{integration.purpose}</p>
        <p className="mt-1 text-[11px] text-slate-400">
          Unlocks in {integration.activationPhase} · Requires: {integration.requirement}
        </p>
      </div>
      <div className="shrink-0 text-[11px] text-slate-400 sm:text-right">
        <p className="font-medium text-slate-500">Env vars (names only)</p>
        {integration.envVars.map((v) => (
          <p key={v} className="font-mono">{v}</p>
        ))}
      </div>
    </div>
  );
}
