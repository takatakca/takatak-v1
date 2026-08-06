import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { HOSTING_STATUS_LABELS, SERVER_STATUS_LABELS, webToneForStatus } from "@/lib/web-hosting/status";
import type { HostingServiceSummary } from "@/lib/web-hosting/types";

export function HostingServiceCard({ service }: { service: HostingServiceSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{service.planName}</h3>
            <p className="text-[11px] text-slate-400">{service.brandName ?? "Unassigned brand"}</p>
          </div>
          <Badge tone={webToneForStatus(service.status)}>{HOSTING_STATUS_LABELS[service.status] ?? service.status}</Badge>
        </div>
        <p className="text-xs text-slate-500">
          {service.primaryDomain ? <span className="font-mono">{service.primaryDomain}</span> : "No primary domain"}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span>Server:</span>
          <Badge tone={webToneForStatus(service.serverStatus)}>{SERVER_STATUS_LABELS[service.serverStatus] ?? service.serverStatus}</Badge>
          <span>{service.renewalDate ? `Renews ${service.renewalDate}` : "No renewal date"}</span>
        </div>
      </CardBody>
    </Card>
  );
}
