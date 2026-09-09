import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { assertProfileCanManageSocialAccounts } from "@/lib/social/connections/social-connection-auth";
import {
  runSocialDbTransaction,
  SOCIAL_DB_TRANSACTION_SELECTION_TIMEOUT_MS,
} from "@/lib/social/connections/social-db-transaction";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import {
  classifyFacebookPageCapability,
  discoverManagedFacebookPagesForAuthorization,
  MetaPageDiscoveryError,
  revalidateManagedFacebookPage,
  type MetaPageDiscoveryErrorCategory,
} from "@/lib/social/providers/meta-pages";
import { disconnectInstagramAccountsForConnection } from "@/lib/social/connections/social-instagram-account-service";
import {
  buildSocialCredentialAad,
  clearMetaFacebookPageCredential,
  decryptSocialTokenPayload,
  encryptSocialTokenPayload,
  readMetaFacebookPageCredential,
  withMetaFacebookPageCredential,
  type EncryptedSocialValue,
} from "@/lib/social/security/social-crypto";

export type FacebookPageListItem = {
  socialAccountId: string;
  /** Facebook Page ID — server-internal only; omitted from client API responses. */
  externalPageId: string;
  name: string;
  category: string | null;
  profileImageUrl: string | null;
  /** Alias of connectionEligible after workspace duplicate checks. */
  selectable: boolean;
  /** Independent of publish/moderate: Page token + pages_read_engagement. */
  connectionEligible: boolean;
  fullyManageable: boolean;
  capabilityClass:
    | "full_management"
    | "publishing_capable"
    | "moderation_only"
    | "engagement_only"
    | "unverified"
    | "insufficient";
  canReadEngagement: boolean;
  canPublish: boolean;
  canModerate: boolean;
  limitationLabel: string | null;
  unavailableReason:
    | "already_connected"
    | "insufficient_access"
    | null;
  /** True when this row is the connection’s persisted selected Page. */
  isCurrentSelection: boolean;
};

export type FacebookPageDiscoveryDiagnostics = {
  authorizationMode:
    | "scoped_pages_present"
    | "scoped_pages_absent"
    | "page_scopes_missing";
  grantedScopeClassification:
    | "page_scopes_granted"
    | "page_scopes_missing";
  rawResultCount: number;
  eligibleResultCount: number;
  filteringReasonCounts: {
    insufficient_access: number;
    already_connected: number;
    malformed: number;
  };
  databaseTimingStagesMs: {
    auth: number;
    decrypt: number;
    meta: number;
    validate: number;
    upsert: number;
    total: number;
  };
  /** Differential write counts (creates/updates skipped when unchanged). */
  writeStats: {
    created: number;
    updated: number;
    unchanged: number;
  };
  coalesced: boolean;
  usedMinimalFieldsFallback: boolean;
  outcome: "ok" | "empty" | "conflict" | "unavailable";
};

export type DiscoverFacebookPagesResult = {
  connectionId: string;
  connectionStatus: "authorized" | "connected";
  pages: FacebookPageListItem[];
  empty: boolean;
  diagnostics: FacebookPageDiscoveryDiagnostics;
};

export type SelectFacebookPageResult = {
  connectionId: string;
  connectionStatus: "connected";
  socialAccountId: string;
  assignmentId: string;
  /** Facebook Page ID — server-internal only; omitted from client API responses. */
  externalPageId: string;
  pageName: string;
  /** Public Page image URL — safe for client display; never a token. */
  profileImageUrl: string | null;
  idempotent: boolean;
  capabilityClass: FacebookPageListItem["capabilityClass"];
  connectionEligible: boolean;
  fullyManageable: boolean;
  canReadEngagement: boolean;
  canPublish: boolean;
  canModerate: boolean;
  limitationLabel: string | null;
};

/**
 * Discovery must never demote the persisted selected Page.
 * Connected / selected rows keep accessStatus=selected across rediscovery.
 */
function nextDiscoveryAccessStatus(options: {
  existingStatus: string;
  existingAccessStatus: string;
  discoveredAccessStatus: "available" | "permission_lost";
}): "selected" | "available" | "permission_lost" {
  if (
    options.existingStatus === "connected" ||
    options.existingAccessStatus === "selected"
  ) {
    return "selected";
  }

  return options.discoveredAccessStatus;
}

/** In-flight discovery coalescing (same workspace+connection). */
const discoveryInFlight = new Map<
  string,
  Promise<DiscoverFacebookPagesResult>
>();

/** Short TTL cache so Strict Mode / double-open does not re-hit Meta + upsert. */
const DISCOVERY_RESULT_CACHE_TTL_MS = 45_000;
const discoveryResultCache = new Map<
  string,
  {
    expiresAt: number;
    result: DiscoverFacebookPagesResult;
  }
>();

function discoveryCacheKey(options: {
  clientId: string;
  connectionId: string;
}): string {
  return `${options.clientId}:${options.connectionId}`;
}

export function invalidateFacebookPageDiscoveryCache(options: {
  clientId: string;
  connectionId: string;
}): void {
  discoveryResultCache.delete(discoveryCacheKey(options));
}

/** Test-only: counts DB write operations performed by discovery leaders. */
let discoveryWriteOpsForTests = 0;

export function getFacebookPageDiscoveryWriteOpsForTests(): number {
  return discoveryWriteOpsForTests;
}

export function resetFacebookPageDiscoveryWriteOpsForTests(): void {
  discoveryWriteOpsForTests = 0;
}

/** Test-only: clear coalescing + result cache between cases. */
export function resetFacebookPageDiscoveryCoalescingForTests(): void {
  discoveryInFlight.clear();
  discoveryResultCache.clear();
}

function noteDiscoveryWriteOps(count: number): void {
  if (count > 0) {
    discoveryWriteOpsForTests += count;
  }
}

type DiscoveryAccountMetadata = {
  source: "meta_me_accounts";
  tasks: string[];
  capabilityClass: FacebookPageListItem["capabilityClass"];
  connectionEligible: boolean;
  fullyManageable: boolean;
  canReadEngagement: boolean;
  canPublish: boolean;
  canModerate: boolean;
  limitationLabel: string | null;
  discoveryHadPageToken: boolean;
};

function buildDiscoveryAccountMetadata(options: {
  tasks: string[];
  capability: ReturnType<typeof classifyFacebookPageCapability>;
  discoveryHadPageToken: boolean;
}): DiscoveryAccountMetadata {
  return {
    source: "meta_me_accounts",
    tasks: options.tasks,
    capabilityClass: options.capability.classification,
    connectionEligible: options.capability.connectionEligible,
    fullyManageable: options.capability.fullyManageable,
    canReadEngagement: options.capability.canReadEngagement,
    canPublish: options.capability.canPublish,
    canModerate: options.capability.canModerate,
    limitationLabel: options.capability.limitationLabel,
    discoveryHadPageToken: options.discoveryHadPageToken,
  };
}

function stableJsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Facebook CDN picture URLs rotate signed query params on every Graph call.
 * Compare by origin + pathname so rediscovery does not rewrite all Pages.
 */
