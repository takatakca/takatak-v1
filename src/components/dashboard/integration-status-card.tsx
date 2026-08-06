import { Badge, toneForStatus } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { INTEGRATION_ROWS, STATUS_LABELS } from "@/lib/dashboard/dashboard-config";

export function IntegrationStatusCard() {
  return (
    <Card>
      <CardHeader
        title="Integration Status"
        subtitle="No provider is connected yet — statuses are honest by design."
      />
      <CardBody className="divide-y divide-slate-100 p-0">
        {INTEGRATION_ROWS.map((row) => (
          <div key={row.name} className="flex items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">{row.name}</p>
              <p className="text-[11px] text-slate-400">{row.purpose}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge tone={toneForStatus(row.status)}>{STATUS_LABELS[row.status]}</Badge>
              <span className="text-[10px] text-slate-400">{row.actionLabel}</span>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
