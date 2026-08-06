import { RefreshCcw } from "lucide-react";
import { DataTable, type Column } from "@/components/saas/data-table";
import { DisabledActionButton } from "@/components/saas/disabled-action-button";
import { FoundationNotice } from "@/components/saas/foundation-notice";
import { ModuleHeader } from "@/components/saas/module-header";
import { StatusBadge } from "@/components/saas/status-badge";
import { AUTOMATION_JOBS } from "@/lib/data/mock-data";
import type { AutomationJob } from "@/lib/data/types";

const MODULE_LABELS: Record<string, string> = {
  social_media: "Social Media",
  web_hosting: "Web / Hosting",
  local_listings: "Local Listings",
  leads: "Leads",
  ai_studio: "AI Studio",
  reports: "Reports",
  core: "Core",
};

const columns: Column<AutomationJob>[] = [
  {
    key: "job",
    header: "Job",
    render: (j) => (
      <div>
        <p className="font-medium text-slate-800">{j.name}</p>
        <p className="text-xs text-slate-400">{j.description}</p>
      </div>
    ),
  },
  { key: "module", header: "Module", render: (j) => <span className="text-xs text-slate-500">{MODULE_LABELS[j.module]}</span> },
  { key: "trigger", header: "Trigger", render: (j) => <StatusBadge status={j.trigger} /> },
  { key: "status", header: "Status", render: (j) => <StatusBadge status={j.status} /> },
  { key: "phase", header: "Activates", render: (j) => <span className="text-xs text-slate-500">{j.activationPhase}</span> },
];

// Jobs — the future automation backbone. Every important action becomes trackable.
export default function JobsPage() {
  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Jobs"
        description="The automation backbone: every important action becomes a trackable job with status, retries, logs, and results."
        statuses={["planned", "mock_data"]}
        actions={<DisabledActionButton label="Retry Failed" reason="No workers yet" icon={RefreshCcw} />}
      />
      <FoundationNotice
        mock="The jobs below are the planned job catalogue — typed definitions, not executed work."
        future="Job records, logs, and retries become real with the jobs system (Phase 11); individual jobs activate with their module phases."
        notConnected="Background workers, queues, and schedulers. Nothing runs automatically yet."
      />
      <DataTable columns={columns} rows={AUTOMATION_JOBS} rowKey={(j) => j.id} caption="Planned automation jobs" />
    </div>
  );
}
