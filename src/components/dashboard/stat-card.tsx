import { Card, CardBody } from "@/components/ui/card";
import type { KpiCard } from "@/lib/dashboard/types";

export function StatCard({ kpi }: { kpi: KpiCard }) {
  const Icon = kpi.icon;
  return (
    <Card>
      <CardBody className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">{kpi.value}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{kpi.hint}</p>
        </div>
      </CardBody>
    </Card>
  );
}
