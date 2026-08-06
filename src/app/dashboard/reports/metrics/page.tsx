import { ReportEmptyState } from "@/components/reports/report-empty-state";
import { ReportHeader } from "@/components/reports/report-header";
import { ReportMetricList } from "@/components/reports/report-metric-list";
import { ReportSourceBanner } from "@/components/reports/source-banner";
import { getReportMetricsData } from "@/lib/reports/reporting-data";

export const dynamic = "force-dynamic";

export default async function ReportMetricsPage() {
  const data = await getReportMetricsData();
  return (
    <div className="space-y-5">
      <ReportHeader
        title="Report Metrics"
        subtitle="Metric snapshots recorded for reports. Sources are foundation-only — no provider analytics sync exists."
        badges={[{ label: "Foundation", status: "draft" }]}
      />
      <ReportSourceBanner source={data.source} label={data.sourceLabel} />
      {data.metrics.length ? (
        <ReportMetricList metrics={data.metrics} />
      ) : (
        <ReportEmptyState title="No metrics yet" description="Report metric snapshots appear here." />
      )}
    </div>
  );
}
