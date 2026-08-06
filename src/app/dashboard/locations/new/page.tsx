import Link from "next/link";

import { LocationForm } from "@/components/locations/location-form";
import { ModuleHeader } from "@/components/saas/module-header";
import {
  Card,
  CardBody,
  CardHeader,
} from "@/components/ui/card";
import { getBrandOptions } from "@/lib/brands/brand-data";
import { resolveBrandSessionContext } from "@/lib/security/brand-context";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic =
  "force-dynamic";

export default async function NewLocationPage() {
  const access =
    await requireWorkspacePermission(
      "manage_brands",
      "/dashboard/locations/new",
    );

  const [brands, brandContext] =
    await Promise.all([
      getBrandOptions(access),

      resolveBrandSessionContext(
        access,
      ),
    ]);

  const selectedBrandId =
    brandContext.activeBrandId ??
    brands[0]?.id ??
    "";

  if (brands.length === 0) {
    return (
      <div className="space-y-5">
        <ModuleHeader
          title="Create location"
          description="A location must belong to a real brand inside the active workspace."
        />

        <Card>
          <CardHeader
            title="Create a brand first"
            subtitle="No available brands were found in the selected workspace."
          />

          <CardBody>
            <p className="text-sm leading-6 text-slate-600">
              Create at least one active,
              draft, or paused brand before
              adding a physical location.
            </p>

            <Link
              href="/dashboard/brands/new"
              className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              Create brand
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Create location"
        description="Create a real workspace-owned physical location for local listings, social accounts, scheduling, and reporting."
      />

      <LocationForm
        mode="create"
        brands={brands}
        initialValues={{
          businessBrandId:
            selectedBrandId,
          name: "",
          phone: "",
          website: "",
          addressLine1: "",
          addressLine2: "",
          city: "",
          region: "",
          postalCode: "",
          country: "Canada",
          timezone:
            "America/Toronto",
          latitude: "",
          longitude: "",
          isPrimary: false,
          status: "active",
        }}
      />
    </div>
  );
}