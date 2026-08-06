import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ReportBoundaryWarning } from "@/components/reports/report-boundary-warning";
import { ReportEmptyState } from "@/components/reports/report-empty-state";
import { ReportHeader } from "@/components/reports/report-header";
import { ReportMetricList } from "@/components/reports/report-metric-list";
import { ReportSectionPreview } from "@/components/reports/report-section-preview";
import { ReportSourceBanner } from "@/components/reports/source-banner";
import { REPORT_STATUS_LABELS, REPORT_TYPE_LABELS, reportToneForStatus } from "@/lib/reports/status";
import { getReportPreviewData } from "@/lib/reports/reporting-data";

export const dynamic = "force-dynamic";

export default async function ReportPreviewPage() {
  const data = await getReportPreviewData();
  return (
    <div className="space-y-5">
      <ReportHeader
        title="Report Preview"
        subtitle="Internal preview of the first foundation report draft. No public link and no PDF export exist."
        badges={[{ label: "Internal preview", status: "draft" }, { label: "Export not active" }]}
      />
      <ReportSourceBanner source={data.source} label={data.sourceLabel} />
      {data.report ? (
        <Card>
          <CardHeader
            title={data.report.title}
            subtitle={`${REPORT_TYPE_LABELS[data.report.type] ?? data.report.type} · ${data.report.clientName ?? "—"}${data.report.brandName ? " · " + data.report.brandName : ""}`}
            action={<Badge tone={reportToneForStatus(data.report.status)}>{REPORT_STATUS_LABELS[data.report.status] ?? data.report.status}</Badge>}
          />
          <CardBody className="space-y-4">
            {data.report.summaryPreview ? (
              <p className="text-xs leading-relaxed text-slate-600">{data.report.summaryPreview}</p>
            ) : null}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Sections</h3>
              <ReportSectionPreview sections={data.sections} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Metrics</h3>
              <ReportMetricList metrics={data.metrics} />
            </div>
          </CardBody>
        </Card>
      ) : (
        <ReportEmptyState title="No report to preview" description="Create a report draft first." />
      )}
      <ReportBoundaryWarning />
    </div>
  );
}
