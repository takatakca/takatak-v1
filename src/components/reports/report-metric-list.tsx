import { DataTable, type Column } from "@/components/saas/data-table";
import { Badge } from "@/components/ui/badge";
import { METRIC_SOURCE_LABELS, reportToneForStatus } from "@/lib/reports/status";
import type { ReportMetricSummary } from "@/lib/reports/types";

const columns: Column<ReportMetricSummary>[] = [
  { key: "key", header: "Key", render: (m) => <span className="font-mono text-xs text-slate-600">{m.key}</span> },
  { key: "label", header: "Label", render: (m) => <span className="text-xs text-slate-700">{m.label}</span> },
  { key: "value", header: "Value", render: (m) => <span className="text-xs font-semibold text-slate-900">{m.value}{m.unit ? ` ${m.unit}` : ""}</span> },
  { key: "source", header: "Source", render: (m) => <Badge tone={m.source === "future_provider" ? reportToneForStatus("future_provider") : "muted"}>{METRIC_SOURCE_LABELS[m.source] ?? m.source}</Badge> },
  { key: "created", header: "Created", render: (m) => <span className="text-xs text-slate-400">{m.createdAt}</span> },
];

export function ReportMetricList({ metrics }: { metrics: ReportMetricSummary[] }) {
  return <DataTable columns={columns} rows={metrics} rowKey={(m) => m.id} caption="Report metric snapshots (foundation)" />;
}