export function normalizeProfileImageUrlForCompare(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    return `${url.origin}${url.pathname}`;
  } catch {
    const trimmed = value.trim();
    const queryIndex = trimmed.indexOf("?");
    return queryIndex >= 0 ? trimmed.slice(0, queryIndex) : trimmed;
  }
}

function discoveryMetadataUnchanged(
  existing: unknown,
  next: DiscoveryAccountMetadata,
): boolean {
  if (!existing || typeof existing !== "object") {
    return false;
  }

  const current = existing as Record<string, unknown>;
  return (
    current.source === next.source &&
    stableJsonEqual(current.tasks, next.tasks) &&
    current.capabilityClass === next.capabilityClass &&
    current.connectionEligible === next.connectionEligible &&
    current.fullyManageable === next.fullyManageable &&
    current.canReadEngagement === next.canReadEngagement &&
    current.canPublish === next.canPublish &&
    current.canModerate === next.canModerate &&
    (current.limitationLabel ?? null) === next.limitationLabel &&
    current.discoveryHadPageToken === next.discoveryHadPageToken
  );
}

function discoveryAccountUnchanged(options: {
  existing: {
    displayName: string | null;
    category: string | null;
    profileImageUrl: string | null;
    accessStatus: string;
    isAvailableThroughAuth: boolean;
    metadata: unknown;
  };
  displayName: string;
  category: string | null;
  profileImageUrl: string | null;
  accessStatus: string;
  isAvailableThroughAuth: boolean;
  metadata: DiscoveryAccountMetadata;
}): boolean {
  return (
    options.existing.displayName === options.displayName &&
    options.existing.category === options.category &&
    normalizeProfileImageUrlForCompare(
      options.existing.profileImageUrl,
    ) ===
      normalizeProfileImageUrlForCompare(options.profileImageUrl) &&
    options.existing.accessStatus === options.accessStatus &&
    options.existing.isAvailableThroughAuth ===
      options.isAvailableThroughAuth &&
    discoveryMetadataUnchanged(
      options.existing.metadata,
      options.metadata,
    )
  );
}

function isDiscoveryError(
  error: unknown,
): error is MetaPageDiscoveryError {
  return error instanceof MetaPageDiscoveryError;
}

export function facebookPageErrorCategory(
  error: unknown,
): MetaPageDiscoveryErrorCategory | "conflict" | "forbidden" | "unavailable" {
  if (isDiscoveryError(error)) {
    return error.category;
  }

  if (error instanceof ServiceError) {
    if (error.code === "conflict") return "conflict";
    if (error.code === "forbidden") return "forbidden";
    if (error.code === "not_found") return "not_found";
    return "unavailable";
  }

  return "unavailable";
}

function classifyScopeAndAuthMode(options: {
  scopes: string[];
  rawResultCount: number;
}): Pick<
  FacebookPageDiscoveryDiagnostics,
  "authorizationMode" | "grantedScopeClassification"
> {
  const hasPageScopes =
    options.scopes.includes("pages_show_list") ||
    options.scopes.includes("pages_read_engagement");

  if (!hasPageScopes) {
    return {
      authorizationMode: "page_scopes_missing",
      grantedScopeClassification: "page_scopes_missing",
    };
  }

  return {
    grantedScopeClassification: "page_scopes_granted",
    authorizationMode:
      options.rawResultCount > 0
        ? "scoped_pages_present"
        : "scoped_pages_absent",
  };
}

async function loadAuthorizedMetaConnection(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
  allowConnected: boolean;
}) {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  await assertProfileCanManageSocialAccounts(prisma, {
    clientId: options.clientId,
    profileId: options.profileId,
  });

  const connection =
    await prisma.socialProviderConnection.findFirst({
      where: {
        id: options.connectionId,
        clientId: options.clientId,
        provider: "meta",
      },
      select: {
        id: true,
        clientId: true,
        businessBrandId: true,
        provider: true,
        status: true,
        displayName: true,
        scopes: true,
        credential: {
          select: {
            id: true,
            status: true,
            encryptedPayload: true,
            iv: true,
            authTag: true,
            keyVersion: true,
            tokenExpiresAt: true,
          },
        },
      },
    });

  if (!connection) {
    // Do not reveal whether the connection exists in another workspace.
    throw new ServiceError(
      "not_found",
      "The social connection could not be found.",
    );
  }

  const allowedStatuses = options.allowConnected
    ? (["authorized", "connected"] as const)
    : (["authorized"] as const);

  if (
    !(allowedStatuses as readonly string[]).includes(
      connection.status,
    )
  ) {
    throw new ServiceError(
      "conflict",
      "Facebook Page selection is only available after Meta authorization succeeds.",
    );
  }

  if (
    !connection.credential ||
    connection.credential.status !== "active"
  ) {
    throw new ServiceError(
      "conflict",
      "Facebook authorization credentials are missing. Reconnect to continue.",
    );
  }

  return connection;
}

function decryptUserAccessToken(options: {
  clientId: string;
  connectionId: string;
  provider: string;
  credential: {
    encryptedPayload: string;
    iv: string;
    authTag: string;
    keyVersion: number;
  };
}): {
  userAccessToken: string;
  payload: ReturnType<typeof decryptSocialTokenPayload>;
} {
  try {
    const payload = decryptSocialTokenPayload(
      {
        ciphertext: options.credential.encryptedPayload,
        iv: options.credential.iv,
        authTag: options.credential.authTag,
        keyVersion: options.credential.keyVersion,
      },
      buildSocialCredentialAad({
        clientId: options.clientId,
        connectionId: options.connectionId,
        provider: options.provider,
      }),
    );

    return {
      userAccessToken: payload.accessToken,
      payload,
    };
  } catch {
    throw new MetaPageDiscoveryError(
      "authorization_expired",
      "Facebook authorization credentials could not be read. Reconnect to continue.",
      { status: 403 },
    );
  }
}

/**
 * Discover manageable Facebook Pages for an authorized Meta connection.
 * Meta network I/O, decryption, and per-Page upserts stay outside the
 * short interactive transaction (status validation + membership only).
 * Never marks the connection connected.
 */
export async function discoverFacebookPages(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
}): Promise<DiscoverFacebookPagesResult> {
  const key = discoveryCacheKey(options);

  const cached = discoveryResultCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.result,
      diagnostics: {
        ...cached.result.diagnostics,
        coalesced: true,
      },
    };
  }

  const existing = discoveryInFlight.get(key);

  if (existing) {
    const result = await existing;
    return {
      ...result,
      diagnostics: {
        ...result.diagnostics,
        coalesced: true,
      },
    };
  }

  const promise = discoverFacebookPagesUncoalesced(options)
    .then((result) => {
      discoveryResultCache.set(key, {
        expiresAt: Date.now() + DISCOVERY_RESULT_CACHE_TTL_MS,
        result,
      });
      return result;
    })
    .finally(() => {
      if (discoveryInFlight.get(key) === promise) {
        discoveryInFlight.delete(key);
      }
    });

  discoveryInFlight.set(key, promise);
  return promise;
}

