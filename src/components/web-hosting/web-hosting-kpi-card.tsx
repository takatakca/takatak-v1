import type { LucideIcon } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";

export function WebHostingKpiCard({ label, value, icon: Icon, hint }: { label: string; value: number; icon: LucideIcon; hint?: string }) {
  return (
    <Card>
      <CardBody className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
          {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
        </div>
      </CardBody>
    </Card>
  );
}
