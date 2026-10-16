import { deliverReport } from "@/app/dashboard/reports/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { REPORT_STATUS_LABELS, REPORT_TYPE_LABELS, reportToneForStatus } from "@/lib/reports/status";
import type { ReportDraftSummary } from "@/lib/reports/types";

export function ReportDraftCard({
  draft,
  canExport = false,
}: {
  draft: ReportDraftSummary;
  canExport?: boolean;
}) {
  const exportable = canExport && draft.status !== "archived";
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
        {exportable ? (
          <div className="flex flex-wrap items-center gap-3">
            <a href={`/dashboard/reports/export/pdf?id=${draft.id}`} className="text-xs font-medium text-indigo-700 hover:text-indigo-500">
              Télécharger le PDF
            </a>
            <form action={deliverReport}>
              <input type="hidden" name="reportId" value={draft.id} />
              <button type="submit" className="text-xs font-medium text-indigo-700 hover:text-indigo-500">
                Remettre dans le tableau de bord
              </button>
            </form>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
