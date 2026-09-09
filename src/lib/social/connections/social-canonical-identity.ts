/**
 * Canonical Meta connection + selected Facebook Page identity.
 * Never resolves by array position, name, latest update, or unscoped findFirst.
 * Never returns tokens, Page IDs, or raw Meta payloads to callers that render UI.
 */

export const LIVE_CONNECTION_STATUSES = [
  "pending_authorization",
  "authorized",
  "connected",
  "reauthorization_required",
] as const;

export type LiveConnectionStatus =
  (typeof LIVE_CONNECTION_STATUSES)[number];

export type CanonicalConnectionCandidate = {
  id: string;
  provider: string;
  status: string;
  /** Meta user subject — compare for replacement, never render. */
  externalSubjectId?: string | null;
  updatedAt?: Date | string | null;
};

export type SelectedPageCandidate = {
  id: string;
  platform: string;
  status: string;
  accessStatus?: string | null;
  displayName?: string | null;
  handle?: string | null;
  profileImageUrl?: string | null;
  providerConnectionId?: string | null;
};

export function isLiveConnectionStatus(
  status: string,
): status is LiveConnectionStatus {
  return (
    status === "pending_authorization" ||
    status === "authorized" ||
    status === "connected" ||
    status === "reauthorization_required"
  );
}

/**
 * One canonical live connection per provider for a brand.
 * Priority: connected > authorized > pending_authorization.
 * Ties broken by stable id (never by name or updatedAt alone).
 */
export function pickCanonicalProviderConnection<
  T extends CanonicalConnectionCandidate,
>(
  connections: readonly T[],
  provider: string,
): T | null {
  const live = connections.filter(
    (row) =>
      row.provider === provider &&
      isLiveConnectionStatus(row.status),
  );

  if (live.length === 0) {
    return null;
  }

  const rank = (status: string) => {
    if (status === "connected") return 0;
    if (status === "reauthorization_required") return 1;
    if (status === "authorized") return 2;
    if (status === "pending_authorization") return 3;
    return 9;
  };

  return [...live].sort((a, b) => {
    const delta = rank(a.status) - rank(b.status);
    if (delta !== 0) return delta;
    return a.id.localeCompare(b.id);
  })[0]!;
}

/** Shells that still own a brand Meta surface after auth/sync failure. */
export const META_SURFACE_ATTENTION_STATUSES = [
  "failed",
  "expired",
  "error",
] as const;

export function isMetaSurfaceAttentionStatus(status: string): boolean {
  return (
    status === "failed" ||
    status === "expired" ||
    status === "error"
  );
}

/**
 * Meta surface picker for UI (selector / sidebar / manage connections).
 * Prefer a live shell; otherwise keep a single attention shell so Page
 * identity and Reconnect stay visible instead of looking disconnected.
 */
export function pickMetaSurfaceConnection<
  T extends CanonicalConnectionCandidate,
>(
  connections: readonly T[],
  provider: string = "meta",
): T | null {
  const live = pickCanonicalProviderConnection(connections, provider);
  if (live) {
    return live;
  }

  const attention = connections.filter(
    (row) =>
      row.provider === provider &&
      isMetaSurfaceAttentionStatus(row.status),
  );

  if (attention.length === 0) {
    return null;
  }

  return [...attention].sort((a, b) => a.id.localeCompare(b.id))[0]!;
}

export type StrictSelectedFacebookResult<T> =
  | { kind: "ready"; account: T }
  | { kind: "missing" }
  | { kind: "ambiguous" };

/**
 * Strict selected Facebook Page: exactly one connected + accessStatus=selected.
 * Ambiguous (2+) selected rows are rejected — never pick by order/name.
 */
export function pickSelectedFacebookAccountStrict<
  T extends SelectedPageCandidate,
>(
  accounts: readonly T[],
  connectionId?: string | null,
): StrictSelectedFacebookResult<T> {
  const facebook = accounts.filter((account) => {
    if (account.platform !== "facebook") return false;
    if (
      connectionId &&
      account.providerConnectionId &&
      account.providerConnectionId !== connectionId
    ) {
      return false;
    }
    return true;
  });

  const selected = facebook.filter(
    (account) =>
      account.status === "connected" &&
      account.accessStatus === "selected",
  );

  if (selected.length > 1) {
    return { kind: "ambiguous" };
  }
  if (selected.length === 1) {
    return { kind: "ready", account: selected[0]! };
  }

  return { kind: "missing" };
}

/**
 * Persisted selected Facebook Page for a connection or brand surface.
 * Prefer accessStatus=selected + connected on the canonical connection.
 * Returns null when missing or ambiguous (never invents a pick).
 */
export function pickSelectedFacebookAccount<
  T extends SelectedPageCandidate,
>(accounts: readonly T[], connectionId?: string | null): T | null {
  const strict = pickSelectedFacebookAccountStrict(accounts, connectionId);
  if (strict.kind === "ready") {
    return strict.account;
  }

  // Compatibility fallback for discovery cards: single connected without selected.
  if (strict.kind === "ambiguous") {
    return null;
  }

  const facebook = accounts.filter((account) => {
    if (account.platform !== "facebook") return false;
    if (
      connectionId &&
      account.providerConnectionId &&
      account.providerConnectionId !== connectionId
    ) {
      return false;
    }
    return true;
  });

  const connected = facebook.filter(
    (account) => account.status === "connected",
  );
  if (connected.length === 1) {
    return connected[0]!;
  }

  return null;
}

