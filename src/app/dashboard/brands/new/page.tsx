import { BrandForm } from "@/components/brands/brand-form";
import { ModuleHeader } from "@/components/saas/module-header";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic =
  "force-dynamic";

export default async function NewBrandPage() {
  await requireWorkspacePermission(
    "manage_brands",
    "/dashboard/brands/new",
  );

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Create brand"
        description="This creates a real workspace-owned brand boundary for social accounts, content, campaigns, analytics, reports, services, and locations."
      />

      <BrandForm
        mode="create"
        initialValues={{
          name: "",
          legalName: "",
          category: "",
          website: "",
          phone: "",
          addressLine1: "",
          addressLine2: "",
          city: "",
          region: "",
          postalCode: "",
          country: "Canada",
          timezone:
            "America/Toronto",
          status: "active",
        }}
      />
    </div>
  );
}