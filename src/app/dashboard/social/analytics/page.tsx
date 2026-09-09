import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SocialEmptyState } from "@/components/social/social-empty-state";
import { SocialHeader } from "@/components/social/social-header";
import { SourceBanner } from "@/components/social/source-banner";
import { getSocialShellBilling } from "@/lib/billing/social/billing-banner";
import { SOCIAL_BILLING_HREF } from "@/lib/billing/social/billing-banner-policy";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
import { getSocialAnalyticsData } from "@/lib/social/social-data";

export const dynamic = "force-dynamic";

export default async function SocialAnalyticsPage() {
  const access = await requireWorkspacePermission(
    "view_social",
    "/dashboard/social/analytics",
  );
  const [data, billing] = await Promise.all([
    getSocialAnalyticsData(),
    getSocialShellBilling(access.activeClientId),
  ]);
  const a = data.analytics;
  const historyDays = billing?.analyticsHistoryDays ?? null;
  return (
    <div className="space-y-5">
      <SocialHeader
        title="Social Analytics"
        subtitle="Performance data arrives with the Metricool sync in Phase 6. No charts here pretend to be real provider data."
        badges={[{ label: "Foundation" }, { label: "Metricool not connected", status: "not_connected" }]}
      />
      {historyDays !== null ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Free includes {historyDays} days of analytics history.{" "}
          <Link
            href={SOCIAL_BILLING_HREF}
            className="font-medium text-[#2a1728] underline-offset-2 hover:underline"
          >
            Starter unlocks the full window
          </Link>
          .
        </p>
      ) : null}
      <SourceBanner source={data.source} label={data.sourceLabel} />
      {a.hasData ? (
        <Card>
          <CardHeader
            title="Totals"
            subtitle={`${a.days} day record${a.days === 1 ? "" : "s"}`}
            action={a.source === "internal_mock" ? <Badge tone="muted">Sample / foundation data</Badge> : null}
          />
          <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Object.entries(a.totals).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-center">
                <p className="text-lg font-semibold text-slate-900">{v}</p>
                <p className="text-[11px] capitalize text-slate-400">{k}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : (
        <SocialEmptyState
          icon={BarChart3}
          title="No analytics yet"
          description="Reach, impressions, engagement, clicks, and followers sync from Metricool once it is connected in Phase 6."
        />
      )}
    </div>
  );
}
