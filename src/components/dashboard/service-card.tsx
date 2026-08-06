import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { STATUS_LABELS } from "@/lib/dashboard/dashboard-config";
import type { ServiceModule } from "@/lib/dashboard/types";

export function ServiceCard({ module }: { module: ServiceModule }) {
  const Icon = module.icon;
  return (
    <Card className="flex flex-col">
      <CardBody className="flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Icon className="h-4.5 w-4.5" />
          </span>
          <Badge tone={toneForStatus(module.status)}>{STATUS_LABELS[module.status]}</Badge>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{module.title}</h3>
          {module.engine ? (
            <p className="text-[11px] text-slate-400">Future engine: {module.engine}</p>
          ) : null}
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{module.purpose}</p>
        </div>
        <p className="text-[11px] text-slate-400">{module.functions.join(" · ")}</p>
        <Link
          href={module.href}
          className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
        >
          Open module <ArrowRight className="h-3 w-3" />
        </Link>
      </CardBody>
    </Card>
  );
}
