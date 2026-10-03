import {
  Activity,
  BadgeCheck,
  Building2,
  CircleAlert,
  ShoppingBag,
  Smartphone,
  Users,
} from "lucide-react";

import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminKpiCard } from "@/components/admin/admin-kpi-card";
import { AdminSourceBanner } from "@/components/admin/source-banner";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getOneLvMasterAdminData } from "@/lib/admin/one-lv-master-data";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

function when(value: string | null): string {
  if (!value) return "No synchronization yet";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  }).format(new Date(value));
}

export default async function OneLvAdminPage() {
  const access = await requireAdminAccess();
  const data = await getOneLvMasterAdminData();

  const kpis = [
    { label: "1LV customers", value: data.customers, icon: Users },
    { label: "Guest identities", value: data.guests, icon: Users },
    { label: "Verified email", value: data.verifiedEmail, icon: BadgeCheck },
    { label: "Verified phone", value: data.verifiedPhone, icon: Smartphone },
    { label: "Master merchants", value: data.masterMerchants, icon: Building2 },
    { label: "1LV stores", value: data.sourceMerchants, icon: ShoppingBag },
    {
      label: "Customer ↔ store links",
      value: data.customerMerchantRelationships,
      icon: Users,
    },
    { label: "Processed events", value: data.processedEvents, icon: Activity },
    { label: "Failed events", value: data.failedEvents, icon: CircleAlert },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="1LV Master Control Plane"
        subtitle="Read-only TAKATAK view of 1LV identity, merchant and synchronization projections. 1LV remains transaction authority for marketplace commerce."
        badges={[
          "TAKATAK master identity",
          "1LV operationally independent",
          "Read only",
          "No payment secrets",
        ]}
      />

      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <AdminSourceBanner
        source={data.available ? "database" : "unavailable"}
        label={data.sourceLabel}
      />

      <section aria-label="1LV master metrics">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((item) => (
            <AdminKpiCard
              key={item.label}
              label={item.label}
              value={item.value}
              icon={item.icon}
            />
          ))}
        </div>
      </section>

      <Card>
        <CardHeader
          title="Synchronization health"
          subtitle="Server-to-server 1LV → TAKATAK master projection."
        />
        <CardBody className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span className="text-sm text-slate-700">
              Last activity: {when(data.lastSynchronizedAt)}
            </span>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            TAKATAK stores normalized identity, merchant and customer↔store
            relationship projections only. Passwords, OTP codes, session
            tokens, payment amounts, payout data, card data and provider
            secrets are rejected by the master API contract.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Recent 1LV merchants"
          subtitle="Operational status only. Financial credentials remain in 1LV."
        />
        <CardBody>
          {data.recentMerchants.length ? (
            <div className="divide-y divide-slate-100">
              {data.recentMerchants.map((merchant) => (
                <div
                  key={merchant.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {merchant.storeName}
                    </p>
                    <p className="text-xs text-slate-500">
                      Last sync {when(merchant.lastSynchronizedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {merchant.marketplaceStatus ? (
                      <Badge>{merchant.marketplaceStatus}</Badge>
                    ) : null}
                    {merchant.subscriptionStatus ? (
                      <Badge>{merchant.subscriptionStatus}</Badge>
                    ) : null}
                    {merchant.subscriptionPlan ? (
                      <Badge>{merchant.subscriptionPlan}</Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No 1LV merchant projections have been received yet.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Recent 1LV synchronization events"
          subtitle="Metadata only — raw event payloads are intentionally not rendered."
        />
        <CardBody>
          {data.recentEvents.length ? (
            <div className="divide-y divide-slate-100">
              {data.recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {event.eventType}
                    </p>
                    <p className="text-xs text-slate-500">
                      {when(event.processedAt ?? event.createdAt)}
                    </p>
                  </div>
                  <Badge
                    tone={
                      event.status === "PROCESSED"
                        ? "success"
                        : event.status === "FAILED"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {event.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No 1LV synchronization events have been received yet.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
