import { SocialInboxView } from "@/components/social/inbox/social-inbox-view";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
import { getSocialInboxData } from "@/lib/social/inbox/inbox-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inbox",
  robots: { index: false, follow: false },
};

export default async function SocialInboxPage() {
  const access = await requireWorkspacePermission(
    "view_social",
    "/dashboard/social/inbox",
  );
  const brand = await resolveBrandSessionContextFromRequest(access);
  const data = await getSocialInboxData(access, brand.activeBrandId);

  return <SocialInboxView data={data} />;
}