async function discoverFacebookPagesUncoalesced(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
}): Promise<DiscoverFacebookPagesResult> {
  const totalStarted = Date.now();
  let msAuth = 0;
  let msDecrypt = 0;
  let msMeta = 0;
  let msValidate = 0;
  let msUpsert = 0;

  const authStarted = Date.now();
  const connection = await loadAuthorizedMetaConnection({
    ...options,
    allowConnected: true,
  });
  msAuth = Date.now() - authStarted;

  const decryptStarted = Date.now();
  const { userAccessToken } = decryptUserAccessToken({
    clientId: connection.clientId,
    connectionId: connection.id,
    provider: connection.provider,
    credential: connection.credential!,
  });
  msDecrypt = Date.now() - decryptStarted;

  let discovered;
  let metaDiagnostics;

  try {
    const metaStarted = Date.now();
    const fetched = await discoverManagedFacebookPagesForAuthorization({
      userAccessToken,
    });
    msMeta = Date.now() - metaStarted;
    discovered = fetched.pages;
    metaDiagnostics = fetched.diagnostics;
  } catch (error) {
    logSocialOAuthEvent("facebook-page-discovery", {
      stage: "discover_pages",
      outcome: facebookPageErrorCategory(error),
      provider: "meta",
      connectionId: connection.id,
      msAuth,
      msDecrypt,
      msMeta,
      msTotal: Date.now() - totalStarted,
    });
    throw error;
  }

  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  // Short interactive transaction: membership + connection-state only.
  // No Meta calls, decryption, or per-Page upserts inside the TX.
  const validateStarted = Date.now();
  let connectionStatus: "authorized" | "connected";

  try {
    connectionStatus = await runSocialDbTransaction(
      "facebook-page-discovery",
      async (transaction) => {
        await assertProfileCanManageSocialAccounts(transaction, {
          clientId: options.clientId,
          profileId: options.profileId,
        });

        const fresh =
          await transaction.socialProviderConnection.findFirst({
            where: {
              id: connection.id,
              clientId: options.clientId,
              provider: "meta",
              status: { in: ["authorized", "connected"] },
            },
            select: { id: true, status: true },
          });

        if (!fresh) {
          throw new ServiceError(
            "conflict",
            "Facebook Page discovery is only available for authorized Meta connections.",
          );
        }

        return fresh.status as "authorized" | "connected";
      },
    );
  } catch (error) {
    logSocialOAuthEvent("facebook-page-discovery", {
      stage: "discover_pages",
      outcome:
        error instanceof ServiceError &&
        error.message.includes("timed out")
          ? "timeout"
          : facebookPageErrorCategory(error),
      provider: "meta",
      connectionId: connection.id,
      msAuth,
      msDecrypt,
      msMeta,
      msValidate: Date.now() - validateStarted,
      msTotal: Date.now() - totalStarted,
    });
    throw error;
  }

  msValidate = Date.now() - validateStarted;

  // One workspace-scoped read for duplicate connected Pages (outside TX).
  const connectedElsewhereRows =
    await prisma.socialAccount.findMany({
      where: {
        clientId: options.clientId,
        platform: "facebook",
        status: "connected",
        externalAccountId: {
          in: discovered.map((page) => page.externalPageId),
        },
        NOT: { providerConnectionId: connection.id },
      },
      select: { externalAccountId: true },
    });

  const connectedElsewhereIds = new Set(
    connectedElsewhereRows
      .map((row) => row.externalAccountId)
      .filter((id): id is string => typeof id === "string"),
  );

  const now = new Date();
  const pages: FacebookPageListItem[] = [];
  let insufficientAccessCount = 0;
  let alreadyConnectedCount = 0;
  let writeCreated = 0;
  let writeUpdated = 0;
  let writeUnchanged = 0;

  const upsertStarted = Date.now();
  let persistStep = "prepare";

  try {
    const discoveredExternalIds = discovered.map(
      (page) => page.externalPageId,
    );

    persistStep = "preload";
    const existingRows = discoveredExternalIds.length
      ? await prisma.socialAccount.findMany({
          where: {
            clientId: options.clientId,
            providerConnectionId: connection.id,
            platform: "facebook",
            externalAccountId: { in: discoveredExternalIds },
          },
          select: {
            id: true,
            status: true,
            externalAccountId: true,
            displayName: true,
            category: true,
            profileImageUrl: true,
            accessStatus: true,
            isAvailableThroughAuth: true,
            metadata: true,
          },
        })
      : [];

    const existingByExternalId = new Map(
      existingRows
        .filter(
          (
            row,
          ): row is typeof row & {
            externalAccountId: string;
          } => typeof row.externalAccountId === "string",
        )
        .map((row) => [row.externalAccountId, row]),
    );

    type PreparedPage = {
      page: (typeof discovered)[number];
      capability: ReturnType<typeof classifyFacebookPageCapability>;
      connectable: boolean;
      accessStatus: "available" | "permission_lost";
      metadata: DiscoveryAccountMetadata;
    };

    const prepared: PreparedPage[] = discovered.map((page) => {
      const capability = classifyFacebookPageCapability(
        page,
        connection.scopes,
      );
      const connectable = capability.connectionEligible;
      return {
        page,
        capability,
        connectable,
        accessStatus: connectable ? "available" : "permission_lost",
        metadata: buildDiscoveryAccountMetadata({
          tasks: page.tasks,
          capability,
          discoveryHadPageToken: Boolean(page.pageAccessToken),
        }),
      };
    });

    const toCreate = prepared.filter(
      (item) => !existingByExternalId.has(item.page.externalPageId),
    );
    const toUpdate: PreparedPage[] = [];
    const unchangedIds: string[] = [];

    for (const item of prepared) {
      const existing = existingByExternalId.get(
        item.page.externalPageId,
      );
      if (!existing) {
        continue;
      }

      const accessStatus = nextDiscoveryAccessStatus({
        existingStatus: existing.status,
        existingAccessStatus: existing.accessStatus,
        discoveredAccessStatus: item.accessStatus,
      });

      if (
        discoveryAccountUnchanged({
          existing,
          displayName: item.page.name,
          category: item.page.category,
          profileImageUrl: item.page.profileImageUrl,
          accessStatus,
          isAvailableThroughAuth: item.connectable,
          metadata: item.metadata,
        })
      ) {
        unchangedIds.push(existing.id);
      } else {
        toUpdate.push(item);
      }
    }

    if (toCreate.length > 0) {
      persistStep = "create_many";
      await prisma.socialAccount.createMany({
        data: toCreate.map((item) => ({
          clientId: options.clientId,
          providerConnectionId: connection.id,
          platform: "facebook",
          accountType: "facebook_page",
          externalAccountId: item.page.externalPageId,
          displayName: item.page.name,
          category: item.page.category,
          profileImageUrl: item.page.profileImageUrl,
          status: "not_connected",
          accessStatus: item.accessStatus,
          isAvailableThroughAuth: item.connectable,
          firstDiscoveredAt: now,
          lastDiscoveredAt: now,
          metadata: item.metadata,
        })),
        skipDuplicates: true,
      });
      writeCreated = toCreate.length;
      noteDiscoveryWriteOps(1);
    }

    // Freshness bump for unchanged rows — one statement, no metadata rewrite.
    if (unchangedIds.length > 0) {
      persistStep = "bump_unchanged";
      await prisma.socialAccount.updateMany({
        where: {
          clientId: options.clientId,
          providerConnectionId: connection.id,
          id: { in: unchangedIds },
        },
        data: { lastDiscoveredAt: now },
      });
      writeUnchanged = unchangedIds.length;
      noteDiscoveryWriteOps(1);
    }

    // Differential updates only for rows whose discovery payload changed.
    // status is never touched. accessStatus=selected on the confirmed Page
    // is preserved so rediscovery cannot mark another Page as selected.
    // Facebook CDN query-param churn alone does not dirty a row.
    if (toUpdate.length > 0) {
      persistStep = "update_dirty";
      const UPDATE_CONCURRENCY = 15;
      for (let i = 0; i < toUpdate.length; i += UPDATE_CONCURRENCY) {
        const chunk = toUpdate.slice(i, i + UPDATE_CONCURRENCY);
        await Promise.all(
          chunk.map(async (item) => {
            const existing = existingByExternalId.get(
              item.page.externalPageId,
            );
            if (!existing) {
              return;
            }

            const accessStatus = nextDiscoveryAccessStatus({
              existingStatus: existing.status,
              existingAccessStatus: existing.accessStatus,
              discoveredAccessStatus: item.accessStatus,
            });

            await prisma.socialAccount.update({
              where: { id: existing.id },
              data: {
                displayName: item.page.name,
                category: item.page.category,
                profileImageUrl: item.page.profileImageUrl,
                accountType: "facebook_page",
                lastDiscoveredAt: now,
                accessStatus,
                isAvailableThroughAuth: item.connectable,
                metadata: item.metadata,
              },
            });
          }),
        );
        writeUpdated += chunk.length;
        noteDiscoveryWriteOps(chunk.length);
      }
    }

    persistStep = "reload";
    const accountRows = discoveredExternalIds.length
      ? await prisma.socialAccount.findMany({
          where: {
            clientId: options.clientId,
            providerConnectionId: connection.id,
            platform: "facebook",
            externalAccountId: { in: discoveredExternalIds },
          },
          select: {
            id: true,
            status: true,
            accessStatus: true,
            externalAccountId: true,
          },
        })
      : [];

    const accountByExternalId = new Map(
      accountRows
        .filter(
          (
            row,
          ): row is typeof row & {
            externalAccountId: string;
          } => typeof row.externalAccountId === "string",
        )
        .map((row) => [row.externalAccountId, row]),
    );

    persistStep = "assemble";
    for (const item of prepared) {
      const account = accountByExternalId.get(
        item.page.externalPageId,
      );

      if (!account) {
        throw new Error("discovery_persist_incomplete");
      }

      const connectedElsewhere = connectedElsewhereIds.has(
        item.page.externalPageId,
      );
      const alreadyConnectedHere = account.status === "connected";
      const isCurrentSelection =
        alreadyConnectedHere &&
        account.accessStatus === "selected";

      let selectable =
        item.connectable &&
        !connectedElsewhere &&
        !(alreadyConnectedHere && connectionStatus === "connected");

      let unavailableReason: FacebookPageListItem["unavailableReason"] =
        null;

      if (!item.connectable) {
        selectable = false;
        unavailableReason = "insufficient_access";
        insufficientAccessCount += 1;
      } else if (connectedElsewhere || alreadyConnectedHere) {
        selectable = false;
        unavailableReason = "already_connected";
        alreadyConnectedCount += 1;
      }

      pages.push({
        socialAccountId: account.id,
        externalPageId: item.page.externalPageId,
        name: item.page.name,
        category: item.page.category,
        profileImageUrl: item.page.profileImageUrl,
        selectable,
        connectionEligible: item.capability.connectionEligible,
        fullyManageable: item.capability.fullyManageable,
        capabilityClass: item.capability.classification,
        canReadEngagement: item.capability.canReadEngagement,
        canPublish: item.capability.canPublish,
        canModerate: item.capability.canModerate,
        limitationLabel: item.capability.limitationLabel,
        unavailableReason,
        isCurrentSelection,
      });
    }
  } catch (error) {
    // Upsert failures must not alter connection/credential/status.
    const prismaCode =
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string"
        ? (error as { code: string }).code
        : null;

    logSocialOAuthEvent("facebook-page-discovery", {
      stage: "discover_pages",
      outcome: "unavailable",
      provider: "meta",
      connectionId: connection.id,
      mode:
        error instanceof Error &&
        error.message === "discovery_persist_incomplete"
          ? "persist_incomplete"
          : prismaCode
            ? `prisma_${prismaCode}_${persistStep}`
            : `persist_failed_${persistStep}_${
                error instanceof Error
                  ? error.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32) ||
                    "Error"
                  : "unknown"
              }`,
      msAuth,
      msDecrypt,
      msMeta,
      msValidate,
      msUpsert: Date.now() - upsertStarted,
      msTotal: Date.now() - totalStarted,
    });

    throw new ServiceError(
      "unavailable",
      "Facebook Page discovery could not be saved. Nothing changed on the connection — you can safely retry.",
      { status: 503 },
    );
  }

  msUpsert = Date.now() - upsertStarted;

  // Authorization may change during upserts — re-check without mutating.
  const postStatus = await prisma.socialProviderConnection.findFirst({
    where: {
      id: connection.id,
      clientId: options.clientId,
      provider: "meta",
    },
    select: { status: true },
  });

  if (
    !postStatus ||
    (postStatus.status !== "authorized" &&
      postStatus.status !== "connected")
  ) {
    logSocialOAuthEvent("facebook-page-discovery", {
      stage: "discover_pages",
      outcome: "conflict",
      provider: "meta",
      connectionId: connection.id,
      mode: "authorization_changed",
      msAuth,
      msDecrypt,
      msMeta,
      msValidate,
      msUpsert,
      msTotal: Date.now() - totalStarted,
    });

    throw new ServiceError(
      "conflict",
      "Facebook authorization changed during Page discovery. Reconnect and retry.",
    );
  }

  connectionStatus = postStatus.status;

  const { authorizationMode, grantedScopeClassification } =
    classifyScopeAndAuthMode({
      scopes: connection.scopes,
      rawResultCount: discovered.length,
    });

  const eligibleResultCount = pages.filter((page) => page.selectable).length;
  const msTotal = Date.now() - totalStarted;

  const diagnostics: FacebookPageDiscoveryDiagnostics = {
    authorizationMode,
    grantedScopeClassification,
    rawResultCount: discovered.length,
    eligibleResultCount,
    filteringReasonCounts: {
      insufficient_access: insufficientAccessCount,
      already_connected: alreadyConnectedCount,
      malformed: metaDiagnostics?.malformedRowCount ?? 0,
    },
    databaseTimingStagesMs: {
      auth: msAuth,
      decrypt: msDecrypt,
      meta: msMeta,
      validate: msValidate,
      upsert: msUpsert,
      total: msTotal,
    },
    writeStats: {
      created: writeCreated,
      updated: writeUpdated,
      unchanged: writeUnchanged,
    },
    coalesced: false,
    usedMinimalFieldsFallback:
      metaDiagnostics?.usedMinimalFieldsFallback ?? false,
    outcome: pages.length === 0 ? "empty" : "ok",
  };

  logSocialOAuthEvent("facebook-page-discovery", {
    stage: "discover_pages",
    outcome: diagnostics.outcome,
    provider: "meta",
    connectionId: connection.id,
    authMode: authorizationMode,
    scopeClass: grantedScopeClassification,
    rawCount: diagnostics.rawResultCount,
    eligibleCount: eligibleResultCount,
    insufficientAccessCount,
    alreadyConnectedCount,
    malformedCount: diagnostics.filteringReasonCounts.malformed,
    writeCreated: diagnostics.writeStats.created,
    writeUpdated: diagnostics.writeStats.updated,
    writeUnchanged: diagnostics.writeStats.unchanged,
    coalesced: false,
    msAuth,
    msDecrypt,
    msMeta,
    msValidate,
    msUpsert,
    msTotal,
  });

  return {
    connectionId: connection.id,
    connectionStatus,
    pages,
    empty: pages.length === 0,
    diagnostics,
  };
}

