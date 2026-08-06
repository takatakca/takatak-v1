import Link from "next/link";
import { ExternalLink } from "lucide-react";

import {
  DataTable,
  type Column,
} from "@/components/saas/data-table";
import { StatusBadge } from "@/components/saas/status-badge";
import type { BrandListItem } from "@/lib/brands/brand-data";

export function BrandList({
  brands,
  activeBrandId,
}: {
  brands: BrandListItem[];
  activeBrandId: string | null;
}) {
  const columns: Column<BrandListItem>[] =
    [
      {
        key: "brand",
        header: "Brand",

        render: (brand) => (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/dashboard/brands/${brand.id}`}
                className="font-medium text-slate-900 hover:text-indigo-600"
              >
                {brand.name}
              </Link>

              {brand.id ===
              activeBrandId ? (
                <StatusBadge status="primary" />
              ) : null}
            </div>

            <p className="mt-0.5 text-xs text-slate-400">
              {brand.category ??
                "Uncategorized"}

              {brand.city
                ? ` · ${brand.city}`
                : ""}
            </p>
          </div>
        ),
      },

      {
        key: "status",
        header: "Status",

        render: (brand) => (
          <StatusBadge
            status={brand.status}
          />
        ),
      },

      {
        key: "locations",
        header: "Locations",

        render: (brand) =>
          brand.locationCount,
      },

      {
        key: "social",
        header: "Social accounts",

        render: (brand) =>
          brand.socialAccountCount,
      },

      {
        key: "services",
        header: "Services",

        render: (brand) =>
          brand.serviceCount,
      },

      {
        key: "timezone",
        header: "Timezone",

        render: (brand) => (
          <span className="text-xs text-slate-500">
            {brand.timezone}
          </span>
        ),
      },

      {
        key: "open",
        header: "",

        render: (brand) => (
          <Link
            href={`/dashboard/brands/${brand.id}`}
            aria-label={`Open ${brand.name}`}
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
      rows={brands}
      rowKey={(brand) => brand.id}
      caption="Workspace brands"
    />
  );
}