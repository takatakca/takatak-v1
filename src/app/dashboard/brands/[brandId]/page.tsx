import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BarChart3,
  MapPin,
  Share2,
} from "lucide-react";

import { setActiveBrand } from "@/app/dashboard/brand-actions";
import { BrandForm } from "@/components/brands/brand-form";
import { ModuleHeader } from "@/components/saas/module-header";
import {
  Card,
  CardBody,
} from "@/components/ui/card";
import { getBrandDetailData } from "@/lib/brands/brand-data";
import type { BrandStatusValue } from "@/lib/brands/brand-validation";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
import { isUuid } from "@/lib/validation/common";

export const dynamic =
  "force-dynamic";

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof MapPin;
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <Icon className="h-5 w-5" />
        </span>

        <div>
          <p className="text-2xl font-semibold text-slate-900">
            {value}
          </p>

          <p className="text-xs text-slate-500">
            {label}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{
    brandId: string;
  }>;
}) {
  const access =
    await requireWorkspacePermission(
      "manage_brands",
      "/dashboard/brands",
    );

  const { brandId } =
    await params;

  if (!isUuid(brandId)) {
    notFound();
  }

  const [data, brandContext] =
    await Promise.all([
      getBrandDetailData(
        access,
        brandId,
      ),

      resolveBrandSessionContextFromRequest(
        access,
      ),
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
          title="Brand"
          description="Brand details could not be loaded."
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

  const { brand } = data;

  const isActiveBrand =
    brandContext.activeBrandId ===
    brand.id;

  return (
    <div className="space-y-5">
      <ModuleHeader
        title={brand.name}
        description={`Workspace: ${data.workspaceName}. Brand IDs are rechecked against the active workspace before every read and write.`}
        statuses={[
          brand.status,
          ...(isActiveBrand
            ? ["primary"]
            : []),
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            {!isActiveBrand &&
            brand.status !==
              "archived" ? (
              <form
                action={setActiveBrand}
              >
                <input
                  type="hidden"
                  name="brandId"
                  value={brand.id}
                />

                <input
                  type="hidden"
                  name="next"
                  value={`/dashboard/brands/${brand.id}`}
                />

                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                >
                  Set active brand
                </button>
              </form>
            ) : null}

            <Link
              href="/dashboard/brands"
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              All brands
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Locations"
          value={
            brand.locationCount
          }
          icon={MapPin}
        />

        <Stat
          label="Social accounts"
          value={
            brand.socialAccountCount
          }
          icon={Share2}
        />

        <Stat
          label="Services"
          value={
            brand.serviceCount
          }
          icon={BarChart3}
        />
      </div>

      <BrandForm
        mode="edit"
        brandId={brand.id}
        initialValues={{
          name: brand.name,
          legalName:
            brand.legalName ?? "",
          category:
            brand.category ?? "",
          website:
            brand.website ?? "",
          phone: brand.phone ?? "",
          addressLine1:
            brand.addressLine1 ?? "",
          addressLine2:
            brand.addressLine2 ?? "",
          city: brand.city ?? "",
          region:
            brand.region ?? "",
          postalCode:
            brand.postalCode ?? "",
          country: brand.country,
          timezone: brand.timezone,
          status:
            brand.status as BrandStatusValue,
        }}
      />
    </div>
  );
}