/**
 * Select one Facebook Page, store encrypted Page credential, and
 * transition authorized → connected only after validation succeeds.
 */
export async function selectFacebookPage(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
  socialAccountId: string;
}): Promise<SelectFacebookPageResult> {
  const connection = await loadAuthorizedMetaConnection({
    ...options,
    allowConnected: true,
  });

  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  const existingAccount =
    await prisma.socialAccount.findFirst({
      where: {
        id: options.socialAccountId,
        clientId: options.clientId,
        providerConnectionId: connection.id,
        platform: "facebook",
        accountType: "facebook_page",
      },
      select: {
        id: true,
        externalAccountId: true,
        displayName: true,
        profileImageUrl: true,
        status: true,
        brandAssignments: {
          where: { status: "active" },
          select: {
            id: true,
            businessBrandId: true,
          },
          take: 1,
        },
      },
    });

  if (
    !existingAccount?.externalAccountId
  ) {
    const stray = await prisma.socialAccount.findFirst({
      where: {
        id: options.socialAccountId,
        clientId: options.clientId,
      },
      select: {
        providerConnectionId: true,
        platform: true,
        accountType: true,
        externalAccountId: true,
      },
    });

    logSocialOAuthEvent("facebook-page-selection", {
      stage: "select_page",
      outcome: "not_found",
      provider: "meta",
      connectionId: connection.id,
      mode: !stray
        ? "account_missing"
        : stray.providerConnectionId !== connection.id
          ? "account_wrong_connection"
          : stray.platform !== "facebook" ||
              stray.accountType !== "facebook_page"
            ? "account_wrong_shape"
            : !stray.externalAccountId
              ? "account_missing_external_id"
              : "account_unresolved",
    });

    throw new ServiceError(
      "not_found",
      "The selected Facebook Page could not be found for this connection.",
    );
  }

  // Idempotent success: same Page already connected on this connection.
  if (
    connection.status === "connected" &&
    existingAccount.status === "connected" &&
    existingAccount.brandAssignments[0]?.businessBrandId ===
      connection.businessBrandId
  ) {
    const { payload } = decryptUserAccessToken({
      clientId: connection.clientId,
      connectionId: connection.id,
      provider: connection.provider,
      credential: connection.credential!,
    });

    const pageCredential = readMetaFacebookPageCredential(payload);

    if (
      pageCredential?.pageId ===
      existingAccount.externalAccountId
    ) {
      logSocialOAuthEvent("facebook-page-selection", {
        stage: "select_page",
        outcome: "idempotent",
        provider: "meta",
        connectionId: connection.id,
      });

      const { enqueueInitialFacebookPageSync } = await import(
        "@/lib/social/sync/facebook-page-initial-sync"
      );
      const { invalidateBrandSelectorCache } = await import(
        "@/lib/security/brand-context"
      );
      invalidateBrandSelectorCache(options.clientId);
      try {
        await enqueueInitialFacebookPageSync({
          clientId: options.clientId,
          profileId: options.profileId,
          connectionId: connection.id,
          socialAccountId: existingAccount.id,
          businessBrandId: connection.businessBrandId,
        });
      } catch {
        // Selection already connected — sync recovers via cron/worker.
      }

      return {
        connectionId: connection.id,
        connectionStatus: "connected",
        socialAccountId: existingAccount.id,
        assignmentId:
          existingAccount.brandAssignments[0]?.id ?? "",
        externalPageId: existingAccount.externalAccountId,
        pageName:
          existingAccount.displayName ??
          "Facebook Page",
        profileImageUrl: existingAccount.profileImageUrl,
        idempotent: true,
        capabilityClass: "unverified",
        connectionEligible: false,
        fullyManageable: false,
        canReadEngagement: false,
        canPublish: false,
        canModerate: false,
        limitationLabel: null,
      };
    }
  }

  if (connection.status === "connected") {
    throw new ServiceError(
      "conflict",
      "This Meta connection already has a selected Facebook Page.",
    );
  }

  const { userAccessToken, payload } = decryptUserAccessToken({
    clientId: connection.clientId,
    connectionId: connection.id,
    provider: connection.provider,
    credential: connection.credential!,
  });

  let verified;

  try {
    verified = await revalidateManagedFacebookPage({
      userAccessToken,
      externalPageId: existingAccount.externalAccountId,
    });
  } catch (error) {
    logSocialOAuthEvent("facebook-page-selection", {
      stage: "revalidate_page",
      outcome: facebookPageErrorCategory(error),
      provider: "meta",
      connectionId: connection.id,
    });

    if (
      isDiscoveryError(error) &&
      error.category === "authorization_expired"
    ) {
      await prisma.socialProviderConnection.updateMany({
        where: {
          id: connection.id,
          clientId: options.clientId,
          status: "authorized",
        },
        data: {
          status: "reauthorization_required",
          lastErrorCode: "authorization_expired",
          lastErrorMessage:
            "Facebook authorization expired. Reconnect to continue.",
          lastErrorAt: new Date(),
        },
      });
    }

    throw error;
  }

  if (!verified.pageAccessToken) {
    throw new MetaPageDiscoveryError(
      "permission_required",
      "Facebook did not return a usable Page access token for the selected Page.",
      { status: 403 },
    );
  }

  let encrypted: EncryptedSocialValue;

  try {
    const nextPayload = withMetaFacebookPageCredential(payload, {
      pageId: verified.externalPageId,
      accessToken: verified.pageAccessToken,
    });

    encrypted = encryptSocialTokenPayload(
      nextPayload,
      buildSocialCredentialAad({
        clientId: connection.clientId,
        connectionId: connection.id,
        provider: connection.provider,
      }),
    );
  } catch {
    logSocialOAuthEvent("facebook-page-selection", {
      stage: "encrypt_page_credential",
      outcome: "encryption_failed",
      provider: "meta",
      connectionId: connection.id,
    });

    throw new ServiceError(
      "unavailable",
      "The Facebook Page credential could not be stored securely. You can retry.",
      { status: 503 },
    );
  }

  const result = await runSocialDbTransaction(
    "facebook-page-selection",
    async (transaction) => {
      await assertProfileCanManageSocialAccounts(transaction, {
        clientId: options.clientId,
        profileId: options.profileId,
      });

      const fresh =
        await transaction.socialProviderConnection.findFirst({
          where: {
            id: connection.id,
            clientId: options.clientId,
            provider: "meta",
            status: "authorized",
          },
          select: {
            id: true,
            businessBrandId: true,
            credential: { select: { id: true, status: true } },
          },
        });

      if (!fresh?.credential || fresh.credential.status !== "active") {
        throw new ServiceError(
          "conflict",
          "Facebook Page selection is only available after Meta authorization succeeds.",
        );
      }

      // Concurrency: unique indexes
      // (sa_one_connected_facebook_per_connection_key,
      //  sbaa_one_active_per_brand_key) reject duplicate winners.
      // Keep this transaction short — no FOR UPDATE on pooled connections.

      const account =
        await transaction.socialAccount.findFirst({
          where: {
            id: options.socialAccountId,
            clientId: options.clientId,
            providerConnectionId: connection.id,
            platform: "facebook",
            externalAccountId: verified.externalPageId,
          },
          select: {
            id: true,
            externalAccountId: true,
            accessStatus: true,
            isAvailableThroughAuth: true,
          },
        });

      if (!account?.externalAccountId) {
        throw new ServiceError(
          "not_found",
          "The selected Facebook Page could not be found for this connection.",
        );
      }

      const connectedSamePage =
        await transaction.socialAccount.findFirst({
          where: {
            clientId: options.clientId,
            platform: "facebook",
            externalAccountId: account.externalAccountId,
            status: "connected",
            NOT: { id: account.id },
          },
          select: { id: true },
        });

      if (connectedSamePage) {
        throw new ServiceError(
          "conflict",
          "This Facebook Page is already connected in this workspace.",
        );
      }

      const now = new Date();
      const liveCapability = verified.capability;

      // One Meta connection → one selected Facebook Page. Demote any other
      // selected/connected siblings on this connection before binding.
      await transaction.socialAccount.updateMany({
        where: {
          clientId: options.clientId,
          providerConnectionId: connection.id,
          platform: "facebook",
          id: { not: account.id },
          OR: [
            { status: "connected" },
            { accessStatus: "selected" },
          ],
        },
        data: {
          status: "not_connected",
          accessStatus: "available",
        },
      });

      // One active assignment per brand — deactivate any other active rows.
      await transaction.socialBrandAccountAssignment.updateMany({
        where: {
          clientId: options.clientId,
          businessBrandId: fresh.businessBrandId,
          status: "active",
          socialAccountId: { not: account.id },
        },
        data: {
          status: "inactive",
          unassignedAt: now,
        },
      });

      await transaction.socialAccount.update({
        where: { id: account.id },
        data: {
          displayName: verified.name,
          category: verified.category,
          profileImageUrl: verified.profileImageUrl,
          accessStatus: "selected",
          status: "connected",
          isAvailableThroughAuth: true,
          lastDiscoveredAt: now,
          metadata: {
            source: "meta_me_accounts",
            tasks: verified.tasks,
            capabilityClass: liveCapability.classification,
            connectionEligible: liveCapability.connectionEligible,
            fullyManageable: liveCapability.fullyManageable,
            canReadEngagement: liveCapability.canReadEngagement,
            canPublish: liveCapability.canPublish,
            canModerate: liveCapability.canModerate,
            limitationLabel: liveCapability.limitationLabel,
            discoveryHadPageToken: true,
            capabilityVerifiedAt: now.toISOString(),
            permissionsVerifiedAt: now.toISOString(),
          },
        },
      });

      await transaction.socialCredential.update({
        where: { id: fresh.credential.id },
        data: {
          encryptedPayload: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          keyVersion: encrypted.keyVersion,
          lastValidatedAt: now,
        },
      });

      const brand = await transaction.businessBrand.findFirst({
        where: {
          id: fresh.businessBrandId,
          clientId: options.clientId,
          status: { notIn: ["archived", "frozen"] },
        },
        select: { id: true },
      });

      if (!brand) {
        throw new ServiceError(
          "not_found",
          "The selected brand could not be found in this workspace.",
        );
      }

      const assignment =
        await transaction.socialBrandAccountAssignment.upsert({
          where: {
            businessBrandId_socialAccountId: {
              businessBrandId: brand.id,
              socialAccountId: account.id,
            },
          },
          update: {
            status: "active",
            assignedAt: now,
            assignedByProfileId: options.profileId,
            unassignedAt: null,
          },
          create: {
            clientId: options.clientId,
            businessBrandId: brand.id,
            socialAccountId: account.id,
            status: "active",
            assignedAt: now,
            assignedByProfileId: options.profileId,
          },
          select: {
            id: true,
            assignedAt: true,
          },
        });

      await transaction.socialAccount.update({
        where: { id: account.id },
        data: {
          businessBrandId: brand.id,
        },
      });

      await transaction.socialProviderConnection.update({
        where: { id: connection.id },
        data: {
          status: "connected",
          connectedAt: now,
          disconnectedAt: null,
          displayName: verified.name,
          lastValidatedAt: now,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastErrorAt: null,
        },
      });

      // Successful explicit selection clears migration/runtime reselection flag.
      await transaction.businessBrand.update({
        where: { id: brand.id },
        data: { requiresMetaPageReselection: false },
      });

      return {
        connectionId: connection.id,
        connectionStatus: "connected" as const,
        socialAccountId: account.id,
        assignmentId: assignment.id,
        externalPageId: verified.externalPageId,
        pageName: verified.name,
        profileImageUrl: verified.profileImageUrl,
        idempotent: false,
        capabilityClass: liveCapability.classification,
        connectionEligible: liveCapability.connectionEligible,
        fullyManageable: liveCapability.fullyManageable,
        canReadEngagement: liveCapability.canReadEngagement,
        canPublish: liveCapability.canPublish,
        canModerate: liveCapability.canModerate,
        limitationLabel: liveCapability.limitationLabel,
      };
    },
    {
      maxWaitMs: SOCIAL_DB_TRANSACTION_SELECTION_TIMEOUT_MS,
      timeoutMs: SOCIAL_DB_TRANSACTION_SELECTION_TIMEOUT_MS,
    },
  );

  logSocialOAuthEvent("facebook-page-selection", {
    stage: "select_page",
    outcome: "ok",
    provider: "meta",
    connectionId: connection.id,
  });

  invalidateFacebookPageDiscoveryCache({
    clientId: options.clientId,
    connectionId: connection.id,
  });

  const { invalidateBrandSelectorCache } = await import(
    "@/lib/security/brand-context"
  );
  invalidateBrandSelectorCache(options.clientId);

  // Claim + schedule must run inside this request so after() has context.
  // Never fire-and-forget enqueue after the response is already sent.
  try {
    const { enqueueInitialFacebookPageSync } = await import(
      "@/lib/social/sync/facebook-page-initial-sync"
    );
    await enqueueInitialFacebookPageSync({
      clientId: options.clientId,
      profileId: options.profileId,
      connectionId: result.connectionId,
      socialAccountId: result.socialAccountId,
      businessBrandId: connection.businessBrandId,
    });
  } catch {
    // Selection already committed — sync recovers via cron/worker.
  }

  return result;
}

