import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { APPROVAL_STATUS_LABELS, PLATFORM_LABELS, socialToneForStatus } from "@/lib/social/status";
import type { ApprovalSummary } from "@/lib/social/types";

export function ApprovalCard({ approval }: { approval: ApprovalSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-slate-500">
            {PLATFORM_LABELS[approval.postPlatform] ?? approval.postPlatform} · {approval.brandName ?? "—"}
          </p>
          <Badge tone={socialToneForStatus(approval.status)}>
            {APPROVAL_STATUS_LABELS[approval.status] ?? approval.status}
          </Badge>
        </div>
        <p className="text-sm text-slate-800">{approval.postCaptionPreview}</p>
        {approval.comments ? <p className="text-xs text-slate-500">“{approval.comments}”</p> : null}
        <p className="text-[11px] text-slate-400">Requested {approval.requestedAt} · Approve/reject actions activate in a later phase</p>
      </CardBody>
    </Card>
  );
}
