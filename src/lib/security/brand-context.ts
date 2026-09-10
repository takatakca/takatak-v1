import "server-only";

import {
  listConnectedPlatformIcons,
  resolveBrandDisplayImage,
  resolveBrandDisplayLabel,
} from "@/lib/brands/brand-display-image";
import { getPrisma } from "@/lib/db/prisma";
import { brandSelectorCacheKey, staleActiveBrandCookie } from "@/lib/security/authenticated-identity";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { projectMetaBrandSurface } from "@/lib/social/connections/meta-brand-projection";
import { toAccountPictureSrc, toClientSocialImageUrl } from "@/lib/social/media/remote-image";

export const ACTIVE_BRAND_COOKIE =
  "takatak_active_brand";

/** Short-lived workspace snapshot TTL — invalidated on connect/select/disconnect. */
export const BRAND_SELECTOR_CACHE_TTL_MS = 8_000;

export interface BrandSessionOption {
  id: string;
  name: string;
  status: string;
  /** Explicit uploaded brand image (null if none). */
  imageUrl: string | null;
  /**
   * Resolved display image: uploaded → connected social (FB preferred) → null.
   * Never a Page ID or token.
   */
  displayImageUrl: string | null;
  /**
   * Label shown in the top bar / dropdown: Facebook Page name when connected,
   * otherwise the workspace brand name.
   */
  displayLabel: string;
  /** Platforms with a connected account on this brand. */
  connectedPlatforms: string[];
  /**
   * Facebook surface health from the canonical Meta projection.
   * Used so top-bar / sidebar agree with Manage connections.
   */
  facebookSurface?: {
    state: string;
    attentionRequired: boolean;
  } | null;
}

export interface BrandSessionContext {
  activeBrandId: string | null;
  activeBrandName: string | null;
  activeBrandDisplayLabel: string | null;
  activeBrandDisplayImageUrl: string | null;
  availableBrands: BrandSessionOption[];
  staleBrandCookie: boolean;
}

type CacheEntry = {
  expiresAt: number;
  value: BrandSessionOption[];
};

const snapshotCache = new Map<string, CacheEntry>();
const snapshotInFlight = new Map<
  string,
  Promise<BrandSessionOption[]>
>();

type CanonicalRow = {
  brandId: string;
  brandName: string;
  brandStatus: string;
  brandImageUrl: string | null;
  imageSocialAccountId: string | null;
  accountPlatform: string | null;
  accountId: string | null;
  accountDisplayName: string | null;
  accountProfileImageUrl: string | null;
  accountAccessStatus: string | null;
  shellProvider: string | null;
  shellDisplayName: string | null;
  shellStatus: string | null;
  shellLastErrorCode: string | null;
  syncStatus: string | null;
  pendingOAuth: boolean | null;
};

/**
 * Invalidate workspace brand-selector cache after connect, Page select/clear,
 * disconnect, brand switch, or brand image update.
 */
export function invalidateBrandSelectorCache(
  clientId?: string | null,
): void {
  if (!clientId) {
    snapshotCache.clear();
    snapshotInFlight.clear();
    return;
  }
  const suffix = `::${clientId}`;
  for (const key of snapshotCache.keys()) {
    if (key === clientId || key.endsWith(suffix)) {
      snapshotCache.delete(key);
    }
  }
  for (const key of snapshotInFlight.keys()) {
    if (key === clientId || key.endsWith(suffix)) {
      snapshotInFlight.delete(key);
    }
  }
}

/**
 * One indexed canonical-identity query for the selector.
 * Loads only active brands + selected/connected account display fields +
 * connected shells as name fallback. Never credentials, analytics, OAuth,
 * discovered candidates, or sync history.
 */
