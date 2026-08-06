import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { ACCOUNT_STATUS_LABELS, PLATFORM_LABELS, socialToneForStatus } from "@/lib/social/status";
import type { SocialAccountCard as AccountData } from "@/lib/social/types";

export function SocialAccountCard({ account }: { account: AccountData }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{PLATFORM_LABELS[account.platform] ?? account.platform}</h3>
            <p className="text-[11px] text-slate-400">{account.brandName ?? "Unassigned brand"}</p>
          </div>
          <Badge tone={socialToneForStatus(account.status)}>{ACCOUNT_STATUS_LABELS[account.status] ?? account.status}</Badge>
        </div>
        <p className="text-xs text-slate-500">{account.handle ? `@${account.handle}` : "No handle — account not linked"}</p>
        <p className="text-[11px] text-slate-400">
          {account.lastSyncAt ? `Last sync: ${account.lastSyncAt.slice(0, 10)}` : "Never synced"} · Connect via Metricool — Phase 6
        </p>
      </CardBody>
    </Card>
  );
}
