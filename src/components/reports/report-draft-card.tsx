import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { REPORT_STATUS_LABELS, REPORT_TYPE_LABELS, reportToneForStatus } from "@/lib/reports/status";
import type { ReportDraftSummary } from "@/lib/reports/types";

export function ReportDraftCard({ draft }: { draft: ReportDraftSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{draft.title}</h3>
            <p className="text-[11px] text-slate-400">
              {REPORT_TYPE_LABELS[draft.type] ?? draft.type} · {draft.clientName ?? "—"}{draft.brandName ? ` · ${draft.brandName}` : ""}
            </p>
          </div>
          <Badge tone={reportToneForStatus(draft.status)}>{REPORT_STATUS_LABELS[draft.status] ?? draft.status}</Badge>
        </div>
        {draft.summaryPreview ? <p className="text-xs leading-relaxed text-slate-600">{draft.summaryPreview}</p> : null}
        <p className="text-[11px] text-slate-400">
          {draft.periodStart && draft.periodEnd ? `Period ${draft.periodStart} → ${draft.periodEnd} · ` : ""}
          {draft.sectionCount} sections · {draft.metricCount} metrics
        </p>
      </CardBody>
    </Card>
  );
}
