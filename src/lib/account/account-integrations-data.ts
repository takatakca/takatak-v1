import "server-only";

import { parseStoredInstructions } from "@/lib/brands/brand-ai-instructions";
import { listConnectedPlatformIcons } from "@/lib/brands/brand-display-image";
import { getPrisma } from "@/lib/db/prisma";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";

export type AccountIntegrationAccount = {
  platform: string;
  displayName: string | null;
  handle: string | null;
};

export type AccountIntegrationsPageData =
  | {
      source: "database";
      workspaceName: string;
      connectedAccounts: AccountIntegrationAccount[];
      connectedPlatforms: string[];
      brandCount: number;
      brandsWithAiInstructions: number;
    }
  | {
      source: "unavailable";
      message: string;
    };

function instructionsHaveText(value: unknown): boolean {
  const stored = parseStoredInstructions(value);
  if (stored.general.trim()) {
    return true;
  }

  return Object.values(stored.platforms).some((text) => text.trim().length > 0);
}

export async function getAccountIntegrationsPageData(
  access: ClientScopedAccess,
): Promise<AccountIntegrationsPageData> {
  const prisma = getPrisma();

  if (!prisma) {
    return {
      source: "unavailable",
      message: "Integrations could not be loaded.",
    };
  }

  try {
    const [client, accounts, voices, brandCount] = await Promise.all([
      prisma.client.findUnique({
        where: { id: access.activeClientId },
        select: { name: true },
      }),
      prisma.socialAccount.findMany({
        where: {
          clientId: access.activeClientId,
          status: "connected",
        },
        select: {
          platform: true,
          displayName: true,
          handle: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.brandVoice.findMany({
        where: { clientId: access.activeClientId },
        select: {
          instructions: true,
          businessBrand: {
            select: { status: true },
          },
        },
      }),
      prisma.businessBrand.count({
        where: {
          clientId: access.activeClientId,
          status: { notIn: ["archived", "frozen"] },
        },
      }),
    ]);

    if (!client) {
      return {
        source: "unavailable",
        message: "The selected workspace could not be found.",
      };
    }

    const connectedAccounts = accounts.map((account) => ({
      platform: account.platform,
      displayName: account.displayName,
      handle: account.handle,
    }));

    const brandsWithAiInstructions = voices.filter((voice) => {
      if (voice.businessBrand?.status === "archived") {
        return false;
      }
      return instructionsHaveText(voice.instructions);
    }).length;

    return {
      source: "database",
      workspaceName: client.name,
      connectedAccounts,
      connectedPlatforms: listConnectedPlatformIcons(
        connectedAccounts.map((account) => account.platform),
      ),
      brandCount,
      brandsWithAiInstructions,
    };
  } catch (error) {
    console.error(
      "[account-integrations] Query failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return {
      source: "unavailable",
      message: "Integrations could not be loaded.",
    };
  }
}
