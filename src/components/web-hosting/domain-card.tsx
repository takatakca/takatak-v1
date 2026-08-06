import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { DNS_STATUS_LABELS, DOMAIN_STATUS_LABELS, SSL_STATUS_LABELS, webToneForStatus } from "@/lib/web-hosting/status";
import type { DomainSummary } from "@/lib/web-hosting/types";

export function DomainCard({ domain }: { domain: DomainSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-mono text-sm font-semibold text-slate-900">{domain.domainName}</h3>
            <p className="text-[11px] text-slate-400">{domain.brandName ?? "Unassigned brand"}{domain.registrar ? ` · Registrar: ${domain.registrar}` : ""}</p>
          </div>
          <Badge tone={webToneForStatus(domain.status)}>{DOMAIN_STATUS_LABELS[domain.status] ?? domain.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
          <span>DNS: <Badge tone={webToneForStatus(domain.dnsStatus)}>{DNS_STATUS_LABELS[domain.dnsStatus] ?? domain.dnsStatus}</Badge></span>
          <span>SSL: <Badge tone={webToneForStatus(domain.sslStatus)}>{SSL_STATUS_LABELS[domain.sslStatus] ?? domain.sslStatus}</Badge></span>
        </div>
        <p className="text-[11px] text-slate-400">
          {domain.expiresAt ? `Expires ${domain.expiresAt}` : "No expiry tracked"} · Auto-renew {domain.autoRenew ? "on" : "off"}
        </p>
      </CardBody>
    </Card>
  );
}