async function loadBrandSelectorSnapshotsUncached(
  clientId: string,
): Promise<BrandSessionOption[]> {
  const prisma = getPrisma();

  if (!prisma) {
    return [];
  }

  const started = Date.now();

  const rows = await prisma.$queryRaw<CanonicalRow[]>`
    SELECT
      b.id AS "brandId",
      b.name AS "brandName",
      b.status::text AS "brandStatus",
      b."imageUrl" AS "brandImageUrl",
      b."imageSocialAccountId" AS "imageSocialAccountId",
      s.platform::text AS "accountPlatform",
      s.id AS "accountId",
      s."displayName" AS "accountDisplayName",
      s."profileImageUrl" AS "accountProfileImageUrl",
      s."accessStatus"::text AS "accountAccessStatus",
      c.provider::text AS "shellProvider",
      c."displayName" AS "shellDisplayName",
      c.status::text AS "shellStatus",
      c."lastErrorCode" AS "shellLastErrorCode",
      sync.status::text AS "syncStatus",
      EXISTS (
        SELECT 1
        FROM social_oauth_states o
        WHERE o."connectionId" = c.id
          AND o.status IN ('pending', 'processing')
      ) AS "pendingOAuth"
    FROM business_brands b
    LEFT JOIN social_accounts s
      ON s."clientId" = b."clientId"
      AND s."businessBrandId" = b.id
      AND s.status = 'connected'
      AND (
      s."accessStatus" = 'selected'
        OR s.platform <> 'facebook'
      )
    LEFT JOIN social_provider_connections c
      ON c.id = s."providerConnectionId"
      AND c."clientId" = b."clientId"
      AND c."businessBrandId" = b.id
    LEFT JOIN social_account_sync_states sync
      ON sync."socialAccountId" = s.id
    WHERE b."clientId" = ${clientId}::uuid
      AND b.status <> 'archived'
      AND b.status <> 'frozen'
    ORDER BY b.status ASC, b.name ASC
  `;

  const msQuery = Date.now() - started;

  const byBrand = new Map<
    string,
    {
      id: string;
      name: string;
      status: string;
      imageUrl: string | null;
      imageSocialAccountId: string | null;
      accounts: Array<{
        accountId: string | null;
        platform: string;
        profileImageUrl: string | null;
        displayName: string | null;
        preferAsPrimary?: boolean;
      }>;
      platforms: string[];
      facebookSurface: ReturnType<typeof projectMetaBrandSurface> | null;
    }
  >();

  for (const row of rows) {
    let brand = byBrand.get(row.brandId);
    if (!brand) {
      brand = {
        id: row.brandId,
        name: row.brandName,
        status: row.brandStatus,
        imageUrl: row.brandImageUrl,
        imageSocialAccountId: row.imageSocialAccountId,
        accounts: [],
        platforms: [],
        facebookSurface: null,
      };
      byBrand.set(row.brandId, brand);
    }

    if (row.accountPlatform === "facebook") {
      const projection = projectMetaBrandSurface({
        connection: row.shellStatus
          ? {
              id: "shell",
              status: row.shellStatus,
              lastErrorCode: row.shellLastErrorCode,
            }
          : null,
        selectedPage: {
          id: "page",
          status: "connected",
          accessStatus: row.accountAccessStatus,
          displayName: row.accountDisplayName,
          profileImageUrl: row.accountProfileImageUrl,
        },
        syncStatus: row.syncStatus,
        hasPendingOAuthAttempt: row.pendingOAuth === true,
      });
      brand.facebookSurface = projection;

      if (projection.showFacebookIcon) {
        brand.platforms.push("facebook");
        brand.accounts.push({
          accountId: row.accountId,
          platform: "facebook",
          profileImageUrl: row.accountProfileImageUrl,
          displayName: row.accountDisplayName,
          preferAsPrimary: row.accountAccessStatus === "selected",
        });
      }
      continue;
    }

    if (row.shellProvider === "meta" && !brand.facebookSurface) {
      brand.facebookSurface = projectMetaBrandSurface({
        connection: row.shellStatus
          ? {
              id: "shell",
              status: row.shellStatus,
              lastErrorCode: row.shellLastErrorCode,
            }
          : null,
        selectedPage: null,
        syncStatus: row.syncStatus,
        hasPendingOAuthAttempt: row.pendingOAuth === true,
      });
    }

    if (row.accountPlatform) {
      brand.platforms.push(row.accountPlatform);
      brand.accounts.push({
        accountId: row.accountId,
        platform: row.accountPlatform,
        profileImageUrl: row.accountProfileImageUrl,
        displayName: row.accountDisplayName,
      });
    }
  }

  // Preserve brand order from SQL (status, name).
  const orderedIds: string[] = [];
  for (const row of rows) {
    if (!orderedIds.includes(row.brandId)) {
      orderedIds.push(row.brandId);
    }
  }

  const result = orderedIds.map((id) => {
    const brand = byBrand.get(id)!;
    const selectedAccount = brand.imageSocialAccountId
      ? brand.accounts.find(
          (account) => account.accountId === brand.imageSocialAccountId,
        ) ?? null
      : null;

    const resolved = resolveBrandDisplayImage({
      uploadedImageUrl: selectedAccount ? null : brand.imageUrl,
      connectedAccounts: selectedAccount
        ? [{ ...selectedAccount, preferAsPrimary: true }]
        : brand.accounts,
    });
    const displayLabel = resolveBrandDisplayLabel({
      brandName: brand.name,
      connectedAccounts: brand.accounts,
    });

    return {
      id: brand.id,
      name: brand.name,
      status: brand.status,
      imageUrl: brand.imageUrl?.trim() || null,
      displayImageUrl:
        resolved.source === "uploaded"
          ? resolved.displayImageUrl
          : toAccountPictureSrc(resolved.accountId) ??
            toClientSocialImageUrl(resolved.displayImageUrl),
      displayLabel,
      connectedPlatforms: listConnectedPlatformIcons(brand.platforms),
      facebookSurface: brand.facebookSurface
        ? {
            state: brand.facebookSurface.state,
            attentionRequired: brand.facebookSurface.attentionRequired,
          }
        : null,
    };
  });

  logSocialOAuthEvent("social-brand-selector", {
    stage: "snapshots",
    outcome: "ok",
    msTotal: Date.now() - started,
    msValidate: msQuery,
    rawCount: result.length,
  });

  return result;
}