export type ClearSelectedFacebookPageResult = {
  connectionId: string;
  connectionStatus: "authorized";
  socialAccountId: string | null;
  pageName: string | null;
};

/**
 * Metricool-style remove/clear of the selected Facebook Page.
 * Keeps Meta user authorization intact so the user can pick another Page
 * without repeating OAuth. Full provider teardown remains DELETE connection.
 */
export async function clearSelectedFacebookPage(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
}): Promise<ClearSelectedFacebookPageResult> {
  const connection = await loadAuthorizedMetaConnection({
    ...options,
    allowConnected: true,
  });

  if (connection.status !== "connected") {
    throw new ServiceError(
      "conflict",
      "There is no selected Facebook Page to remove on this connection.",
    );
  }

  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  const selectedAccount =
    await prisma.socialAccount.findFirst({
      where: {
        clientId: options.clientId,
        providerConnectionId: connection.id,
        platform: "facebook",
        accountType: "facebook_page",
        status: "connected",
        accessStatus: "selected",
      },
      select: {
        id: true,
        displayName: true,
      },
    });

  const { payload } = decryptUserAccessToken({
    clientId: connection.clientId,
    connectionId: connection.id,
    provider: connection.provider,
    credential: connection.credential!,
  });

  let encrypted: EncryptedSocialValue;

  try {
    encrypted = encryptSocialTokenPayload(
      clearMetaFacebookPageCredential(payload),
      buildSocialCredentialAad({
        clientId: connection.clientId,
        connectionId: connection.id,
        provider: connection.provider,
      }),
    );
  } catch {
    throw new ServiceError(
      "unavailable",
      "The Facebook Page credential could not be cleared securely. You can retry.",
      { status: 503 },
    );
  }

  const result = await runSocialDbTransaction(
    "facebook-page-clear",
    async (transaction) => {
      await assertProfileCanManageSocialAccounts(transaction, {
        clientId: options.clientId,
        profileId: options.profileId,
      });

      const fresh =
        await transaction.socialProviderConnection.findFirst({
          where: {
            id: connection.id,
            clientId: options.clientId,
            provider: "meta",
            status: "connected",
          },
          select: {
            id: true,
            businessBrandId: true,
            credential: {
              select: { id: true },
            },
          },
        });

      if (!fresh?.credential) {
        throw new ServiceError(
          "conflict",
          "This Meta connection is no longer ready for Page changes.",
        );
      }

      const now = new Date();

      const account =
        selectedAccount ??
        (await transaction.socialAccount.findFirst({
          where: {
            clientId: options.clientId,
            providerConnectionId: connection.id,
            platform: "facebook",
            accountType: "facebook_page",
            status: "connected",
          },
          select: {
            id: true,
            displayName: true,
          },
        }));

      if (account) {
        await transaction.socialBrandAccountAssignment.updateMany({
          where: {
            clientId: options.clientId,
            businessBrandId: fresh.businessBrandId,
            socialAccountId: account.id,
            status: "active",
          },
          data: {
            status: "inactive",
            unassignedAt: now,
          },
        });

        await transaction.socialAccount.update({
          where: { id: account.id },
          data: {
            status: "not_connected",
            accessStatus: "available",
            businessBrandId: null,
          },
        });
      }

      await disconnectInstagramAccountsForConnection({
        clientId: options.clientId,
        connectionId: connection.id,
        transaction,
      });

      // Defensive: no active Page assignment should remain on this brand
      // for accounts that still belong to this Meta connection.
      const connectionAccounts =
        await transaction.socialAccount.findMany({
          where: {
            clientId: options.clientId,
            providerConnectionId: connection.id,
          },
          select: { id: true },
        });

      if (connectionAccounts.length > 0) {
        await transaction.socialBrandAccountAssignment.updateMany({
          where: {
            clientId: options.clientId,
            businessBrandId: fresh.businessBrandId,
            socialAccountId: {
              in: connectionAccounts.map((row) => row.id),
            },
            status: "active",
          },
          data: {
            status: "inactive",
            unassignedAt: now,
          },
        });
      }

      await transaction.socialCredential.update({
        where: { id: fresh.credential.id },
        data: {
          encryptedPayload: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          keyVersion: encrypted.keyVersion,
          lastValidatedAt: now,
        },
      });

      await transaction.socialProviderConnection.update({
        where: { id: connection.id },
        data: {
          status: "authorized",
          connectedAt: null,
          displayName: null,
          lastValidatedAt: now,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastErrorAt: null,
        },
      });

      await transaction.businessBrand.update({
        where: { id: fresh.businessBrandId },
        data: { requiresMetaPageReselection: true },
      });

      if (account) {
        await transaction.socialAccountSyncState.deleteMany({
          where: {
            clientId: options.clientId,
            socialAccountId: account.id,
          },
        });
      }

      return {
        connectionId: connection.id,
        connectionStatus: "authorized" as const,
        socialAccountId: account?.id ?? null,
        pageName: account?.displayName ?? null,
      };
    },
  );

  logSocialOAuthEvent("facebook-page-selection", {
    stage: "clear_page",
    outcome: "ok",
    provider: "meta",
    connectionId: connection.id,
  });

  invalidateFacebookPageDiscoveryCache({
    clientId: options.clientId,
    connectionId: connection.id,
  });

  const { invalidateBrandSelectorCache } = await import(
    "@/lib/security/brand-context"
  );
  invalidateBrandSelectorCache(options.clientId);

  return result;
}

