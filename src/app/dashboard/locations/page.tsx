import {
  MapPin,
  Plus,
} from "lucide-react";

import { BrandSwitcher } from "@/components/brands/brand-switcher";
import { LocationList } from "@/components/locations/location-list";
import { EmptyState } from "@/components/saas/empty-state";
import { ModuleHeader } from "@/components/saas/module-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardHeader,
} from "@/components/ui/card";
import { getLocationDirectoryData } from "@/lib/locations/location-data";
import { resolveBrandSessionContext } from "@/lib/security/brand-context";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic =
  "force-dynamic";

export default async function LocationsPage() {
  const access =
    await requireWorkspacePermission(
      "manage_brands",
      "/dashboard/locations",
    );

  const brandContext =
    await resolveBrandSessionContext(
      access,
    );

  const data =
    await getLocationDirectoryData(
      access,
      brandContext.activeBrandId,
    );

  const activeBrandName =
    brandContext.activeBrandName;

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Locations"
        description={
          data.source === "database"
            ? activeBrandName
              ? `Showing physical locations for ${activeBrandName} inside ${data.workspaceName}.`
              : `Manage physical business locations inside ${data.workspaceName}.`
            : "Manage workspace-owned physical business locations."
        }
        actions={
          <Button href="/dashboard/locations/new">
            <Plus className="h-4 w-4" />
            Add location
          </Button>
        }
      />

      {brandContext.availableBrands
        .length > 0 ? (
        <Card>
          <CardHeader
            title="Brand filter"
            subtitle="Choose a brand to limit the location directory, or select All brands."
          />

          <CardBody>
            <div className="max-w-md">
              <BrandSwitcher
                activeBrandId={
                  brandContext.activeBrandId
                }
                brands={
                  brandContext.availableBrands
                }
              />
            </div>
          </CardBody>
        </Card>
      ) : null}

      {data.source ===
      "unavailable" ? (
        <Card>
          <CardBody>
            <p className="text-sm font-medium text-slate-900">
              Location data unavailable
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {data.message}
            </p>
          </CardBody>
        </Card>
      ) : data.locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={
            activeBrandName
              ? `No locations for ${activeBrandName}`
              : "No business locations yet"
          }
          description="Create a physical location for one of the workspace brands."
        />
      ) : (
        <LocationList
          locations={data.locations}
        />
      )}
    </div>
  );
}