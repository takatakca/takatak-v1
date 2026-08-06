import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { JOB_LOG_LEVEL_LABELS, JOB_STATUS_LABELS, adminToneForStatus } from "@/lib/admin/status";
import type { JobMonitorSummary } from "@/lib/admin/types";

export function JobStatusCard({ job }: { job: JobMonitorSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{job.type}</h3>
            <p className="text-[11px] text-slate-400">
              {job.clientName ?? "System"}{job.provider ? ` · ${job.provider}` : ""}
            </p>
          </div>
          <Badge tone={adminToneForStatus(job.status)}>{JOB_STATUS_LABELS[job.status] ?? job.status}</Badge>
        </div>
        <p className="text-[11px] text-slate-400">
          Attempts {job.attempts}/{job.maxAttempts}
          {job.scheduledFor ? ` · Scheduled ${job.scheduledFor}` : " · Not scheduled"}
          {" "}· Created {job.createdAt}
        </p>
        {job.errorMessage ? <p className="text-xs text-rose-600">{job.errorMessage}</p> : null}
        {job.logs.length ? (
          <ul className="space-y-1 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
            {job.logs.map((l) => (
              <li key={l.id} className="text-[11px] text-slate-500">
                <Badge tone={adminToneForStatus(l.level)}>{JOB_LOG_LEVEL_LABELS[l.level] ?? l.level}</Badge>{" "}
                {l.message} <span className="text-slate-300">· {l.createdAt}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-400 ring-1 ring-inset ring-slate-200">
          Retry — coming soon (no worker exists)
        </span>
      </CardBody>
    </Card>
  );
}