export type PreserveSelectedPageAfterReauthResult =
  | { kind: "preserved"; pageName: string }
  | { kind: "requires_selection"; reason: string }
  | { kind: "none" };

/**
 * After Meta reauthorization, keep the previously selected Page only when
 * live /me/accounts validation proves the new identity still has access.
 * Otherwise clear selection and require explicit Page pick.
 */
export async function preserveSelectedFacebookPageAfterReauthorization(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
}): Promise<PreserveSelectedPageAfterReauthResult> {
  const prisma = getPrisma();
  if (!prisma) {
    return { kind: "requires_selection", reason: "unavailable" };
  }

  const connection = await prisma.socialProviderConnection.findFirst({
    where: {
      id: options.connectionId,
      clientId: options.clientId,
      provider: "meta",
      status: "authorized",
    },
    select: {
      id: true,
      clientId: true,
      provider: true,
      businessBrandId: true,
      credential: {
        select: {
          encryptedPayload: true,
          iv: true,
          authTag: true,
          keyVersion: true,
          status: true,
        },
      },
    },
  });

  if (!connection?.credential || connection.credential.status !== "active") {
    return { kind: "requires_selection", reason: "missing_credential" };
  }

  const selectedAccounts = await prisma.socialAccount.findMany({
    where: {
      clientId: options.clientId,
      providerConnectionId: connection.id,
      platform: "facebook",
      accountType: "facebook_page",
      status: "connected",
      accessStatus: "selected",
      externalAccountId: { not: null },
    },
    select: {
      id: true,
      externalAccountId: true,
      displayName: true,
    },
    take: 3,
  });

  if (selectedAccounts.length === 0) {
    return { kind: "none" };
  }

  if (selectedAccounts.length > 1 || !selectedAccounts[0]?.externalAccountId) {
    await demoteSelectedFacebookPagesForConnection({
      clientId: options.clientId,
      connectionId: connection.id,
      profileId: options.profileId,
    });
    return { kind: "requires_selection", reason: "ambiguous" };
  }

  const selected = selectedAccounts[0]!;

  let userAccessToken: string;
  let payload: ReturnType<typeof decryptSocialTokenPayload>;
  try {
    const decrypted = decryptUserAccessToken({
      clientId: connection.clientId,
      connectionId: connection.id,
      provider: connection.provider,
      credential: connection.credential,
    });
    userAccessToken = decrypted.userAccessToken;
    payload = decrypted.payload;
  } catch {
    await demoteSelectedFacebookPagesForConnection({
      clientId: options.clientId,
      connectionId: connection.id,
      profileId: options.profileId,
    });
    return { kind: "requires_selection", reason: "decrypt_failed" };
  }

  let verified;
  try {
    verified = await revalidateManagedFacebookPage({
      userAccessToken,
      externalPageId: selected.externalAccountId!,
    });
  } catch (error) {
    const { MetaPageDiscoveryError } = await import(
      "@/lib/social/providers/meta-pages"
    );
    // Transient Graph failures must not wipe a still-selected Page after
    // successful OAuth — sync can reattach the Page token on retry.
    if (
      error instanceof MetaPageDiscoveryError &&
      error.category === "temporary"
    ) {
      logSocialOAuthEvent("facebook-page-selection", {
        stage: "reauth_preserve",
        outcome: "temporary_validation_failed",
        provider: "meta",
      });
      return { kind: "requires_selection", reason: "live_validation_temporary" };
    }

    await demoteSelectedFacebookPagesForConnection({
      clientId: options.clientId,
      connectionId: connection.id,
      profileId: options.profileId,
    });
    logSocialOAuthEvent("facebook-page-selection", {
      stage: "reauth_preserve",
      outcome: "requires_selection",
      provider: "meta",
    });
    return { kind: "requires_selection", reason: "live_validation_failed" };
  }

  if (!verified.pageAccessToken) {
    await demoteSelectedFacebookPagesForConnection({
      clientId: options.clientId,
      connectionId: connection.id,
      profileId: options.profileId,
    });
    return { kind: "requires_selection", reason: "missing_page_token" };
  }

  let encrypted: EncryptedSocialValue;
  try {
    encrypted = encryptSocialTokenPayload(
      withMetaFacebookPageCredential(payload, {
        pageId: verified.externalPageId,
        accessToken: verified.pageAccessToken,
      }),
      buildSocialCredentialAad({
        clientId: connection.clientId,
        connectionId: connection.id,
        provider: connection.provider,
      }),
    );
  } catch {
    await demoteSelectedFacebookPagesForConnection({
      clientId: options.clientId,
      connectionId: connection.id,
      profileId: options.profileId,
    });
    return { kind: "requires_selection", reason: "encrypt_failed" };
  }

  const now = new Date();
  await runSocialDbTransaction("facebook-page-reauth-preserve", async (tx) => {
    await assertProfileCanManageSocialAccounts(tx, {
      clientId: options.clientId,
      profileId: options.profileId,
    });

    await tx.socialCredential.update({
      where: { connectionId: connection.id },
      data: {
        encryptedPayload: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        keyVersion: encrypted.keyVersion,
        lastValidatedAt: now,
        statusChangedAt: now,
      },
    });

    await tx.socialAccount.updateMany({
      where: {
        id: selected.id,
        clientId: options.clientId,
        providerConnectionId: connection.id,
        accessStatus: "selected",
      },
      data: {
        displayName: verified.name || selected.displayName,
        profileImageUrl: verified.profileImageUrl,
        status: "connected",
        accessStatus: "selected",
        lastDiscoveredAt: now,
      },
    });

    await tx.socialProviderConnection.updateMany({
      where: {
        id: connection.id,
        clientId: options.clientId,
        status: "authorized",
      },
      data: {
        status: "connected",
        connectedAt: now,
        lastValidatedAt: now,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorAt: null,
      },
    });
  });

  logSocialOAuthEvent("facebook-page-selection", {
    stage: "reauth_preserve",
    outcome: "preserved",
    provider: "meta",
  });

  const { invalidateBrandSelectorCache } = await import(
    "@/lib/security/brand-context"
  );
  invalidateBrandSelectorCache(options.clientId);

  return {
    kind: "preserved",
    pageName: verified.name || selected.displayName || "Facebook Page",
  };
}