export function pickConnectedPlatformAccount<
  T extends SelectedPageCandidate,
>(
  accounts: readonly T[],
  platform: string,
): T | null {
  const matches = accounts.filter(
    (account) => account.platform === platform,
  );
  if (matches.length === 0) {
    return null;
  }

  if (platform === "facebook") {
    return pickSelectedFacebookAccount(matches);
  }

  if (platform === "instagram") {
    return pickSelectedInstagramAccount(matches);
  }

  if (platform === "threads") {
    return pickSelectedThreadsAccount(matches);
  }

  if (platform === "tiktok") {
    return pickSelectedTikTokAccount(matches);
  }

  if (platform === "x") {
    return pickSelectedXAccount(matches);
  }

  return (
    matches.find((account) => account.status === "connected") ??
    null
  );
}

export type StrictSelectedInstagramResult<T> =
  | { kind: "ready"; account: T }
  | { kind: "missing" }
  | { kind: "ambiguous" };

/**
 * Strict selected Instagram professional account:
 * exactly one connected + accessStatus=selected.
 */
export function pickSelectedInstagramAccountStrict<
  T extends SelectedPageCandidate,
>(
  accounts: readonly T[],
  connectionId?: string | null,
): StrictSelectedInstagramResult<T> {
  const instagram = accounts.filter((account) => {
    if (account.platform !== "instagram") return false;
    if (
      connectionId &&
      account.providerConnectionId &&
      account.providerConnectionId !== connectionId
    ) {
      return false;
    }
    return true;
  });

  const selected = instagram.filter(
    (account) =>
      account.status === "connected" &&
      account.accessStatus === "selected",
  );

  if (selected.length > 1) {
    return { kind: "ambiguous" };
  }
  if (selected.length === 1) {
    return { kind: "ready", account: selected[0]! };
  }

  return { kind: "missing" };
}

export function pickSelectedInstagramAccount<
  T extends SelectedPageCandidate,
>(accounts: readonly T[], connectionId?: string | null): T | null {
  const strict = pickSelectedInstagramAccountStrict(accounts, connectionId);
  if (strict.kind === "ready") {
    return strict.account;
  }

  if (strict.kind === "ambiguous") {
    return null;
  }

  const instagram = accounts.filter((account) => {
    if (account.platform !== "instagram") return false;
    if (
      connectionId &&
      account.providerConnectionId &&
      account.providerConnectionId !== connectionId
    ) {
      return false;
    }
    return true;
  });

  const connected = instagram.filter(
    (account) => account.status === "connected",
  );
  if (connected.length === 1) {
    return connected[0]!;
  }

  return null;
}

export type StrictSelectedThreadsResult<T> =
  | { kind: "ready"; account: T }
  | { kind: "missing" }
  | { kind: "ambiguous" };

export function pickSelectedThreadsAccountStrict<
  T extends SelectedPageCandidate,
>(
  accounts: readonly T[],
  connectionId?: string | null,
): StrictSelectedThreadsResult<T> {
  const threads = accounts.filter((account) => {
    if (account.platform !== "threads") return false;
    if (
      connectionId &&
      account.providerConnectionId &&
      account.providerConnectionId !== connectionId
    ) {
      return false;
    }
    return true;
  });

  const selected = threads.filter(
    (account) =>
      account.status === "connected" &&
      (account.accessStatus === "selected" ||
        account.accessStatus == null),
  );

  if (selected.length > 1) {
    return { kind: "ambiguous" };
  }
  if (selected.length === 1) {
    return { kind: "ready", account: selected[0]! };
  }

  return { kind: "missing" };
}

export function pickSelectedThreadsAccount<
  T extends SelectedPageCandidate,
>(accounts: readonly T[], connectionId?: string | null): T | null {
  const strict = pickSelectedThreadsAccountStrict(accounts, connectionId);
  if (strict.kind === "ready") {
    return strict.account;
  }

  if (strict.kind === "ambiguous") {
    return null;
  }

  const threads = accounts.filter((account) => {
    if (account.platform !== "threads") return false;
    if (
      connectionId &&
      account.providerConnectionId &&
      account.providerConnectionId !== connectionId
    ) {
      return false;
    }
    return true;
  });

  const connected = threads.filter(
    (account) => account.status === "connected",
  );
  if (connected.length === 1) {
    return connected[0]!;
  }

  return null;
}

export type StrictSelectedYoutubeResult<T> =
  | { kind: "ready"; account: T }
  | { kind: "missing" }
  | { kind: "ambiguous" };

export function pickSelectedYoutubeAccountStrict<
  T extends SelectedPageCandidate,
