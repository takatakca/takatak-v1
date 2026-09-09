import type {
    Prisma,
    BusinessLocation,
  } from "@prisma/client";
  
  import type { LocationInput } from "@/lib/locations/location-validation";
  import { isPrismaKnownRequestError } from "@/lib/db/prisma-errors";
  import { getPrisma } from "@/lib/db/prisma";
  import { ServiceError } from "@/lib/services/service-error";
  
  type Transaction =
    Prisma.TransactionClient;
  
  function handleLocationWriteError(
    error: unknown,
  ): never {
    if (isPrismaKnownRequestError(error)) {
      if (error.code === "P2002") {
        throw new ServiceError(
          "conflict",
          "A location with this name already exists for the selected brand.",
          {
            fieldErrors: {
              name:
                "Location names must be unique inside one brand.",
            },
          },
        );
      }
  
      if (error.code === "P2034") {
        throw new ServiceError(
          "conflict",
          "Another location change happened at the same time. Try saving again.",
        );
      }
    }
  
    throw error;
  }
  
  async function ensurePrimaryLocation(
    transaction: Transaction,
    clientId: string,
    businessBrandId: string,
    excludedLocationId?: string,
  ): Promise<void> {
    const existingPrimary =
      await transaction.businessLocation.findFirst({
        where: {
          clientId,
          businessBrandId,
          isPrimary: true,
  
          status: {
            not: "archived",
          },
        },
  
        select: {
          id: true,
        },
      });
  
    if (existingPrimary) {
      return;
    }
  
    const replacement =
      await transaction.businessLocation.findFirst({
        where: {
          clientId,
          businessBrandId,
  
          status: {
            not: "archived",
          },
  
          ...(excludedLocationId
            ? {
                id: {
                  not: excludedLocationId,
                },
              }
            : {}),
        },
  
        orderBy: {
          createdAt: "asc",
        },
  
        select: {
          id: true,
        },
      });
  
    const fallback =
      replacement ??
      (await transaction.businessLocation.findFirst({
        where: {
          clientId,
          businessBrandId,
  
          status: {
            not: "archived",
          },
        },
  
        orderBy: {
          createdAt: "asc",
        },
  
        select: {
          id: true,
        },
      }));
  
    if (!fallback) {
      return;
    }
  
    await transaction.businessLocation.update({
      where: {
        id: fallback.id,
      },
  
      data: {
        isPrimary: true,
      },
    });
  }
  
  async function findAvailableBrand(
    clientId: string,
    businessBrandId: string,
  ) {
    const prisma = getPrisma();
  
    if (!prisma) {
      throw new ServiceError(
        "unavailable",
        "The location service is unavailable.",
      );
    }
  
    return prisma.businessBrand.findFirst({
      where: {
        id: businessBrandId,
        clientId,
  
        status: {
          notIn: ["archived", "frozen"],
        },
      },
  
      select: {
        id: true,
        name: true,
        status: true,
      },
    });
  }
  
  export async function createLocation(
    clientId: string,
    actorProfileId: string,
    input: LocationInput,
  ): Promise<
    Pick<
      BusinessLocation,
      "id" | "name" | "status" | "isPrimary"
    >
  > {
    const prisma = getPrisma();
  
    if (!prisma) {
      throw new ServiceError(
        "unavailable",
        "The location service is unavailable.",
      );
    }
  
    const [brand, duplicate] =
      await Promise.all([
        findAvailableBrand(
          clientId,
          input.businessBrandId,
        ),
  
        prisma.businessLocation.findFirst({
          where: {
            clientId,
            businessBrandId:
              input.businessBrandId,
  
            name: {
              equals: input.name,
              mode: "insensitive",
            },
          },
  
          select: {
            id: true,
          },
        }),
      ]);
  
    if (!brand) {
      throw new ServiceError(
        "invalid_input",
        "Select an available brand from this workspace.",
        {
          fieldErrors: {
            businessBrandId:
              "The selected brand does not belong to this workspace or is archived.",
          },
        },
      );
    }
  
    if (duplicate) {
      throw new ServiceError(
        "conflict",
        "A location with this name already exists for the selected brand.",
        {
          fieldErrors: {
            name:
              "Location names must be unique inside one brand.",
          },
        },
      );
    }
  
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const existingPrimary =
            await transaction.businessLocation.findFirst(
              {
                where: {
                  clientId,
                  businessBrandId:
                    input.businessBrandId,
                  isPrimary: true,
  
                  status: {
                    not: "archived",
                  },
                },
  
                select: {
                  id: true,
                },
              },
            );
  
          const shouldBePrimary =
            input.status !== "archived" &&
            (input.isPrimary ||
              !existingPrimary);
  
          if (shouldBePrimary) {
            await transaction.businessLocation.updateMany(
              {
                where: {
                  clientId,
                  businessBrandId:
                    input.businessBrandId,
                  isPrimary: true,
                },
  
                data: {
                  isPrimary: false,
                },
              },
            );
          }
  
          const location =
            await transaction.businessLocation.create({
              data: {
                clientId,
                businessBrandId:
                  input.businessBrandId,
                name: input.name,
                phone: input.phone,
                website: input.website,
                addressLine1:
                  input.addressLine1,
                addressLine2:
                  input.addressLine2,
                city: input.city,
                region: input.region,
                postalCode:
                  input.postalCode,
                country: input.country,
                timezone: input.timezone,
                latitude: input.latitude,
                longitude: input.longitude,
                isPrimary: shouldBePrimary,
                status: input.status,
              },
  
              select: {
                id: true,
                name: true,
                status: true,
                isPrimary: true,
              },
            });
  
          await transaction.auditLog.create({
            data: {
              profileId: actorProfileId,
              clientId,
              action:
                "business_location_created",
              entityType:
                "BusinessLocation",
              entityId: location.id,
  
              metadata: {
                note: `${location.name} was created for ${brand.name}.`,
                businessBrandId:
                  input.businessBrandId,
                primary:
                  location.isPrimary,
              },
            },
          });
  
          return location;
        },
        {
          isolationLevel: "Serializable",
        },
      );
    } catch (error) {
      return handleLocationWriteError(error);
    }
  }
  
  export async function updateLocation(
    clientId: string,
    locationId: string,
    actorProfileId: string,
    input: LocationInput,
  ): Promise<
    Pick<
      BusinessLocation,
      "id" | "name" | "status" | "isPrimary"
    >
  > {
    const prisma = getPrisma();
  
    if (!prisma) {
      throw new ServiceError(
        "unavailable",
        "The location service is unavailable.",
      );
    }
  
    const [current, targetBrand, duplicate] =
      await Promise.all([
        prisma.businessLocation.findFirst({
          where: {
            id: locationId,
            clientId,
          },
  
          select: {
            id: true,
            businessBrandId: true,
            name: true,
            status: true,
            isPrimary: true,
          },
        }),
  
        findAvailableBrand(
          clientId,
          input.businessBrandId,
        ),
  
        prisma.businessLocation.findFirst({
          where: {
            id: {
              not: locationId,
            },
  
            clientId,
            businessBrandId:
              input.businessBrandId,
  
            name: {
              equals: input.name,
              mode: "insensitive",
            },
          },
  
          select: {
            id: true,
          },
        }),
      ]);
  
    if (!current) {
      throw new ServiceError(
        "not_found",
        "The selected location could not be found.",
      );
    }
  
    if (!targetBrand) {
      throw new ServiceError(
        "invalid_input",
        "Select an available brand from this workspace.",
        {
          fieldErrors: {
            businessBrandId:
              "The selected brand does not belong to this workspace or is archived.",
          },
        },
      );
    }
  
    if (duplicate) {
      throw new ServiceError(
        "conflict",
        "A location with this name already exists for the selected brand.",
        {
          fieldErrors: {
            name:
              "Location names must be unique inside one brand.",
          },
        },
      );
    }
  
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const requestedPrimary =
            input.status !== "archived" &&
            input.isPrimary;
  
          if (requestedPrimary) {
            await transaction.businessLocation.updateMany(
              {
                where: {
                  clientId,
                  businessBrandId:
                    input.businessBrandId,
  
                  id: {
                    not: locationId,
                  },
  
                  isPrimary: true,
                },
  
                data: {
                  isPrimary: false,
                },
              },
            );
          }
  
          await transaction.businessLocation.update({
              where: {
                id: locationId,
              },
  
              data: {
                businessBrandId:
                  input.businessBrandId,
                name: input.name,
                phone: input.phone,
                website: input.website,
                addressLine1:
                  input.addressLine1,
                addressLine2:
                  input.addressLine2,
                city: input.city,
                region: input.region,
                postalCode:
                  input.postalCode,
                country: input.country,
                timezone: input.timezone,
                latitude: input.latitude,
                longitude: input.longitude,
                isPrimary: requestedPrimary,
                status: input.status,
              },
  
              select: {
                id: true,
                name: true,
                status: true,
                isPrimary: true,
              },
            });
  
          if (
            current.businessBrandId !==
            input.businessBrandId
          ) {
            await ensurePrimaryLocation(
              transaction,
              clientId,
              current.businessBrandId,
            );
          }
  
          await ensurePrimaryLocation(
            transaction,
            clientId,
            input.businessBrandId,
            requestedPrimary
              ? undefined
              : locationId,
          );
  
          const finalLocation =
            await transaction.businessLocation.findUniqueOrThrow(
              {
                where: {
                  id: locationId,
                },
  
                select: {
                  id: true,
                  name: true,
                  status: true,
                  isPrimary: true,
                },
              },
            );
  
          await transaction.auditLog.create({
            data: {
              profileId: actorProfileId,
              clientId,
              action:
                "business_location_updated",
              entityType:
                "BusinessLocation",
              entityId: locationId,
  
              metadata: {
                note: `${finalLocation.name} was updated.`,
                previousBrandId:
                  current.businessBrandId,
                newBrandId:
                  input.businessBrandId,
                previousStatus:
                  current.status,
                newStatus:
                  finalLocation.status,
                primary:
                  finalLocation.isPrimary,
              },
            },
          });
  
          return finalLocation;
        },
        {
          isolationLevel: "Serializable",
        },
      );
    } catch (error) {
      return handleLocationWriteError(error);
    }
  }