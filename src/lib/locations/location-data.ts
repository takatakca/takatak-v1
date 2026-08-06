import { getPrisma } from "@/lib/db/prisma";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";

export interface LocationListItem {
  id: string;
  businessBrandId: string;
  brandName: string;
  brandStatus: string;
  name: string;
  phone: string | null;
  website: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  isPrimary: boolean;
  status: string;
  createdAt: string;
}

export interface LocationDetail
  extends LocationListItem {
  clientId: string;
  updatedAt: string;
}

export type LocationDirectoryData =
  | {
      source: "database";
      workspaceName: string;
      locations: LocationListItem[];
    }
  | {
      source: "unavailable";
      message: string;
      workspaceName: null;
      locations: [];
    };

export type LocationDetailData =
  | {
      source: "database";
      workspaceName: string;
      location: LocationDetail;
    }
  | {
      source: "not_found";
      location: null;
    }
  | {
      source: "unavailable";
      message: string;
      location: null;
    };

export async function getLocationDirectoryData(
  access: ClientScopedAccess,
  activeBrandId: string | null,
): Promise<LocationDirectoryData> {
  const prisma = getPrisma();

  if (!prisma) {
    return {
      source: "unavailable",
      message:
        "The location database is unavailable.",
      workspaceName: null,
      locations: [],
    };
  }

  try {
    const [workspace, locations] =
      await Promise.all([
        prisma.client.findUnique({
          where: {
            id: access.activeClientId,
          },
          select: {
            name: true,
          },
        }),

        prisma.businessLocation.findMany({
          where: {
            clientId: access.activeClientId,

            ...(activeBrandId
              ? {
                  businessBrandId:
                    activeBrandId,
                }
              : {}),
          },

          orderBy: [
            {
              isPrimary: "desc",
            },
            {
              status: "asc",
            },
            {
              name: "asc",
            },
          ],

          select: {
            id: true,
            businessBrandId: true,
            name: true,
            phone: true,
            website: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            region: true,
            postalCode: true,
            country: true,
            timezone: true,
            latitude: true,
            longitude: true,
            isPrimary: true,
            status: true,
            createdAt: true,

            businessBrand: {
              select: {
                name: true,
                status: true,
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
        locations: [],
      };
    }

    return {
      source: "database",
      workspaceName: workspace.name,

      locations: locations.map(
        (location) => ({
          id: location.id,
          businessBrandId:
            location.businessBrandId,
          brandName:
            location.businessBrand.name,
          brandStatus:
            location.businessBrand.status,
          name: location.name,
          phone: location.phone,
          website: location.website,
          addressLine1:
            location.addressLine1,
          addressLine2:
            location.addressLine2,
          city: location.city,
          region: location.region,
          postalCode:
            location.postalCode,
          country: location.country,
          timezone: location.timezone,
          latitude: location.latitude,
          longitude: location.longitude,
          isPrimary: location.isPrimary,
          status: location.status,
          createdAt:
            location.createdAt.toISOString(),
        }),
      ),
    };
  } catch (error) {
    console.error(
      "[location-data] Location directory query failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return {
      source: "unavailable",
      message:
        "Location data is temporarily unavailable.",
      workspaceName: null,
      locations: [],
    };
  }
}

export async function getLocationDetailData(
    access: ClientScopedAccess,
    locationId: string,
  ): Promise<LocationDetailData> {
    const prisma = getPrisma();
  
    if (!prisma) {
      return {
        source: "unavailable",
        message:
          "The location database is unavailable.",
        location: null,
      };
    }
  
    try {
      const [workspace, location] =
        await Promise.all([
          prisma.client.findUnique({
            where: {
              id: access.activeClientId,
            },
            select: {
              name: true,
            },
          }),
  
          prisma.businessLocation.findFirst({
            where: {
              id: locationId,
              clientId: access.activeClientId,
            },
  
            select: {
              id: true,
              clientId: true,
              businessBrandId: true,
              name: true,
              phone: true,
              website: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              region: true,
              postalCode: true,
              country: true,
              timezone: true,
              latitude: true,
              longitude: true,
              isPrimary: true,
              status: true,
              createdAt: true,
              updatedAt: true,
  
              businessBrand: {
                select: {
                  name: true,
                  status: true,
                },
              },
            },
          }),
        ]);
  
      if (!location || !workspace) {
        return {
          source: "not_found",
          location: null,
        };
      }
  
      return {
        source: "database",
        workspaceName: workspace.name,
  
        location: {
          id: location.id,
          clientId: location.clientId,
          businessBrandId:
            location.businessBrandId,
          brandName:
            location.businessBrand.name,
          brandStatus:
            location.businessBrand.status,
          name: location.name,
          phone: location.phone,
          website: location.website,
          addressLine1:
            location.addressLine1,
          addressLine2:
            location.addressLine2,
          city: location.city,
          region: location.region,
          postalCode:
            location.postalCode,
          country: location.country,
          timezone: location.timezone,
          latitude: location.latitude,
          longitude: location.longitude,
          isPrimary: location.isPrimary,
          status: location.status,
          createdAt:
            location.createdAt.toISOString(),
          updatedAt:
            location.updatedAt.toISOString(),
        },
      };
    } catch (error) {
      console.error(
        "[location-data] Location detail query failed:",
        error instanceof Error
          ? error.message
          : "Unknown error",
      );
  
      return {
        source: "unavailable",
        message:
          "Location data is temporarily unavailable.",
        location: null,
      };
    }
  }