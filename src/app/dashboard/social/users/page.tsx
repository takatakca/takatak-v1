import { UserManagementView } from "@/components/team/user-management-view";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
import { getWorkspaceTeamData } from "@/lib/team/team-data";
import {
  getUserManagementCapabilities,
  readUserManagementTab,
} from "@/lib/team/user-management-capabilities";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "User management",
  robots: { index: false, follow: false },
};

export default async function SocialUserManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const access = await requireWorkspacePermission(
    "view_team",
    "/dashboard/social/users",
  );
  const params = await searchParams;
  const data = await getWorkspaceTeamData(access);

  return (
    <UserManagementView
      data={data}
      tab={readUserManagementTab(params.tab)}
      basePath="/dashboard/social/users"
      capabilities={getUserManagementCapabilities(access)}
    />
  );
}
