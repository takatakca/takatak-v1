import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { REPORT_PERIOD_LABELS, REPORT_TYPE_LABELS, SECTION_TYPE_LABELS, TEMPLATE_STATUS_LABELS, reportToneForStatus } from "@/lib/reports/status";
import type { ReportTemplateSummary } from "@/lib/reports/types";

export function ReportTemplateCard({ template }: { template: ReportTemplateSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{template.name}</h3>
            <p className="text-[11px] text-slate-400">
              {REPORT_TYPE_LABELS[template.type] ?? template.type}
              {template.defaultPeriod ? ` · ${REPORT_PERIOD_LABELS[template.defaultPeriod] ?? template.defaultPeriod}` : ""}
            </p>
          </div>
          <Badge tone={reportToneForStatus(template.status)}>{TEMPLATE_STATUS_LABELS[template.status] ?? template.status}</Badge>
        </div>
        {template.description ? <p className="text-xs leading-relaxed text-slate-500">{template.description}</p> : null}
        {template.sectionsPlan.length ? (
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Section structure</p>
            <ol className="space-y-0.5">
              {template.sectionsPlan.map((s, i) => (
                <li key={`${s.type}-${i}`} className="text-xs text-slate-600">
                  {i + 1}. {s.title} <span className="text-[10px] text-slate-400">({SECTION_TYPE_LABELS[s.type] ?? s.type})</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
