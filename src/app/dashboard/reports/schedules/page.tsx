import { ReportEmptyState } from "@/components/reports/report-empty-state";
import { ReportHeader } from "@/components/reports/report-header";
import { ReportScheduleCard } from "@/components/reports/report-schedule-card";
import { ReportSourceBanner } from "@/components/reports/source-banner";
import { getReportSchedulesData } from "@/lib/reports/reporting-data";
import { StaffOnly } from "@/components/dashboard/staff-only";

export const dynamic = "force-dynamic";

async function ReportSchedulesPageScreen() {
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

// Not self-serve for clients yet: TAKATAK staff see the screen, clients see
// what it is for and ask the team (owner's order, Nov 2026: no prototypes).
export default async function ReportSchedulesPage() {
  return (
    <StaffOnly
      title="Rapports planifiés · Scheduled reports"
      purpose="Vos rapports envoyés à intervalle régulier · Your reports sent on a regular schedule."
    >
      <ReportSchedulesPageScreen />
    </StaffOnly>
  );
}
