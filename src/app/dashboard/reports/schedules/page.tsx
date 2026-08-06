import { ReportEmptyState } from "@/components/reports/report-empty-state";
import { ReportHeader } from "@/components/reports/report-header";
import { ReportScheduleCard } from "@/components/reports/report-schedule-card";
import { ReportSourceBanner } from "@/components/reports/source-banner";
import { getReportSchedulesData } from "@/lib/reports/reporting-data";

export const dynamic = "force-dynamic";

export default async function ReportSchedulesPage() {
  const data = await getReportSchedulesData();
  return (
    <div className="space-y-5">
      <ReportHeader
        title="Report Schedules"
        subtitle="Recurring report foundation. Schedule records exist for planning only — no background worker is active."
        badges={[{ label: "Foundation", status: "draft" }, { label: "No worker active" }]}
      />
      <ReportSourceBanner source={data.source} label={data.sourceLabel} />
      {data.schedules.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.schedules.map((s) => <ReportScheduleCard key={s.id} schedule={s} />)}
        </div>
      ) : (
        <ReportEmptyState title="No schedules yet" description="Report schedules appear here." />
      )}
    </div>
  );
}
