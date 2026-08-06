import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { SSL_STATUS_LABELS, WEB_SOURCE_LABELS, webToneForStatus } from "@/lib/web-hosting/status";
import type { SslCertificateSummary } from "@/lib/web-hosting/types";

export function SslCertificateCard({ cert }: { cert: SslCertificateSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-mono text-sm font-semibold text-slate-900">{cert.domainName}</h3>
          <Badge tone={webToneForStatus(cert.status)}>{SSL_STATUS_LABELS[cert.status] ?? cert.status}</Badge>
        </div>
        <p className="text-xs text-slate-500">Issuer: {cert.issuer ?? "— (none yet)"}</p>
        <p className="text-[11px] text-slate-400">
          {cert.validFrom ? `Valid from ${cert.validFrom}` : "Not issued"} · {cert.expiresAt ? `Expires ${cert.expiresAt}` : "No expiry"} · Auto-renew {cert.autoRenew ? "on" : "off"} ·{" "}
          <Badge tone={cert.source === "internal_demo" ? "muted" : "neutral"}>{WEB_SOURCE_LABELS[cert.source] ?? cert.source}</Badge>
        </p>
      </CardBody>
    </Card>
  );
}
