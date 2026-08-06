import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import type { AuditLogSummary } from "@/lib/admin/types";

export function AuditLogCard({ entry }: { entry: AuditLogSummary }) {
  return (
    <Card>
      <CardBody className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-mono text-xs font-semibold text-slate-900">{entry.action}</h3>
            <p className="text-[11px] text-slate-400">
              {entry.actorName ?? "System"} · {entry.entityType ?? "—"}{entry.clientName ? ` · ${entry.clientName}` : ""} · {entry.createdAt}
            </p>
          </div>
          <Badge tone="muted">{entry.entityType ?? "system"}</Badge>
        </div>
        {entry.note ? <p className="text-xs leading-relaxed text-slate-600">{entry.note}</p> : (
          <p className="text-[11px] text-slate-400">No note. Raw metadata is not displayed.</p>
        )}
      </CardBody>
    </Card>
  );
}
