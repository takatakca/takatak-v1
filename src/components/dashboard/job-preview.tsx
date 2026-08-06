import { Badge, toneForStatus } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { JOB_PREVIEW } from "@/lib/dashboard/dashboard-config";

export function JobPreview() {
  return (
    <Card>
      <CardHeader
        title="Workflow / Jobs"
        subtitle="Job system planned — no background workers connected yet."
      />
      <CardBody className="grid gap-2 sm:grid-cols-2">
        {JOB_PREVIEW.map((job) => (
          <div
            key={job.name}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
          >
            <span className="truncate text-xs font-medium text-slate-700">{job.name}</span>
            <Badge tone={toneForStatus(job.status)}>
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </Badge>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
