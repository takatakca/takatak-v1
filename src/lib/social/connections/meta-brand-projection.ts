/**
 * Single canonical Meta / Facebook surface projection.
 * All UI surfaces (selector, sidebar, manage connections, dashboard, onboarding)
 * must derive Facebook state from this model — never independently from Page rows alone.
 */

export type MetaSurfaceState =
  | "connected_healthy"
  | "action_required"
  | "reauthorization_pending"
  | "refresh_failed"
  | "authorized_needs_page"
  | "disconnected";

export type MetaSurfaceProjection = {
  state: MetaSurfaceState;
  /** Safe Page display name — never an ID. */
  pageName: string | null;
  profileImageUrl: string | null;
  /** Show Facebook platform icon (true for all states except disconnected). */
  showFacebookIcon: boolean;
  attentionRequired: boolean;
  manageLabel: string;
  /** Internal — server routes only. */
  connectionId: string | null;
  socialAccountId: string | null;
  connectionStatus: string | null;
  lastErrorCode: string | null;
  syncStatus: string | null;
};

export type MetaProjectionInputs = {
  connection: {
    id: string;
    status: string;
    lastErrorCode?: string | null;
  } | null;
  selectedPage: {
    id: string;
    displayName?: string | null;
    handle?: string | null;
    profileImageUrl?: string | null;
    status: string;
    accessStatus?: string | null;
  } | null;
  syncStatus?: string | null;
  /** True when a pending/processing OAuth attempt exists for this connection. */
  hasPendingOAuthAttempt?: boolean;
};

/**
 * Pure projection — deterministic, identifier-safe for UI labels.
 */
export function projectMetaBrandSurface(
  input: MetaProjectionInputs,
): MetaSurfaceProjection {
  const connection = input.connection;
  const page = input.selectedPage;
  const pageName =
    page?.displayName?.trim() ||
    page?.handle?.trim() ||
    null;
  const profileImageUrl = page?.profileImageUrl?.trim() || null;
  const errorCode = connection?.lastErrorCode ?? null;
  const syncStatus = input.syncStatus ?? null;

  const base = {
    pageName,
    profileImageUrl,
    connectionId: connection?.id ?? null,
    socialAccountId: page?.id ?? null,
    connectionStatus: connection?.status ?? null,
    lastErrorCode: errorCode,
    syncStatus,
  };

  if (!connection) {
    return {
      ...base,
      state: "disconnected",
      showFacebookIcon: false,
      attentionRequired: false,
      manageLabel: "Connect a Facebook page",
    };
  }

  const pending = input.hasPendingOAuthAttempt === true;

  if (pending || errorCode === "reauthorization_pending") {
    // Stale reauthorization_pending without a live OAuth attempt should not
    // trap the UI on "Reconnecting…".
    if (!pending && errorCode === "reauthorization_pending") {
      return {
        ...base,
        state: "action_required",
        showFacebookIcon: true,
        attentionRequired: true,
        manageLabel: "Reconnect Facebook",
      };
    }

    return {
      ...base,
      state: "reauthorization_pending",
      showFacebookIcon: true,
      attentionRequired: true,
      manageLabel: "Reconnecting",
    };
  }

  if (
    errorCode === "reauthorization_failed" ||
    errorCode === "oauth_callback_failed" ||
    connection.status === "failed" ||
    connection.status === "expired" ||
    connection.status === "error"
  ) {
    const hasRecoverablePage =
      page?.status === "connected" &&
      page.accessStatus === "selected";

    // Failed shell with no selected Page looks disconnected — allow Connect.
    if (!hasRecoverablePage) {
      return {
        ...base,
        pageName: null,
        profileImageUrl: null,
        state: "disconnected",
        showFacebookIcon: false,
        attentionRequired: false,
        manageLabel: "Connect a Facebook page",
      };
    }

    return {
      ...base,
      state: "refresh_failed",
      showFacebookIcon: true,
      attentionRequired: true,
      manageLabel: "Reconnect failed; try again",
    };
  }

  if (
    connection.status === "reauthorization_required" ||
    errorCode === "authorization_expired" ||
    syncStatus === "action_required"
  ) {
    return {
      ...base,
      state: "action_required",
      showFacebookIcon: true,
      attentionRequired: true,
      manageLabel: "Reconnect Facebook",
    };
  }

  if (connection.status === "authorized") {
    return {
      ...base,
      state: "authorized_needs_page",
      showFacebookIcon: Boolean(page),
      attentionRequired: !page,
      manageLabel: page ? "Authorized" : "Select a Facebook page",
    };
  }

  if (
    connection.status === "connected" &&
    page?.status === "connected" &&
    page.accessStatus === "selected"
  ) {
    return {
      ...base,
      state: "connected_healthy",
      showFacebookIcon: true,
      attentionRequired: false,
      manageLabel: "Connected",
    };
  }

  if (
    connection.status === "connected" ||
    connection.status === "pending_authorization"
  ) {
    return {
      ...base,
      state:
        connection.status === "pending_authorization"
          ? "reauthorization_pending"
          : "authorized_needs_page",
      showFacebookIcon: connection.status === "connected",
      attentionRequired: true,
      manageLabel:
        connection.status === "pending_authorization"
          ? "Reconnecting"
          : "Select a Facebook page",
    };
  }

  return {
    ...base,
    state: "disconnected",
    showFacebookIcon: false,
    attentionRequired: false,
    manageLabel: "Connect a Facebook page",
  };
}
