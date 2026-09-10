import {
  Building2,
  Plus,
} from "lucide-react";

import { BrandList } from "@/components/brands/brand-list";
import { BrandSwitcher } from "@/components/brands/brand-switcher";
import { EmptyState } from "@/components/saas/empty-state";
import { ModuleHeader } from "@/components/saas/module-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardHeader,
} from "@/components/ui/card";
import { getBrandDirectoryData } from "@/lib/brands/brand-data";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic =
  "force-dynamic";

export default async function BrandsPage() {
  const access =
    await requireWorkspacePermission(
      "manage_brands",
      "/dashboard/brands",
    );

  const [data, brandContext] =
    await Promise.all([
      getBrandDirectoryData(access),

      resolveBrandSessionContextFromRequest(
        access,
      ),
    ]);

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Businesses / Brands"
        description={
          data.source === "database"
            ? `Manage real brands inside ${data.workspaceName}. Every social account, post, campaign, location, and report will remain attached to one of these brands.`
            : "Manage workspace-owned brands and their future social-media resources."
        }
        actions={
          <Button href="/dashboard/brands/new">
            <Plus className="h-4 w-4" />
            Add brand
          </Button>
        }
      />

      {brandContext.availableBrands
        .length > 0 ? (
        <Card>
          <CardHeader
            title="Brand context"
            subtitle="Choose which brand future social-media, analytics, and reporting screens should focus on."
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

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Selecting “All brands” keeps
              workspace-wide views active.
              Archived brands cannot be
              selected.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {data.source ===
      "unavailable" ? (
        <Card>
          <CardBody>
            <p className="text-sm font-medium text-slate-900">
              Brand data unavailable
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {data.message}
            </p>
          </CardBody>
        </Card>
      ) : data.brands.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No brands in this workspace"
          description="Create the first brand before connecting social accounts or adding physical locations."
        />
      ) : (
        <BrandList
          brands={data.brands}
          activeBrandId={
            brandContext.activeBrandId
          }
        />
      )}
    </div>
  );
}