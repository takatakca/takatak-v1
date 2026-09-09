/**
 * Pure social-connection lifecycle rules.
 * No I/O — safe for automated matrix tests and shared UI decisions.
 */

export type SocialLifecycleConnectionStatus =
  | "not_connected"
  | "pending_authorization"
  | "authorized"
  | "connected"
  | "reauthorization_required"
  | "disconnected"
  | "failed"
  | "expired"
  | "error"
  | "disabled"
  | string;

export type SocialLifecycleProviderState =
  | "planned"
  | "not_configured"
  | "ready_for_authorization"
  | string;

export type SocialLifecycleAction =
  | "start_connect"
  | "continue_authorization"
  | "cancel_pending"
  | "disconnect"
  | "add_another_account"
  | "reconnect";

export type LifecycleDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

export type OAuthAttemptLifecycleStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "expired"
  | "cancelled"
  | string;

export type OAuthAttemptSnapshot = {
  status: OAuthAttemptLifecycleStatus;
  expiresAt: Date | string;
  consumedAt: Date | string | null;
  hasAuthorizationUrl: boolean;
};

export type ContinueAttemptDecision =
  | { kind: "resume" }
  | { kind: "refresh"; reason: string }
  | { kind: "blocked"; reason: string };

/**
 * Facebook remains the Meta Page OAuth card.
 * Instagram and Threads use the Meta-linked account as the main path when a
 * Facebook Page is connected. Independent login is a second choice when the
 * account is not linked through Meta.
 */
export const META_PLATFORM_REPRESENTATION = {
  facebook: {
    platform: "facebook",
    independentlyImplemented: false,
    representedThrough: "meta",
    role: "primary_oauth_card",
    note:
      "Facebook is the primary Meta OAuth entry point. It is not a separate SocialConnectionProvider.",
  },
  instagram: {
    platform: "instagram",
    independentlyImplemented: true,
    representedThrough: "meta",
    role: "meta_primary_or_independent_oauth",
    note:
      "The Instagram professional account linked to the Facebook Page is the main path. Independent Instagram Login is available when that account is not linked through Meta.",
  },
  threads: {
    platform: "threads",
    independentlyImplemented: true,
    representedThrough: "meta",
    role: "meta_primary_or_independent_oauth",
    note:
      "The Threads profile linked through the Facebook Page and Instagram professional account is the main path. Independent Threads Login is available when that profile is not linked through Meta.",
  },
} as const;

export function isPendingAuthorizationStatus(
  status: SocialLifecycleConnectionStatus,
): boolean {
  return status === "pending_authorization";
}

export function isProtectedLiveStatus(
  status: SocialLifecycleConnectionStatus,
): boolean {
  return (
    status === "authorized" ||
    status === "connected"
  );
}

export function isLiveOrPendingStatus(
  status: SocialLifecycleConnectionStatus,
): boolean {
  return (
    isProtectedLiveStatus(status) ||
    isPendingAuthorizationStatus(status)
  );
}

/**
 * Cancel-pending restores Connect without touching live accounts.
 * Never allowed for authorized/connected.
 */
export function canCancelPendingConnection(
  status: SocialLifecycleConnectionStatus,
): LifecycleDecision {
  if (isProtectedLiveStatus(status)) {
    return {
      allowed: false,
      reason:
        "Authorized or connected providers cannot be changed by cancel-pending.",
    };
  }

  if (!isPendingAuthorizationStatus(status)) {
    return {
      allowed: false,
      reason:
        "Only a pending authorization can be cancelled this way.",
    };
  }

  return { allowed: true };
}

/**
 * Full disconnect removes usable credentials and disables assignments.
 * Pending shells must use cancel-pending instead.
 */
export function canDisconnectConnection(
  status: SocialLifecycleConnectionStatus,
): LifecycleDecision {
  if (isPendingAuthorizationStatus(status)) {
    return {
      allowed: false,
      reason:
        "Use cancel-pending to abandon an unfinished authorization.",
    };
  }

  if (
    status === "not_connected" ||
    status === "disabled"
  ) {
    return {
      allowed: false,
      reason:
        "This provider connection is not active.",
    };
  }

  return { allowed: true };
}

/**
 * Ordinary Connect start. Unimplemented / unconfigured providers never start.
 */
