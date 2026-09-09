import { SocialReportingView } from "@/components/social/reports/social-reporting-view";
import { getSocialShellBilling } from "@/lib/billing/social/billing-banner";
import { SOCIAL_BILLING_HREF } from "@/lib/billing/social/billing-banner-policy";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reporting",
  robots: { index: false, follow: false },
};

export default async function SocialReportsPage() {
  const access = await requireWorkspacePermission(
    "view_social",
    "/dashboard/social/reports",
  );
  const billing = await getSocialShellBilling(access.activeClientId);
  const reportsUnlocked = billing?.reports ?? false;
  const advancedUnlocked = Boolean(
    billing?.entitlements.apiAccess ||
      billing?.entitlements.advancedAnalytics,
  );

  return (
    <SocialReportingView
      reportsUnlocked={reportsUnlocked}
      advancedUnlocked={advancedUnlocked}
      billingHref={SOCIAL_BILLING_HREF}
    />
  );
}
