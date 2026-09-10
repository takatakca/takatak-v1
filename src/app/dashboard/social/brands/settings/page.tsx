import { BrandSettingsView } from "@/components/social/brands/brand-settings-view";
import { getBrandSettingsPageData } from "@/lib/brands/brand-settings-data";
import type { BrandSettingsTab } from "@/lib/brands/brand-settings-data";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Brand settings",
  robots: { index: false, follow: false },
};

function readTab(value: string | string[] | undefined): BrandSettingsTab {
  const tab = Array.isArray(value) ? value[0] : value;
  if (tab === "connections" || tab === "ai") {
    return tab;
  }
  return "settings";
}

export default async function BrandSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const access = await requireWorkspacePermission(
    "view_social",
    "/dashboard/social",
  );

  const params = await searchParams;
  const brandContext = await resolveBrandSessionContextFromRequest(access);
  const data = await getBrandSettingsPageData(
    access,
    brandContext.activeBrandId,
  );

  return (
    <BrandSettingsView
      data={data}
      tab={readTab(params.tab)}
      canManageBrands={hasEffectivePermission(access, "manage_brands")}
      canManageSocial={hasEffectivePermission(
        access,
        "manage_social_accounts",
      )}
    />
  );
}
