import { redirect } from "next/navigation";

import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Plans and billing",
  robots: { index: false, follow: false },
};

export default async function BillingPage() {
  await requireWorkspacePermission(
    "view_social",
    "/dashboard/social/settings?tab=billing",
  );
  redirect("/dashboard/social/settings?tab=billing");
}
