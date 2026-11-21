import { ReportEmptyState } from "@/components/reports/report-empty-state";
import { ReportHeader } from "@/components/reports/report-header";
import { ReportMetricList } from "@/components/reports/report-metric-list";
import { ReportSourceBanner } from "@/components/reports/source-banner";
import { getReportMetricsData } from "@/lib/reports/reporting-data";
import { StaffOnly } from "@/components/dashboard/staff-only";

export const dynamic = "force-dynamic";

async function ReportMetricsPageScreen() {
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

// Not self-serve for clients yet: TAKATAK staff see the screen, clients see
// what it is for and ask the team (owner's order, Nov 2026: no prototypes).
export default async function ReportMetricsPage() {
  return (
    <StaffOnly
      title="Indicateurs des rapports · Report metrics"
      purpose="Les chiffres derrière vos rapports · The numbers behind your reports."
    >
      <ReportMetricsPageScreen />
    </StaffOnly>
  );
}
