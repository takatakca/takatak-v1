import { LabelStudio } from "@/components/inventory/label-studio";
import { ModuleHeader } from "@/components/saas/module-header";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
export const dynamic = "force-dynamic";
export default async function InventoryLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const access = await requireWorkspacePermission(
    "view_inventory",
    "/dashboard/inventory/labels",
  );
  const query = await searchParams;
  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Wraparound label studio"
        description="Your product, your packaging. Design once, print at the exact jar size."
      />
      <LabelStudio
        canManage={hasEffectivePermission(access, "manage_inventory")}
        initialProductId={query.product ?? ""}
      />
    </div>
  );
}
