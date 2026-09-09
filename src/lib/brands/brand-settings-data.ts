import "server-only";

import { previewSocialBrandAllowance } from "@/lib/billing/social/brand-allowance";
import {
  listConnectedPlatformIcons,
  resolveBrandDisplayImage,
  resolveBrandDisplayLabel,
} from "@/lib/brands/brand-display-image";
import type { EngagementRatioValue } from "@/lib/brands/brand-settings-validation";
import {
  composeGeneralInstructions,
  parseStoredInstructions,
} from "@/lib/brands/brand-ai-instructions";
import { getPrisma } from "@/lib/db/prisma";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";
import { toAccountPictureSrc, toClientSocialImageUrl } from "@/lib/social/media/remote-image";
import { listSocialProviderReadiness } from "@/lib/social/providers/registry";

export type BrandSettingsTab = "settings" | "connections" | "ai";

export interface BrandSettingsAccountImage {
  accountId: string;
  platform: string;
  displayName: string | null;
  handle: string | null;
  status: string;
  imageUrl: string | null;
}

export interface BrandSettingsConnection {
  accountId: string;
  connectionId: string | null;
  provider: string | null;
  platform: string;
  displayName: string | null;
  handle: string | null;
  status: string;
  accessStatus: string;
  accountType: string | null;
  imageUrl: string | null;
}

export interface BrandSettingsProviderConnection {
  id: string;
  provider: string;
  status: string;
}

export interface BrandSettingsProviderReadiness {
  provider: string;
  implemented: boolean;
  connectable: boolean;
  state: string;
}

export interface BrandSettingsBrandCard {
  id: string;
  name: string;
  status: string;
  displayLabel: string;
  displayImageUrl: string | null;
  connectedPlatforms: string[];
}

export interface BrandSettingsVoice {
  id: string;
  name: string;
  tone: string | null;
  audience: string | null;
  language: string;
  notes: string | null;
  sampleCaption: string | null;
  keywords: string[];
  bannedPhrases: string[];
  generalInstructions: string;
  platformInstructions: Record<string, string>;
}

export type BrandSettingsPageData =
  | {
      source: "database";
      workspaceName: string;
      brands: BrandSettingsBrandCard[];
      activeBrandId: string | null;
      brandAllowance: number;
      billableCount: number;
      canAddBrand: boolean;
      hasPaidPlan: boolean;
      brand: {
        id: string;
        name: string;
        engagementRatio: EngagementRatioValue;
        imageSocialAccountId: string | null;
        images: BrandSettingsAccountImage[];
        connections: BrandSettingsConnection[];
        providerConnections: BrandSettingsProviderConnection[];
        providers: BrandSettingsProviderReadiness[];
        voices: BrandSettingsVoice[];
      } | null;
    }
  | {
      source: "unavailable";
      message: string;
      workspaceName: null;
      brands: [];
      activeBrandId: null;
      brand: null;
    };

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toEngagementRatio(value: number): EngagementRatioValue {
  return value === 1000 ? 1000 : 100;
}

function accountImageSrc(account: {
  id: string;
  platform: string;
  profileImageUrl: string | null;
}): string | null {
  if (account.platform === "facebook") {
    return toAccountPictureSrc(account.id);
  }

  return toClientSocialImageUrl(account.profileImageUrl);
}

