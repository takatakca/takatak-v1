import { SmartLinksManager } from "@/components/social/smartlinks/smartlinks-manager";
import { getApplicationOrigin } from "@/lib/config/app-origin";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
import { listSmartLinks, smartLinksActivated, type SmartLinkView } from "@/lib/social/smartlinks/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SmartLinks",
  robots: { index: false, follow: false },
};

export default async function SocialSmartLinksPage() {
  const access = await requireWorkspacePermission("view_social", "/dashboard/social/smartlinks");
  const brand = await resolveBrandSessionContextFromRequest(access);
  const activated = await smartLinksActivated().catch(() => false);
  let links: SmartLinkView[] = [];
  if (activated && brand.activeBrandId) {
    links = await listSmartLinks({ clientId: access.activeClientId, businessBrandId: brand.activeBrandId }).catch(() => []);
  }
  return (
    <SmartLinksManager
      activated={activated}
      hasBrand={Boolean(brand.activeBrandId)}
      brandName={brand.activeBrandDisplayLabel ?? brand.activeBrandName}
      canManage={hasEffectivePermission(access, "manage_social_accounts")}
      origin={getApplicationOrigin()}
      initialLinks={links}
    />
  );
}
