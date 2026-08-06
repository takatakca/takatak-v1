import { DataTable, type Column } from "@/components/saas/data-table";
import { Badge } from "@/components/ui/badge";
import { DNS_RECORD_STATUS_LABELS, WEB_SOURCE_LABELS, webToneForStatus } from "@/lib/web-hosting/status";
import type { DnsRecordSummary } from "@/lib/web-hosting/types";

const columns: Column<DnsRecordSummary>[] = [
  { key: "domain", header: "Domain", render: (r) => <span className="font-mono text-xs text-slate-700">{r.domainName}</span> },
  { key: "type", header: "Type", render: (r) => <span className="font-mono text-xs font-semibold text-slate-700">{r.type}</span> },
  { key: "name", header: "Name", render: (r) => <span className="font-mono text-xs text-slate-600">{r.name}</span> },
  { key: "value", header: "Value", render: (r) => <span className="font-mono text-xs text-slate-500">{r.value}</span> },
  { key: "ttl", header: "TTL", render: (r) => <span className="text-xs text-slate-500">{r.ttl ?? "—"}</span> },
  { key: "status", header: "Status", render: (r) => <Badge tone={webToneForStatus(r.status)}>{DNS_RECORD_STATUS_LABELS[r.status] ?? r.status}</Badge> },
  { key: "source", header: "Source", render: (r) => <Badge tone={r.source === "internal_demo" ? "muted" : "neutral"}>{WEB_SOURCE_LABELS[r.source] ?? r.source}</Badge> },
];

export function DnsRecordList({ records }: { records: DnsRecordSummary[] }) {
  return <DataTable columns={columns} rows={records} rowKey={(r) => r.id} caption="DNS records (internal tracking)" />;
}
