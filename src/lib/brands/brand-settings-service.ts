import type { BrandSettingsInput } from "@/lib/brands/brand-settings-validation";
import { isPrismaKnownRequestError } from "@/lib/db/prisma-errors";
import { getPrisma } from "@/lib/db/prisma";
import { invalidateBrandSelectorCache } from "@/lib/security/brand-context";
import { ServiceError } from "@/lib/services/service-error";

function handleBrandSettingsWriteError(error: unknown): never {
  if (isPrismaKnownRequestError(error) && error.code === "P2002") {
    throw new ServiceError(
      "conflict",
      "A brand with this name already exists in the workspace.",
      {
        fieldErrors: {
          name: "Brand names must be unique inside one workspace.",
        },
      },
    );
  }

  throw error;
}

export async function updateBrandSettings(
  clientId: string,
  brandId: string,
  actorProfileId: string,
  input: BrandSettingsInput,
) {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The brand service is unavailable.",
    );
  }

  const [client, current, duplicate, imageAccount] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, status: true },
    }),
    prisma.businessBrand.findFirst({
      where: { id: brandId, clientId },
      select: {
        id: true,
        name: true,
        status: true,
      },
    }),
    prisma.businessBrand.findFirst({
      where: {
        id: { not: brandId },
        clientId,
        name: { equals: input.name, mode: "insensitive" },
      },
      select: { id: true },
    }),
    input.imageSocialAccountId
      ? prisma.socialAccount.findFirst({
          where: {
            id: input.imageSocialAccountId,
            clientId,
            businessBrandId: brandId,
            status: "connected",
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (!client) {
    throw new ServiceError(
      "not_found",
      "The selected workspace could not be found.",
    );
  }

  if (client.status === "paused" || client.status === "archived") {
    throw new ServiceError(
      "forbidden",
      "Brand settings cannot be changed in a paused or archived workspace.",
    );
  }

  if (!current) {
    throw new ServiceError(
      "not_found",
      "The selected brand could not be found.",
    );
  }

  if (current.status === "archived" || current.status === "frozen") {
    throw new ServiceError(
      "forbidden",
      current.status === "frozen"
        ? "This brand is frozen by the Social plan. Restore it from Plans and billing."
        : "Archived brands cannot be updated.",
    );
  }

  if (duplicate) {
    throw new ServiceError(
      "conflict",
      "A brand with this name already exists in the workspace.",
      {
        fieldErrors: {
          name: "Brand names must be unique inside one workspace.",
        },
      },
    );
  }

  if (input.imageSocialAccountId && !imageAccount) {
    throw new ServiceError(
      "invalid_input",
      "Choose an image from a connected account in this brand.",
      {
        fieldErrors: {
          imageSocialAccountId:
            "That image is not available for this brand.",
        },
      },
    );
  }

  try {
    const brand = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.businessBrand.update({
        where: { id: brandId },
        data: {
          name: input.name,
          imageSocialAccountId: input.imageSocialAccountId,
          engagementRatio: input.engagementRatio,
        },
        select: {
          id: true,
          name: true,
          engagementRatio: true,
          imageSocialAccountId: true,
        },
      });

      if (input.applyEngagementToAllBrands) {
        await transaction.businessBrand.updateMany({
          where: {
            clientId,
            status: { notIn: ["archived", "frozen"] },
          },
          data: {
            engagementRatio: input.engagementRatio,
          },
        });
      }

      await transaction.auditLog.create({
        data: {
          profileId: actorProfileId,
          clientId,
          action: "business_brand_settings_updated",
          entityType: "BusinessBrand",
          entityId: brandId,
          metadata: {
            note: `${updated.name} brand settings were updated.`,
            previousName: current.name,
            engagementRatio: updated.engagementRatio,
            appliedEngagementToAllBrands: input.applyEngagementToAllBrands,
          },
        },
      });

      return updated;
    });

    invalidateBrandSelectorCache(clientId);

    return brand;
  } catch (error) {
    return handleBrandSettingsWriteError(error);
  }
}
