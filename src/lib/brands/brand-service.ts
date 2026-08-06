import { Prisma } from "@prisma/client";

import type { BrandInput } from "@/lib/brands/brand-validation";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

function handleBrandWriteError(
  error: unknown,
): never {
  if (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ServiceError(
      "conflict",
      "A brand with this name already exists in the workspace.",
      {
        fieldErrors: {
          name:
            "Brand names must be unique inside one workspace.",
        },
      },
    );
  }

  throw error;
}

export async function createBrand(
  clientId: string,
  actorProfileId: string,
  input: BrandInput,
) {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The brand service is unavailable.",
    );
  }

  const [client, duplicate] =
    await Promise.all([
      prisma.client.findUnique({
        where: {
          id: clientId,
        },
        select: {
          id: true,
          status: true,
        },
      }),

      prisma.businessBrand.findFirst({
        where: {
          clientId,
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

  if (!client) {
    throw new ServiceError(
      "not_found",
      "The selected workspace could not be found.",
    );
  }

  if (
    client.status === "paused" ||
    client.status === "archived"
  ) {
    throw new ServiceError(
      "forbidden",
      "Brands cannot be created in a paused or archived workspace.",
    );
  }

  if (duplicate) {
    throw new ServiceError(
      "conflict",
      "A brand with this name already exists in the workspace.",
      {
        fieldErrors: {
          name:
            "Brand names must be unique inside one workspace.",
        },
      },
    );
  }

  try {
    return await prisma.$transaction(
      async (transaction) => {
        const brand =
          await transaction.businessBrand.create({
            data: {
              clientId,
              name: input.name,
              legalName: input.legalName,
              category: input.category,
              website: input.website,
              phone: input.phone,
              addressLine1:
                input.addressLine1,
              addressLine2:
                input.addressLine2,
              city: input.city,
              region: input.region,
              postalCode: input.postalCode,
              country: input.country,
              timezone: input.timezone,
              status: input.status,
            },
            select: {
              id: true,
              name: true,
              status: true,
            },
          });

        await transaction.auditLog.create({
          data: {
            profileId: actorProfileId,
            clientId,
            action:
              "business_brand_created",
            entityType: "BusinessBrand",
            entityId: brand.id,
            metadata: {
              note: `${brand.name} was created.`,
            },
          },
        });

        return brand;
      },
    );
  } catch (error) {
    return handleBrandWriteError(error);
  }
}

export async function updateBrand(
  clientId: string,
  brandId: string,
  actorProfileId: string,
  input: BrandInput,
) {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The brand service is unavailable.",
    );
  }

  const [client, current, duplicate] =
    await Promise.all([
      prisma.client.findUnique({
        where: {
          id: clientId,
        },
        select: {
          id: true,
          status: true,
        },
      }),

      prisma.businessBrand.findFirst({
        where: {
          id: brandId,
          clientId,
        },
        select: {
          id: true,
          name: true,
          status: true,
        },
      }),

      prisma.businessBrand.findFirst({
        where: {
          id: {
            not: brandId,
          },
          clientId,
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

  if (!client) {
    throw new ServiceError(
      "not_found",
      "The selected workspace could not be found.",
    );
  }

  if (
    client.status === "paused" ||
    client.status === "archived"
  ) {
    throw new ServiceError(
      "forbidden",
      "Brands cannot be changed in a paused or archived workspace.",
    );
  }

  if (!current) {
    throw new ServiceError(
      "not_found",
      "The selected brand could not be found.",
    );
  }

  if (duplicate) {
    throw new ServiceError(
      "conflict",
      "A brand with this name already exists in the workspace.",
      {
        fieldErrors: {
          name:
            "Brand names must be unique inside one workspace.",
        },
      },
    );
  }

  try {
    return await prisma.$transaction(
      async (transaction) => {
        const brand =
          await transaction.businessBrand.update({
            where: {
              id: brandId,
            },
            data: {
              name: input.name,
              legalName: input.legalName,
              category: input.category,
              website: input.website,
              phone: input.phone,
              addressLine1:
                input.addressLine1,
              addressLine2:
                input.addressLine2,
              city: input.city,
              region: input.region,
              postalCode: input.postalCode,
              country: input.country,
              timezone: input.timezone,
              status: input.status,
            },
            select: {
              id: true,
              name: true,
              status: true,
            },
          });

        if (brand.status === "archived") {
          await transaction.businessLocation.updateMany(
            {
              where: {
                clientId,
                businessBrandId: brandId,
                isPrimary: true,
              },
              data: {
                isPrimary: false,
              },
            },
          );
        }

        await transaction.auditLog.create({
          data: {
            profileId: actorProfileId,
            clientId,
            action:
              "business_brand_updated",
            entityType: "BusinessBrand",
            entityId: brandId,
            metadata: {
              note: `${brand.name} was updated.`,
              previousName: current.name,
              previousStatus:
                current.status,
              newStatus: brand.status,
            },
          },
        });

        return brand;
      },
    );
  } catch (error) {
    return handleBrandWriteError(error);
  }
}