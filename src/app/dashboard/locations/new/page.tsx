import Link from "next/link";

import { LocationForm } from "@/components/locations/location-form";
import { ModuleHeader } from "@/components/saas/module-header";
import {
  Card,
  CardBody,
  CardHeader,
} from "@/components/ui/card";
import { getBrandOptions } from "@/lib/brands/brand-data";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
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

      resolveBrandSessionContextFromRequest(
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
          title="Créer un emplacement · Create location"
          description="Un emplacement appartient toujours à une marque de votre espace · A location must belong to a brand in your workspace."
        />

        <Card>
          <CardHeader
            title="Créez d’abord une marque · Create a brand first"
            subtitle="Aucune marque n’a été trouvée dans cet espace · No available brands were found in this workspace."
          />

          <CardBody>
            <p className="text-sm leading-6 text-slate-600">
              Créez au moins une marque (active, en brouillon ou en pause) avant d’ajouter une adresse physique · Create at least one brand
              before adding a physical location.
            </p>

            <Link
              href="/dashboard/brands/new"
              className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              Créer une marque · Create brand
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Créer un emplacement · Create location"
        description="Ajoutez une adresse physique de votre entreprise pour les fiches locales, les comptes sociaux, la planification et les rapports · Add a physical location for listings, social, scheduling and reports."
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