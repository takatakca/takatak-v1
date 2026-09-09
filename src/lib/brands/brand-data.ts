import { getPrisma } from "@/lib/db/prisma";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";

export interface BrandListItem {
  id: string;
  name: string;
  legalName: string | null;
  category: string | null;
  website: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  country: string;
  timezone: string;
  status: string;
  locationCount: number;
  socialAccountCount: number;
  serviceCount: number;
  createdAt: string;
}

export interface BrandDetail {
  id: string;
  clientId: string;
  name: string;
  legalName: string | null;
  category: string | null;
  website: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string;
  timezone: string;
  status: string;
  locationCount: number;
  socialAccountCount: number;
  serviceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BrandOption {
  id: string;
  name: string;
  status: string;
}

export type BrandDirectoryData =
  | {
      source: "database";
      workspaceName: string;
      brands: BrandListItem[];
    }
  | {
      source: "unavailable";
      message: string;
      workspaceName: null;
      brands: [];
    };

export type BrandDetailData =
  | {
      source: "database";
      workspaceName: string;
      brand: BrandDetail;
    }
  | {
      source: "not_found";
      brand: null;
    }
  | {
      source: "unavailable";
      message: string;
      brand: null;
    };

export async function getBrandDirectoryData(
  access: ClientScopedAccess,
): Promise<BrandDirectoryData> {
  const prisma = getPrisma();

  if (!prisma) {
    return {
      source: "unavailable",
      message:
        "The brand database is unavailable.",
      workspaceName: null,
      brands: [],
    };
  }

  try {
    const [workspace, brands] =
      await Promise.all([
        prisma.client.findUnique({
          where: {
            id: access.activeClientId,
          },
          select: {
            name: true,
          },
        }),

        prisma.businessBrand.findMany({
          where: {
            clientId: access.activeClientId,
          },
          orderBy: [
            {
              status: "asc",
            },
            {
              name: "asc",
            },
          ],
          select: {
            id: true,
            name: true,
            legalName: true,
            category: true,
            website: true,
            phone: true,
            city: true,
            region: true,
            country: true,
            timezone: true,
            status: true,
            createdAt: true,
            _count: {
              select: {
                businessLocations: true,
                socialAccounts: true,
                serviceInstances: true,
              },
            },
          },
        }),
      ]);

    if (!workspace) {
      return {
        source: "unavailable",
        message:
          "The selected workspace could not be found.",
        workspaceName: null,
        brands: [],
      };
    }

    return {
      source: "database",
      workspaceName: workspace.name,
      brands: brands.map((brand) => ({
        id: brand.id,
        name: brand.name,
        legalName: brand.legalName,
        category: brand.category,
        website: brand.website,
        phone: brand.phone,
        city: brand.city,
        region: brand.region,
        country: brand.country,
        timezone: brand.timezone,
        status: brand.status,
        locationCount:
          brand._count.businessLocations,
        socialAccountCount:
          brand._count.socialAccounts,
        serviceCount:
          brand._count.serviceInstances,
        createdAt:
          brand.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error(
      "[brand-data] Brand directory query failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return {
      source: "unavailable",
      message:
        "Brand data is temporarily unavailable.",
      workspaceName: null,
      brands: [],
    };
  }
}

export async function getBrandDetailData(
  access: ClientScopedAccess,
  brandId: string,
): Promise<BrandDetailData> {
  const prisma = getPrisma();

  if (!prisma) {
    return {
      source: "unavailable",
      message:
        "The brand database is unavailable.",
      brand: null,
    };
  }

  try {
    const brand =
      await prisma.businessBrand.findFirst({
        where: {
          id: brandId,
          clientId: access.activeClientId,
        },
        select: {
          id: true,
          clientId: true,
          name: true,
          legalName: true,
          category: true,
          website: true,
          phone: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          region: true,
          postalCode: true,
          country: true,
          timezone: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          client: {
            select: {
              name: true,
            },
          },
          _count: {
            select: {
              businessLocations: true,
              socialAccounts: true,
              serviceInstances: true,
            },
          },
        },
      });

    if (!brand) {
      return {
        source: "not_found",
        brand: null,
      };
    }

    return {
      source: "database",
      workspaceName: brand.client.name,
      brand: {
        id: brand.id,
        clientId: brand.clientId,
        name: brand.name,
        legalName: brand.legalName,
        category: brand.category,
        website: brand.website,
        phone: brand.phone,
        addressLine1:
          brand.addressLine1,
        addressLine2:
          brand.addressLine2,
        city: brand.city,
        region: brand.region,
        postalCode: brand.postalCode,
        country: brand.country,
        timezone: brand.timezone,
        status: brand.status,
        locationCount:
          brand._count.businessLocations,
        socialAccountCount:
          brand._count.socialAccounts,
        serviceCount:
          brand._count.serviceInstances,
        createdAt:
          brand.createdAt.toISOString(),
        updatedAt:
          brand.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    console.error(
      "[brand-data] Brand detail query failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return {
      source: "unavailable",
      message:
        "Brand data is temporarily unavailable.",
      brand: null,
    };
  }
}

export async function getBrandOptions(
  access: ClientScopedAccess,
): Promise<BrandOption[]> {
  const prisma = getPrisma();

  if (!prisma) {
    return [];
  }

  try {
    return await prisma.businessBrand.findMany({
      where: {
        clientId: access.activeClientId,
        status: {
          notIn: ["archived", "frozen"],
        },
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });
  } catch (error) {
    console.error(
      "[brand-data] Brand options query failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return [];
  }
}