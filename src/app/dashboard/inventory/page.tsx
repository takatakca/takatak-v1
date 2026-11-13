import { InventoryWorkspace } from "@/components/inventory/inventory-workspace";
import { ModuleHeader } from "@/components/saas/module-header";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
export const dynamic = "force-dynamic";
export default async function InventoryPage() {
  const access = await requireWorkspacePermission(
    "view_inventory",
    "/dashboard/inventory",
  );
  return (
    <div className="space-y-6">
      <ModuleHeader
        title="TAKATAK Inventory"
        description="Products, barcodes and stock movements for your businesses."
      />
      <InventoryWorkspace
        canManage={hasEffectivePermission(access, "manage_inventory")}
      />
    </div>
  );
}
