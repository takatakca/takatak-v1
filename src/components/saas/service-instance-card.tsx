import { Card, CardBody } from "@/components/ui/card";
import { brandById } from "@/lib/data/mock-data";
import type { ServiceInstance } from "@/lib/data/types";
import { StatusBadge } from "./status-badge";

export function ServiceInstanceCard({ service }: { service: ServiceInstance }) {
  const brand = brandById(service.brandId);
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{service.title}</h3>
            <p className="text-[11px] text-slate-400">{brand?.name ?? "Unassigned brand"}</p>
          </div>
          <StatusBadge status={service.status} />
        </div>
        {service.futureEngine ? (
          <p className="text-xs text-slate-500">
            Future engine: <span className="font-medium text-slate-700">{service.futureEngine}</span>
          </p>
        ) : null}
        <p className="text-[11px] text-slate-400">Activates in {service.activationPhase} · Mock foundation data</p>
      </CardBody>
    </Card>
  );
}