async function demoteSelectedFacebookPagesForConnection(options: {
  clientId: string;
  connectionId: string;
  profileId: string;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;

  const connection = await prisma.socialProviderConnection.findFirst({
    where: {
      id: options.connectionId,
      clientId: options.clientId,
      provider: "meta",
    },
    select: {
      id: true,
      clientId: true,
      provider: true,
      credential: {
        select: {
          encryptedPayload: true,
          iv: true,
          authTag: true,
          keyVersion: true,
          status: true,
        },
      },
    },
  });

  if (!connection?.credential) {
    await prisma.socialAccount.updateMany({
      where: {
        clientId: options.clientId,
        providerConnectionId: options.connectionId,
        platform: "facebook",
        accessStatus: "selected",
      },
      data: {
        status: "not_connected",
        accessStatus: "available",
        businessBrandId: null,
      },
    });
    await disconnectInstagramAccountsForConnection({
      clientId: options.clientId,
      connectionId: options.connectionId,
    });
    return;
  }

  try {
    const { payload } = decryptUserAccessToken({
      clientId: connection.clientId,
      connectionId: connection.id,
      provider: connection.provider,
      credential: connection.credential,
    });
    const encrypted = encryptSocialTokenPayload(
      clearMetaFacebookPageCredential(payload),
      buildSocialCredentialAad({
        clientId: connection.clientId,
        connectionId: connection.id,
        provider: connection.provider,
      }),
    );
    await prisma.socialCredential.update({
      where: { connectionId: connection.id },
      data: {
        encryptedPayload: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        keyVersion: encrypted.keyVersion,
        lastValidatedAt: new Date(),
      },
    });
  } catch {
    // Still demote Page rows even if credential rewrite fails.
  }

  await prisma.socialAccount.updateMany({
    where: {
      clientId: options.clientId,
      providerConnectionId: options.connectionId,
      platform: "facebook",
      accessStatus: "selected",
    },
    data: {
      status: "not_connected",
      accessStatus: "available",
      businessBrandId: null,
    },
  });

  await disconnectInstagramAccountsForConnection({
    clientId: options.clientId,
    connectionId: options.connectionId,
  });

  await prisma.socialBrandAccountAssignment.updateMany({
    where: {
      clientId: options.clientId,
      socialAccount: {
        providerConnectionId: options.connectionId,
        platform: "facebook",
      },
      status: "active",
    },
    data: {
      status: "inactive",
      unassignedAt: new Date(),
    },
  });
}