export function canStartProviderConnect(options: {
  implemented: boolean;
  connectable: boolean;
  providerState: SocialLifecycleProviderState;
  connectionStatus: SocialLifecycleConnectionStatus | null;
  isPrimaryStartCard: boolean;
}): LifecycleDecision {
  if (!options.implemented) {
    return {
      allowed: false,
      reason: "coming_soon",
    };
  }

  if (
    options.providerState === "planned" ||
    options.providerState === "not_configured" ||
    !options.connectable
  ) {
    return {
      allowed: false,
      reason:
        options.providerState === "not_configured"
          ? "not_configured"
          : "unavailable",
    };
  }

  if (!options.isPrimaryStartCard) {
    return {
      allowed: false,
      reason: "not_primary_card",
    };
  }

  if (options.connectionStatus === "connected") {
    return {
      allowed: false,
      reason: "already_connected",
    };
  }

  if (options.connectionStatus === "authorized") {
    return {
      allowed: false,
      reason: "already_authorized",
    };
  }

  if (
    options.connectionStatus ===
    "pending_authorization"
  ) {
    return {
      allowed: false,
      reason: "pending_authorization",
    };
  }

  return { allowed: true };
}

/**
 * Continue an unfinished pending authorization for the exact connection.
 */
export function canContinueAuthorization(options: {
  implemented: boolean;
  connectable: boolean;
  providerState: SocialLifecycleProviderState;
  connectionStatus: SocialLifecycleConnectionStatus;
  isPrimaryStartCard: boolean;
}): LifecycleDecision {
  if (!options.implemented) {
    return {
      allowed: false,
      reason: "coming_soon",
    };
  }

  if (
    options.providerState === "planned" ||
    options.providerState === "not_configured" ||
    !options.connectable
  ) {
    return {
      allowed: false,
      reason:
        options.providerState === "not_configured"
          ? "not_configured"
          : "unavailable",
    };
  }

  if (!options.isPrimaryStartCard) {
    return {
      allowed: false,
      reason: "not_primary_card",
    };
  }

  if (!isPendingAuthorizationStatus(options.connectionStatus)) {
    return {
      allowed: false,
      reason:
        "Continue is only available for a pending authorization.",
    };
  }

  return { allowed: true };
}

/**
 * Decide whether to resume the stored attempt or cancel + mint a fresh one.
 */
export function evaluateOAuthAttemptForContinue(
  attempt: OAuthAttemptSnapshot | null,
  now: Date = new Date(),
): ContinueAttemptDecision {
  if (!attempt) {
    return {
      kind: "refresh",
      reason: "missing_attempt",
    };
  }

  const expiresAt =
    attempt.expiresAt instanceof Date
      ? attempt.expiresAt
      : new Date(attempt.expiresAt);

  const expired =
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= now.getTime();

  const consumed = attempt.consumedAt !== null;

  if (
    attempt.status === "processing" &&
    !expired &&
    !consumed
  ) {
    return {
      kind: "blocked",
      reason: "authorization_in_progress",
    };
  }

  if (
    attempt.status === "pending" &&
    !expired &&
    !consumed &&
    attempt.hasAuthorizationUrl
  ) {
    return { kind: "resume" };
  }

  if (consumed) {
    return {
      kind: "refresh",
      reason: "consumed",
    };
  }

  if (expired) {
    return {
      kind: "refresh",
      reason: "expired",
    };
  }

  if (!attempt.hasAuthorizationUrl) {
    return {
      kind: "refresh",
      reason: "missing_authorization_url",
    };
  }

  return {
    kind: "refresh",
    reason: "unusable",
  };
}

/**
 * Add another account creates a NEW connection for multi-account providers.
 * Never reuses, demotes, or disconnects an authorized/connected row.
 */
export function canAddAnotherAccount(options: {
  implemented: boolean;
  connectable: boolean;
  providerState: SocialLifecycleProviderState;
  supportsMultipleAccounts: boolean;
  sourceConnectionStatus: SocialLifecycleConnectionStatus;
  isPrimaryStartCard: boolean;
  hasPendingForProviderBrand: boolean;
}): LifecycleDecision {
  if (!options.implemented) {
    return {
      allowed: false,
      reason: "coming_soon",
    };
  }

  if (!options.supportsMultipleAccounts) {
    return {
      allowed: false,
      reason: "multiple_accounts_unsupported",
    };
  }

  if (
    options.providerState === "planned" ||
    options.providerState === "not_configured" ||
    !options.connectable
  ) {
    return {
      allowed: false,
      reason:
        options.providerState === "not_configured"
          ? "not_configured"
          : "unavailable",
    };
  }

  if (!options.isPrimaryStartCard) {
    return {
      allowed: false,
      reason: "not_primary_card",
    };
  }

  if (!isProtectedLiveStatus(options.sourceConnectionStatus)) {
    return {
      allowed: false,
      reason:
        "Add another account is only available from an authorized or connected provider connection.",
    };
  }

  if (options.hasPendingForProviderBrand) {
    return {
      allowed: false,
      reason:
        "A pending authorization already exists for this provider. Continue or cancel it first.",
    };
  }

  return { allowed: true };
}

