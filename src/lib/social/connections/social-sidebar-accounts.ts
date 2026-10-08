/**
 * Sidebar membership for every network.
 * A live connection is listed. Disconnect, and unfinished authorization, are not.
 * Platforms come from the provider registry so a new network is not a special case.
 */

const LIVE_CONNECTION_STATUSES = new Set([
  "authorized",
  "connected",
  "reauthorization_required",
]);

export type SidebarShellConnection = {
  id: string;
  status: string;
  displayName: string | null;
  platforms: readonly string[];
};

export type SupplementalSidebarAccount = {
  id: string;
  platform: string;
  handle: null;
  displayName: string | null;
  status: string;
  profileImageUrl: null;
};

export function isLiveSidebarConnection(status: string): boolean {
  return LIVE_CONNECTION_STATUSES.has(status);
}

export function supplementalSidebarAccounts(
  connections: readonly SidebarShellConnection[],
  existingPlatforms: ReadonlySet<string>,
): SupplementalSidebarAccount[] {
  const seen = new Set(existingPlatforms);
  const extra: SupplementalSidebarAccount[] = [];

  for (const connection of connections) {
    if (!isLiveSidebarConnection(connection.status)) continue;

    for (const platform of connection.platforms) {
      const key = platform.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      extra.push({
        id: connection.id,
        platform: key,
        handle: null,
        displayName: connection.displayName,
        status: connection.status,
        profileImageUrl: null,
      });
    }
  }

  return extra;
}

export function orderSidebarAccounts<T extends { platform: string }>(
  accounts: readonly T[],
  preferredOrder: readonly string[],
): T[] {
  const byPlatform = new Map<string, T>();
  for (const account of accounts) {
    if (!byPlatform.has(account.platform)) {
      byPlatform.set(account.platform, account);
    }
  }

  const leading = preferredOrder.flatMap((platform) => {
    const account = byPlatform.get(platform);
    return account ? [account] : [];
  });
  const leadingPlatforms = new Set(leading.map((account) => account.platform));
  const rest = [...byPlatform.values()].filter(
    (account) => !leadingPlatforms.has(account.platform),
  );

  return [...leading, ...rest];
}
