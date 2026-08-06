import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  MapPin,
  Navigation,
} from "lucide-react";

import { LocationForm } from "@/components/locations/location-form";
import { ModuleHeader } from "@/components/saas/module-header";
import {
  Card,
  CardBody,
  CardHeader,
} from "@/components/ui/card";
import { getBrandOptions } from "@/lib/brands/brand-data";
import type { BrandOption } from "@/lib/brands/brand-data";
import { getLocationDetailData } from "@/lib/locations/location-data";
import type { LocationStatusValue } from "@/lib/locations/location-validation";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
import { isUuid } from "@/lib/validation/common";

export const dynamic =
  "force-dynamic";

function formatAddress(location: {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
}): string {
  return [
    location.addressLine1,
    location.addressLine2,
    location.city,
    location.region,
    location.postalCode,
    location.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function InfoCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof MapPin;
}) {
  return (
    <Card>
      <CardBody className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <Icon className="h-5 w-5" />
        </span>

        <div className="min-w-0">
          <p className="text-xs text-slate-500">
            {label}
          </p>

          <p className="mt-1 break-words text-sm font-medium leading-6 text-slate-800">
            {value}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{
    locationId: string;
  }>;
}) {
  const access =
    await requireWorkspacePermission(
      "manage_brands",
      "/dashboard/locations",
    );

  const { locationId } =
    await params;

  if (!isUuid(locationId)) {
    notFound();
  }

  const [data, availableBrands] =
    await Promise.all([
      getLocationDetailData(
        access,
        locationId,
      ),

      getBrandOptions(access),
    ]);

  if (data.source === "not_found") {
    notFound();
  }

  if (
    data.source === "unavailable"
  ) {
    return (
      <div className="space-y-5">
        <ModuleHeader
          title="Location"
          description="Location details could not be loaded."
        />

        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">
              {data.message}
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const { location } = data;

  const currentBrandOption: BrandOption = {
    id: location.businessBrandId,
    name: location.brandName,
    status: location.brandStatus,
  };

  const brands = availableBrands.some(
    (brand) =>
      brand.id ===
      location.businessBrandId,
  )
    ? availableBrands
    : [
        currentBrandOption,
        ...availableBrands,
      ];

  const coordinateText =
    location.latitude !== null &&
    location.longitude !== null
      ? `${location.latitude}, ${location.longitude}`
      : "Not provided";

  return (
    <div className="space-y-5">
      <ModuleHeader
        title={location.name}
        description={`Workspace: ${data.workspaceName}. Every read and write is restricted to the active workspace.`}
        statuses={[
          location.status,
          ...(location.isPrimary
            ? ["primary"]
            : []),
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/brands/${location.businessBrandId}`}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Open brand
            </Link>

            <Link
              href="/dashboard/locations"
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              All locations
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <InfoCard
          label="Brand"
          value={location.brandName}
          icon={Building2}
        />

        <InfoCard
          label="Address"
          value={formatAddress(location)}
          icon={MapPin}
        />

        <InfoCard
          label="Coordinates"
          value={coordinateText}
          icon={Navigation}
        />
      </div>

      {location.brandStatus ===
      "archived" ? (
        <Card>
          <CardHeader
            title="Archived brand"
            subtitle="This location currently belongs to an archived brand."
          />

          <CardBody>
            <p className="text-sm leading-6 text-amber-700">
              Select a non-archived brand
              before saving changes to this
              location.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <LocationForm
        mode="edit"
        locationId={location.id}
        brands={brands}
        initialValues={{
          businessBrandId:
            location.businessBrandId,
          name: location.name,
          phone: location.phone ?? "",
          website:
            location.website ?? "",
          addressLine1:
            location.addressLine1,
          addressLine2:
            location.addressLine2 ??
            "",
          city: location.city,
          region:
            location.region ?? "",
          postalCode:
            location.postalCode ?? "",
          country: location.country,
          timezone:
            location.timezone,
          latitude:
            location.latitude !== null
              ? String(
                  location.latitude,
                )
              : "",
          longitude:
            location.longitude !== null
              ? String(
                  location.longitude,
                )
              : "",
          isPrimary:
            location.isPrimary,
          status:
            location.status as LocationStatusValue,
        }}
      />
    </div>
  );
}