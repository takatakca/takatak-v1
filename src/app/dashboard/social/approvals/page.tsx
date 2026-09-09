import { MyTasksView } from "@/components/social/my-tasks-view";
import {
  getMyTasksPageData,
  readMyTasksTab,
} from "@/lib/social/my-tasks-data";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My tasks",
  robots: { index: false, follow: false },
};

export default async function SocialApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const access = await requireWorkspacePermission(
    "view_social",
    "/dashboard/social/approvals",
  );
  const params = await searchParams;
  const data = await getMyTasksPageData(access);

  return <MyTasksView data={data} tab={readMyTasksTab(params.tab)} />;
}
