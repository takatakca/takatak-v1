import { AccountSettingsView } from "@/components/account/account-settings-view";
import {
  getAccountSettingsPageData,
  readAccountSettingsTab,
} from "@/lib/account/account-settings-data";
import { getAccountIntegrationsPageData } from "@/lib/account/account-integrations-data";
import { getPlansBillingPageData } from "@/lib/billing/social/billing-page-data";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function SocialAccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const access = await requireWorkspacePermission(
    "view_social",
    "/dashboard/social/settings",
  );
  const params = await searchParams;
  const [data, billingData, integrationsData] = await Promise.all([
    getAccountSettingsPageData(access),
    getPlansBillingPageData(access),
    getAccountIntegrationsPageData(access),
  ]);

  return (
    <AccountSettingsView
      data={data}
      tab={readAccountSettingsTab(params.tab)}
      basePath="/dashboard/social/settings"
      billingData={billingData}
      canManageBilling={hasEffectivePermission(access, "manage_settings")}
      integrationsData={integrationsData}
    />
  );
}
