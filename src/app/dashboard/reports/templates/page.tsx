import { ReportEmptyState } from "@/components/reports/report-empty-state";
import { ReportHeader } from "@/components/reports/report-header";
import { ReportSourceBanner } from "@/components/reports/source-banner";
import { ReportTemplateCard } from "@/components/reports/report-template-card";
import { getReportTemplatesData } from "@/lib/reports/reporting-data";

export const dynamic = "force-dynamic";

export default async function ReportTemplatesPage() {
  const data = await getReportTemplatesData();
  return (
    <div className="space-y-5">
      <ReportHeader
        title="Report Templates"
        subtitle="Reusable report structures. A template editor arrives in a later phase."
        badges={[{ label: "Foundation", status: "draft" }]}
      />
      <ReportSourceBanner source={data.source} label={data.sourceLabel} />
      {data.templates.length ? (
        <div className="grid gap-3 lg:grid-cols-3 sm:grid-cols-2">
          {data.templates.map((t) => <ReportTemplateCard key={t.id} template={t} />)}
        </div>
      ) : (
        <ReportEmptyState title="No templates yet" description="Report templates appear here." />
      )}
    </div>
  );
}
