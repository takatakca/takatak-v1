import {
  parseStoredInstructions,
  type BrandAiInstructionsInput,
} from "@/lib/brands/brand-ai-instructions";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

export async function upsertBrandAiInstructions(
  clientId: string,
  brandId: string,
  actorProfileId: string,
  input: BrandAiInstructionsInput,
) {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The brand service is unavailable.",
    );
  }

  const [client, brand, existingVoice] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, status: true },
    }),
    prisma.businessBrand.findFirst({
      where: { id: brandId, clientId },
      select: { id: true, name: true, status: true },
    }),
    prisma.brandVoice.findFirst({
      where: {
        clientId,
        businessBrandId: brandId,
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, instructions: true },
    }),
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
      "AI configuration cannot be changed in a paused or archived workspace.",
    );
  }

  if (!brand) {
    throw new ServiceError(
      "not_found",
      "The selected brand could not be found.",
    );
  }

  if (brand.status === "archived") {
    throw new ServiceError(
      "forbidden",
      "Archived brands cannot be updated.",
    );
  }

  const stored = parseStoredInstructions(existingVoice?.instructions);
  const instructions = {
    general: input.general,
    platforms: {
      ...stored.platforms,
      ...input.platforms,
    },
  };

  const notes = input.general.trim() ? input.general.trim() : null;

  const voice = await prisma.$transaction(async (transaction) => {
    const saved = existingVoice
      ? await transaction.brandVoice.update({
          where: { id: existingVoice.id },
          data: {
            instructions,
            notes,
          },
          select: { id: true, name: true },
        })
      : await transaction.brandVoice.create({
          data: {
            clientId,
            businessBrandId: brandId,
            name: `${brand.name} voice`,
            language: "en",
            instructions,
            notes,
          },
          select: { id: true, name: true },
        });

    await transaction.auditLog.create({
      data: {
        profileId: actorProfileId,
        clientId,
        action: existingVoice
          ? "brand_voice_instructions_updated"
          : "brand_voice_instructions_created",
        entityType: "BrandVoice",
        entityId: saved.id,
        metadata: {
          note: `AI instructions were saved for ${brand.name}.`,
          businessBrandId: brandId,
        },
      },
    });

    return saved;
  });

  return voice;
}