export async function getBrandSettingsPageData(
  access: ClientScopedAccess,
  activeBrandId: string | null,
): Promise<BrandSettingsPageData> {
  const prisma = getPrisma();

  if (!prisma) {
    return {
      source: "unavailable",
      message: "The brand database is unavailable.",
      workspaceName: null,
      brands: [],
      activeBrandId: null,
      brand: null,
    };
  }

  try {
    const [
      workspace,
      brandRows,
      accountRows,
      connectionRows,
      voiceRows,
      allowance,
    ] = await Promise.all([
      prisma.client.findUnique({
        where: { id: access.activeClientId },
        select: { name: true },
      }),
      prisma.businessBrand.findMany({
        where: {
          clientId: access.activeClientId,
          status: { notIn: ["archived", "frozen"] },
        },
        orderBy: [{ status: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          status: true,
          imageUrl: true,
          imageSocialAccountId: true,
          engagementRatio: true,
        },
      }),
      prisma.socialAccount.findMany({
        where: {
          clientId: access.activeClientId,
          businessBrandId: { not: null },
          status: "connected",
        },
        select: {
          id: true,
          businessBrandId: true,
          providerConnectionId: true,
          platform: true,
          handle: true,
          displayName: true,
          status: true,
          accessStatus: true,
          accountType: true,
          profileImageUrl: true,
        },
        orderBy: [{ platform: "asc" }, { displayName: "asc" }],
      }),
      prisma.socialProviderConnection.findMany({
        where: {
          clientId: access.activeClientId,
        },
        select: {
          id: true,
          provider: true,
          status: true,
          businessBrandId: true,
        },
      }),
      prisma.brandVoice.findMany({
        where: {
          clientId: access.activeClientId,
          ...(activeBrandId ? { businessBrandId: activeBrandId } : {}),
        },
        select: {
          id: true,
          name: true,
          tone: true,
          audience: true,
          language: true,
          notes: true,
          sampleCaption: true,
          keywords: true,
          bannedPhrases: true,
          instructions: true,
          businessBrandId: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      previewSocialBrandAllowance(access.activeClientId).catch(() => null),
    ]);

    if (!workspace) {
      return {
        source: "unavailable",
        message: "The selected workspace could not be found.",
        workspaceName: null,
        brands: [],
        activeBrandId: null,
        brand: null,
      };
    }

    const accountsByBrand = new Map<string, typeof accountRows>();

    for (const account of accountRows) {
      if (!account.businessBrandId) {
        continue;
      }

      const list = accountsByBrand.get(account.businessBrandId) ?? [];
      list.push(account);
      accountsByBrand.set(account.businessBrandId, list);
    }

    const brands: BrandSettingsBrandCard[] = brandRows.map((brand) => {
      const accounts = (accountsByBrand.get(brand.id) ?? []).filter((account) => {
        if (account.platform === "facebook") {
          return account.accessStatus === "selected";
        }
        return true;
      });

      const connectedAccounts = accounts.map((account) => ({
        accountId: account.id,
        platform: account.platform,
        profileImageUrl: account.profileImageUrl,
        displayName: account.displayName,
        preferAsPrimary: account.id === brand.imageSocialAccountId,
      }));

      const selectedAccount = brand.imageSocialAccountId
        ? connectedAccounts.find(
            (account) => account.accountId === brand.imageSocialAccountId,
          ) ?? null
        : null;

      const resolved = resolveBrandDisplayImage({
        uploadedImageUrl: selectedAccount ? null : brand.imageUrl,
        connectedAccounts: selectedAccount
          ? [{ ...selectedAccount, preferAsPrimary: true }]
          : connectedAccounts,
      });

      return {
        id: brand.id,
        name: brand.name,
        status: brand.status,
        displayLabel: resolveBrandDisplayLabel({
          brandName: brand.name,
          connectedAccounts,
        }),
        displayImageUrl:
          resolved.source === "uploaded"
            ? resolved.displayImageUrl
            : toAccountPictureSrc(resolved.accountId) ??
              toClientSocialImageUrl(resolved.displayImageUrl),
        connectedPlatforms: listConnectedPlatformIcons(
          accounts.map((account) => account.platform),
        ),
      };
    });

    const brandAllowance = allowance?.allowance ?? 0;
    const billableCount = allowance?.billableCount ?? brands.length;
    const canAddBrand = billableCount < brandAllowance;
    const hasPaidPlan = allowance?.hasPaidPlan ?? false;

    const selected =
      (activeBrandId
        ? brandRows.find((brand) => brand.id === activeBrandId)
        : brandRows.length === 1
          ? brandRows[0]
          : null) ?? null;

    if (!selected) {
      return {
        source: "database",
        workspaceName: workspace.name,
        brands,
        activeBrandId: null,
        brandAllowance,
        billableCount,
        canAddBrand,
        hasPaidPlan,
        brand: null,
      };
    }

    const selectedAccounts = (accountsByBrand.get(selected.id) ?? []).filter(
      (account) => {
        if (account.platform === "facebook") {
          return account.accessStatus === "selected";
        }
        return true;
      },
    );

    const images: BrandSettingsAccountImage[] = selectedAccounts
      .map((account) => ({
        accountId: account.id,
        platform: account.platform,
        displayName: account.displayName,
        handle: account.handle,
        status: account.status,
        imageUrl: accountImageSrc(account),
      }))
      .filter((account) => account.imageUrl);

    return {
      source: "database",
      workspaceName: workspace.name,
      brands,
      activeBrandId: selected.id,
      brandAllowance,
      billableCount,
      canAddBrand,
      hasPaidPlan,
      brand: {
        id: selected.id,
        name: selected.name,
        engagementRatio: toEngagementRatio(selected.engagementRatio),
        imageSocialAccountId: selected.imageSocialAccountId,
        images,
        connections: selectedAccounts.map((account) => {
          const shell = connectionRows.find(
            (row) =>
              row.id === account.providerConnectionId &&
              row.businessBrandId === selected.id,
          );

          return {
            accountId: account.id,
            connectionId: account.providerConnectionId,
            provider: shell?.provider ?? null,
            platform: account.platform,
            displayName: account.displayName,
            handle: account.handle,
            status: account.status,
            accessStatus: account.accessStatus,
            accountType: account.accountType,
            imageUrl: accountImageSrc(account),
          };
        }),
        providerConnections: connectionRows
          .filter((row) => row.businessBrandId === selected.id)
          .map((row) => ({
            id: row.id,
            provider: row.provider,
            status: row.status,
          })),
        providers: listSocialProviderReadiness().map((row) => ({
          provider: row.provider,
          implemented: row.implemented,
          connectable: row.connectable,
          state: row.state,
        })),
        voices: voiceRows
          .filter(
            (voice) =>
              voice.businessBrandId === selected.id ||
              voice.businessBrandId === null,
          )
          .sort((left, right) => {
            const leftRank = left.businessBrandId === selected.id ? 0 : 1;
            const rightRank = right.businessBrandId === selected.id ? 0 : 1;
            return leftRank - rightRank;
          })
          .map((voice) => {
            const stored = parseStoredInstructions(voice.instructions);
            const keywords = toStringArray(voice.keywords);
            const bannedPhrases = toStringArray(voice.bannedPhrases);

            return {
              id: voice.id,
              name: voice.name,
              tone: voice.tone,
              audience: voice.audience,
              language: voice.language,
              notes: voice.notes,
              sampleCaption: voice.sampleCaption,
              keywords,
              bannedPhrases,
              generalInstructions: composeGeneralInstructions({
                storedGeneral: stored.general,
                tone: voice.tone,
                audience: voice.audience,
                keywords,
                bannedPhrases,
                notes: voice.notes,
                sampleCaption: voice.sampleCaption,
              }),
              platformInstructions: stored.platforms,
            };
          }),
      },
    };
  } catch (error) {
    console.error(
      "[brand-settings] Query failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return {
      source: "unavailable",
      message: "Brand settings could not be loaded.",
      workspaceName: null,
      brands: [],
      activeBrandId: null,
      brand: null,
    };
  }
}
