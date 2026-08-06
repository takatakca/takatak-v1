import Link from "next/link";
import {
  ExternalLink,
  MapPin,
} from "lucide-react";

import {
  DataTable,
  type Column,
} from "@/components/saas/data-table";
import { StatusBadge } from "@/components/saas/status-badge";
import type { LocationListItem } from "@/lib/locations/location-data";

function formatAddress(
  location: LocationListItem,
): string {
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

export function LocationList({
  locations,
}: {
  locations: LocationListItem[];
}) {
  const columns: Column<LocationListItem>[] =
    [
      {
        key: "location",
        header: "Location",

        render: (location) => (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/dashboard/locations/${location.id}`}
                className="font-medium text-slate-900 hover:text-indigo-600"
              >
                {location.name}
              </Link>

              {location.isPrimary ? (
                <StatusBadge status="primary" />
              ) : null}
            </div>

            <p className="mt-1 max-w-md text-xs leading-5 text-slate-400">
              {formatAddress(location)}
            </p>
          </div>
        ),
      },

      {
        key: "brand",
        header: "Brand",

        render: (location) => (
          <Link
            href={`/dashboard/brands/${location.businessBrandId}`}
            className="text-xs font-medium text-slate-600 hover:text-indigo-600"
          >
            {location.brandName}
          </Link>
        ),
      },

      {
        key: "status",
        header: "Status",

        render: (location) => (
          <StatusBadge
            status={location.status}
          />
        ),
      },

      {
        key: "city",
        header: "City",

        render: (location) => (
          <span className="text-xs text-slate-600">
            {location.city}
            {location.region
              ? `, ${location.region}`
              : ""}
          </span>
        ),
      },

      {
        key: "phone",
        header: "Phone",

        render: (location) => (
          <span className="text-xs text-slate-500">
            {location.phone ??
              "Not provided"}
          </span>
        ),
      },

      {
        key: "timezone",
        header: "Timezone",

        render: (location) => (
          <span className="text-xs text-slate-500">
            {location.timezone}
          </span>
        ),
      },

      {
        key: "open",
        header: "",

        render: (location) => (
          <Link
            href={`/dashboard/locations/${location.id}`}
            aria-label={`Open ${location.name}`}
            className="inline-flex rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        ),
      },
    ];

  return (
    <DataTable
      columns={columns}
      rows={locations}
      rowKey={(location) =>
        location.id
      }
      caption="Workspace business locations"
    />
  );
}

export function LocationAddressIcon() {
  return <MapPin className="h-5 w-5" />;
}