>(
  accounts: readonly T[],
  connectionId?: string | null,
): StrictSelectedYoutubeResult<T> {
  const youtube = accounts.filter((account) => {
    if (account.platform !== "youtube") return false;
    if (
      connectionId &&
      account.providerConnectionId &&
      account.providerConnectionId !== connectionId
    ) {
      return false;
    }
    return true;
  });

  const selected = youtube.filter(
    (account) =>
      account.status === "connected" &&
      (account.accessStatus === "selected" ||
        account.accessStatus == null),
  );

  if (selected.length > 1) {
    return { kind: "ambiguous" };
  }
  if (selected.length === 1) {
    return { kind: "ready", account: selected[0]! };
  }

  return { kind: "missing" };
}

export function pickSelectedYoutubeAccount<
  T extends SelectedPageCandidate,
>(accounts: readonly T[], connectionId?: string | null): T | null {
  const strict = pickSelectedYoutubeAccountStrict(accounts, connectionId);
  if (strict.kind === "ready") {
    return strict.account;
  }
  return null;
}

export type StrictSelectedTikTokResult<T> =
  | { kind: "ready"; account: T }
  | { kind: "missing" }
  | { kind: "ambiguous" };

export function pickSelectedTikTokAccountStrict<
  T extends SelectedPageCandidate,
>(
  accounts: readonly T[],
  connectionId?: string | null,
): StrictSelectedTikTokResult<T> {
  const tiktok = accounts.filter((account) => {
    if (account.platform !== "tiktok") return false;
    if (
      connectionId &&
      account.providerConnectionId &&
      account.providerConnectionId !== connectionId
    ) {
      return false;
    }
    return true;
  });

  const selected = tiktok.filter(
    (account) =>
      account.status === "connected" &&
      (account.accessStatus === "selected" ||
        account.accessStatus == null),
  );

  if (selected.length > 1) {
    return { kind: "ambiguous" };
  }
  if (selected.length === 1) {
    return { kind: "ready", account: selected[0]! };
  }

  return { kind: "missing" };
}

export function pickSelectedTikTokAccount<
  T extends SelectedPageCandidate,
>(accounts: readonly T[], connectionId?: string | null): T | null {
  const strict = pickSelectedTikTokAccountStrict(accounts, connectionId);
  if (strict.kind === "ready") {
    return strict.account;
  }

  if (strict.kind === "ambiguous") {
    return null;
  }

  const tiktok = accounts.filter((account) => {
    if (account.platform !== "tiktok") return false;
    if (
      connectionId &&
      account.providerConnectionId &&
      account.providerConnectionId !== connectionId
    ) {
      return false;
    }
    return true;
  });

  const connected = tiktok.filter(
    (account) => account.status === "connected",
  );
  if (connected.length === 1) {
    return connected[0]!;
  }

  return null;
}

export type StrictSelectedXResult<T> =
  | { kind: "ready"; account: T }
  | { kind: "missing" }
  | { kind: "ambiguous" };

export function pickSelectedXAccountStrict<
  T extends SelectedPageCandidate,
>(
  accounts: readonly T[],
  connectionId?: string | null,
): StrictSelectedXResult<T> {
  const xAccounts = accounts.filter((account) => {
    if (account.platform !== "x") return false;
    if (
      connectionId &&
      account.providerConnectionId &&
      account.providerConnectionId !== connectionId
    ) {
      return false;
    }
    return true;
  });

  const selected = xAccounts.filter(
    (account) =>
      account.status === "connected" &&
      (account.accessStatus === "selected" ||
        account.accessStatus == null),
  );

  if (selected.length > 1) {
    return { kind: "ambiguous" };
  }
  if (selected.length === 1) {
    return { kind: "ready", account: selected[0]! };
  }

  return { kind: "missing" };
}

export function pickSelectedXAccount<
  T extends SelectedPageCandidate,
>(accounts: readonly T[], connectionId?: string | null): T | null {
  const strict = pickSelectedXAccountStrict(accounts, connectionId);
  if (strict.kind === "ready") {
    return strict.account;
  }

  if (strict.kind === "ambiguous") {
    return null;
  }

  const xAccounts = accounts.filter((account) => {
    if (account.platform !== "x") return false;
    if (
      connectionId &&
      account.providerConnectionId &&
      account.providerConnectionId !== connectionId
    ) {
      return false;
    }
    return true;
  });

  const connected = xAccounts.filter(
    (account) => account.status === "connected",
  );
  if (connected.length === 1) {
    return connected[0]!;
  }

  return null;
}

/**
 * True when an incoming Meta subject differs from the brand’s live shell.
 * Callers must require explicit disconnect/replacement — never merge.
 */
export function requiresMetaUserReplacement(options: {
  existingExternalSubjectId: string | null | undefined;
  incomingExternalSubjectId: string | null | undefined;
}): boolean {
  const existing = options.existingExternalSubjectId?.trim() || "";
  const incoming = options.incomingExternalSubjectId?.trim() || "";
  if (!existing || !incoming) {
    return false;
  }
  return existing !== incoming;
}

/** Sanitized identity for UI — never includes Page/provider IDs. */
export type SelectedFacebookIdentity = {
  socialAccountId: string;
  connectionId: string;
  pageName: string;
  profileImageUrl: string | null;
  connectionStatus: string;
};
