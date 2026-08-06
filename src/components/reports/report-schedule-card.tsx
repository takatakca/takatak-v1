import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { SCHEDULE_FREQUENCY_LABELS, SCHEDULE_STATUS_LABELS, reportToneForStatus } from "@/lib/reports/status";
import type { ReportScheduleSummary } from "@/lib/reports/types";

export function ReportScheduleCard({ schedule }: { schedule: ReportScheduleSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{schedule.name}</h3>
            <p className="text-[11px] text-slate-400">
              {schedule.clientName ?? "—"}{schedule.brandName ? ` · ${schedule.brandName}` : ""}
              {schedule.templateName ? ` · Template: ${schedule.templateName}` : ""}
            </p>
          </div>
          <Badge tone={reportToneForStatus(schedule.status)}>{SCHEDULE_STATUS_LABELS[schedule.status] ?? schedule.status}</Badge>
        </div>
        <p className="text-xs text-slate-500">
          {SCHEDULE_FREQUENCY_LABELS[schedule.frequency] ?? schedule.frequency}
          {schedule.nextRunAt ? ` · Next run ${schedule.nextRunAt}` : " · No next run set"}
          {schedule.lastRunAt ? ` · Last run ${schedule.lastRunAt}` : " · Never run"}
        </p>
        <p className="text-[11px] text-slate-400">{schedule.note ?? "No background worker is active."}</p>
      </CardBody>
    </Card>
  );
}