export function connectionMatchesProviderScope(options: {
  connectionProvider: string;
  expectedProvider: string;
}): LifecycleDecision {
  if (
    options.connectionProvider !==
    options.expectedProvider
  ) {
    return {
      allowed: false,
      reason:
        "The selected connection does not belong to this provider.",
    };
  }

  return { allowed: true };
}

export function resolveProviderCardLabel(options: {
  implemented: boolean;
  connectable: boolean;
  providerState: SocialLifecycleProviderState;
  connectionStatus: SocialLifecycleConnectionStatus | null;
  isPrimaryStartCard: boolean;
  busy: boolean;
  defaultActionLabel: string;
}): string {
  if (options.busy) {
    return "Starting authorization...";
  }

  if (!options.implemented) {
    return "Coming soon";
  }

  if (options.providerState === "planned") {
    return "Coming soon";
  }

  if (options.providerState === "not_configured") {
    return "Not configured";
  }

  if (
    options.connectionStatus === "connected"
  ) {
    return "Connected";
  }

  if (
    options.connectionStatus === "authorized"
  ) {
    return "Authorized";
  }

  if (
    options.connectionStatus ===
    "pending_authorization"
  ) {
    return "Authorization pending";
  }

  if (
    options.connectionStatus === "disconnected" ||
    options.connectionStatus === "expired" ||
    options.connectionStatus === "error" ||
    options.connectionStatus === "failed" ||
    options.connectionStatus ===
      "reauthorization_required"
  ) {
    return "Reconnect";
  }

  if (!options.isPrimaryStartCard) {
    return "Connect via Facebook";
  }

  if (!options.connectable) {
    return "Unavailable";
  }

  return options.defaultActionLabel;
}

/**
 * Main path: attach the Instagram professional account already linked to
 * a selected Facebook Page. Independent Instagram Login is the second
 * choice when that account is not linked through Meta.
 */
export function canAttachLinkedInstagram(options: {
  facebookPageSelected: boolean;
  instagramAlreadyConnected: boolean;
  connectionStatus: SocialLifecycleConnectionStatus | null;
}): LifecycleDecision {
  if (options.instagramAlreadyConnected) {
    return {
      allowed: false,
      reason: "already_connected",
    };
  }

  if (options.connectionStatus !== "connected") {
    return {
      allowed: false,
      reason: "facebook_not_connected",
    };
  }

  if (!options.facebookPageSelected) {
    return {
      allowed: false,
      reason: "facebook_page_required",
    };
  }

  return { allowed: true };
}

/**
 * Main path: attach the Threads profile that belongs to the Instagram
 * professional account linked to the Facebook Page. Independent Threads
 * Login is the second choice when that profile is not linked through Meta.
 */
export function canAttachLinkedThreads(options: {
  facebookPageSelected: boolean;
  metaInstagramConnected: boolean;
  threadsAlreadyConnected: boolean;
  connectionStatus: SocialLifecycleConnectionStatus | null;
}): LifecycleDecision {
  if (options.threadsAlreadyConnected) {
    return {
      allowed: false,
      reason: "already_connected",
    };
  }

  if (options.connectionStatus !== "connected") {
    return {
      allowed: false,
      reason: "facebook_not_connected",
    };
  }

  if (!options.facebookPageSelected) {
    return {
      allowed: false,
      reason: "facebook_page_required",
    };
  }

  if (!options.metaInstagramConnected) {
    return {
      allowed: false,
      reason: "instagram_required",
    };
  }

  return { allowed: true };
}

/**
 * True only when the provider connection has finished Page selection.
 * Discovery upserts (authorized + not_connected accounts) must not look Connected.
 */
export function isProviderPlatformConnected(options: {
  connectionStatus: string | null | undefined;
  accountStatus?: string | null;
  /** When the card maps to a concrete platform account (e.g. facebook). */
  requiresConnectedAccount: boolean;
}): boolean {
  if (options.connectionStatus !== "connected") {
    return false;
  }

  if (!options.requiresConnectedAccount) {
    return true;
  }

  return options.accountStatus === "connected";
}

/** User-facing account label — never Facebook Page IDs. */
export function resolveConnectedAccountLabel(options: {
  displayName: string | null | undefined;
  handle: string | null | undefined;
}): string | null {
  const name = options.displayName?.trim();
  if (name) {
    return name;
  }

  const handle = options.handle?.trim();
  if (handle) {
    return handle;
  }

  return null;
}