export async function loadBrandSelectorSnapshots(
  clientId: string,
  options?: { bypassCache?: boolean; profileId?: string | null },
): Promise<BrandSessionOption[]> {
  const cacheKey = options?.profileId
    ? brandSelectorCacheKey(options.profileId, clientId)
    : null;

  if (cacheKey && !options?.bypassCache) {
    const cached = snapshotCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const inflight = snapshotInFlight.get(cacheKey);
    if (inflight) {
      return inflight;
    }
  }

  const promise = loadBrandSelectorSnapshotsUncached(clientId)
    .then((value) => {
      if (cacheKey) {
        snapshotCache.set(cacheKey, {
          value,
          expiresAt: Date.now() + BRAND_SELECTOR_CACHE_TTL_MS,
        });
      }
      return value;
    })
    .finally(() => {
      if (cacheKey && snapshotInFlight.get(cacheKey) === promise) {
        snapshotInFlight.delete(cacheKey);
      }
    });

  if (cacheKey) {
    snapshotInFlight.set(cacheKey, promise);
  }
  return promise;
}

/** Test-only: clear selector cache/coalesce maps. */
export function resetBrandSelectorCacheForTests(): void {
  snapshotCache.clear();
  snapshotInFlight.clear();
}

export async function resolveBrandSessionContext(
  access: ClientScopedAccess,
  requestedBrandId: string | null = null,
): Promise<BrandSessionContext> {
  try {
    const brands = await loadBrandSelectorSnapshots(
      access.activeClientId,
      { profileId: access.profileId },
    );

    const selected = requestedBrandId
      ? brands.find((brand) => brand.id === requestedBrandId) ??
        null
      : brands.length === 1
        ? brands[0]
        : null;

    const staleBrandCookie = staleActiveBrandCookie({
      requestedBrandId,
      availableBrandIds: brands.map((brand) => brand.id),
      activeClientId: access.activeClientId,
    });

    return {
      activeBrandId: selected?.id ?? null,
      activeBrandName: selected?.name ?? null,
      activeBrandDisplayLabel: selected?.displayLabel ?? null,
      activeBrandDisplayImageUrl:
        selected?.displayImageUrl ?? null,
      availableBrands: brands,
      staleBrandCookie,
    };
  } catch (error) {
    console.error(
      "[brand-context] Brand session query failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return {
      activeBrandId: null,
      activeBrandName: null,
      activeBrandDisplayLabel: null,
      activeBrandDisplayImageUrl: null,
      availableBrands: [],
      staleBrandCookie: Boolean(requestedBrandId),
    };
  }
}
