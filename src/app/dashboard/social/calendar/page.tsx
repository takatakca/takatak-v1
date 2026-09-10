import { SocialPlanningView } from "@/components/social/planning/social-planning-view";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
import { getSocialPlanningData } from "@/lib/social/planning/planning-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Planning",
  robots: { index: false, follow: false },
};

export default async function SocialCalendarPage() {
  const access = await requireWorkspacePermission(
    "view_social",
    "/dashboard/social/calendar",
  );
  const brand = await resolveBrandSessionContextFromRequest(access);
  const data = await getSocialPlanningData(access, brand.activeBrandId);

  return (
    <SocialPlanningView
      data={data}
      canCreate={hasEffectivePermission(access, "create_content")}
    />
  );
}
