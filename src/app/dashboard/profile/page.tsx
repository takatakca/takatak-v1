import { redirect } from "next/navigation";

import { AccountSettingsView } from "@/components/account/account-settings-view";
import {
  getAccountSettingsPageData,
  readAccountSettingsTab,
} from "@/lib/account/account-settings-data";
import { getAccountIntegrationsPageData } from "@/lib/account/account-integrations-data";
import { getPlansBillingPageData } from "@/lib/billing/social/billing-page-data";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { access } = await getServerAccessContext();

  if (access.mode === "denied" && access.reason === "not_authenticated") {
    redirect("/login?next=%2Fdashboard%2Fprofile");
  }

  if (access.mode !== "client_scoped" && access.mode !== "platform_admin") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const unavailableWorkspace = {
    source: "unavailable" as const,
    message: "Select a workspace to view this settings tab.",
  };
  const [data, billingData, integrationsData] = await Promise.all([
    getAccountSettingsPageData(access),
    access.mode === "client_scoped"
      ? getPlansBillingPageData(access)
      : Promise.resolve(unavailableWorkspace),
    access.mode === "client_scoped"
      ? getAccountIntegrationsPageData(access)
      : Promise.resolve(unavailableWorkspace),
  ]);

  return (
    <AccountSettingsView
      data={data}
      tab={readAccountSettingsTab(params.tab)}
      basePath="/dashboard/profile"
      billingData={billingData}
      canManageBilling={
        access.mode === "client_scoped" &&
        hasEffectivePermission(access, "manage_settings")
      }
      integrationsData={integrationsData}
    />
  );
}
