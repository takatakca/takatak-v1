import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { ConnectorState, ConnectorStatus } from "@/lib/growth/types";

const STATE_LABEL: Record<ConnectorState, string> = {
  built_in: "Built in",
  configured_untested: "Credentials set — untested",
  not_configured: "Not connected",
  planned: "Planned",
};

const STATE_TONE: Record<ConnectorState, "success" | "accent" | "warning" | "muted"> = {
  built_in: "success",
  configured_untested: "accent",
  not_configured: "warning",
  planned: "muted",
};

export function ConnectorStateBadge({ state }: { state: ConnectorState }) {
  return <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>;
}

export function ConnectorCard({
  connector,
  showSetupDetails,
}: {
  connector: ConnectorStatus;
  showSetupDetails: boolean;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{connector.name}</h3>
        <ConnectorStateBadge state={connector.state} />
      </div>
      <p className="mt-1.5 flex-1 text-xs leading-5 text-slate-600">{connector.purpose}</p>
      {showSetupDetails && connector.missing.length > 0 ? (
        <p className="mt-2 break-words font-mono text-[10px] leading-4 text-slate-400">
          Needs: {connector.missing.join(", ")}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium">
        {connector.managedIn ? (
          <Link href={connector.managedIn} className="text-indigo-600 hover:text-indigo-800">
            Open module →
          </Link>
        ) : null}
        {showSetupDetails && connector.docsUrl ? (
          <a href={connector.docsUrl} target="_blank" rel="noreferrer noopener" className="text-slate-500 hover:text-slate-800">
            API docs ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function ConnectorGrid({
  connectors,
  showSetupDetails,
}: {
  connectors: ConnectorStatus[];
  showSetupDetails: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {connectors.map((c) => (
        <ConnectorCard key={c.key} connector={c} showSetupDetails={showSetupDetails} />
      ))}
    </div>
  );
}
