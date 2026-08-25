"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Building2,
  Cable,
  CircleAlert,
  Loader2,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Unplug,
  Users,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  canAddAnotherAccount,
  canCancelPendingConnection,
  canContinueAuthorization,
  canStartProviderConnect,
  resolveProviderCardLabel,
} from "@/lib/social/connections/social-connection-lifecycle-policy";

type ProviderKey =
  | "meta"
  | "google"
  | "linkedin"
  | "tiktok"
  | "pinterest"
  | "x"
  | "bluesky"
  | "twitch";

type ProviderState =
  | "planned"
  | "not_configured"
  | "ready_for_authorization";

export type SocialAccountsProvider = {
  provider: ProviderKey;
  label: string;
  description: string;
  platforms: string[];
  authorizationType:
    | "oauth2"
    | "oauth2_pkce"
    | "app_password";
  implemented: boolean;
  connectable: boolean;
  configured: boolean;
  supportsMultipleAccounts: boolean;
  state: ProviderState;
};

export type SocialAccountsBrand = {
  id: string;
  name: string;
  status: string;
};

export type SocialAccountsConnectionAccount = {
  id: string;
  platform: string;
  externalAccountId: string | null;
  handle: string | null;
  displayName: string | null;
  status: string;
};

export type SocialAccountsConnection = {
  id: string;
  provider: string;
  status: string;
  displayName: string | null;
  externalSubjectId: string | null;
  scopes: string[];
  brandId: string;
  brandName: string;
  brandStatus: string;
  hasCredential: boolean;
  accountCount: number;
  accounts: SocialAccountsConnectionAccount[];
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastValidatedAt: string | null;
  lastSyncAt: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type Notice = {
  tone:
    | "success"
    | "error"
    | "info";
  message: string;
};

type ApiResult = {
  ok?: boolean;
  message?: string;

  authorization?: {
    authorizationUrl?: string;
  };

  connection?: {
    id?: string;
    status?: string;
    disconnectedAt?: string;
    cancelledAt?: string;
  };
};

const PLATFORM_LABELS: Record<
  string,
  string
> = {
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  google_business:
    "Google Business Profile",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  x: "X",
  bluesky: "Bluesky",
  twitch: "Twitch",
};

function providerStateLabel(
  state: ProviderState,
): string {
  switch (state) {
    case "ready_for_authorization":
      return "Ready";
    case "not_configured":
      return "Configuration required";
    default:
      return "Planned";
  }
}

function providerStateTone(
  state: ProviderState,
):
  | "success"
  | "warning"
  | "accent" {
  switch (state) {
    case "ready_for_authorization":
      return "success";
    case "not_configured":
      return "warning";
    default:
      return "accent";
  }
}

function connectionStatusLabel(
  status: string,
): string {
  const labels: Record<
    string,
    string
  > = {
    not_connected:
      "Not connected",
    pending_authorization:
      "Authorization pending",
    authorized: "Authorized",
    connected: "Connected",
    expired: "Expired",
    error: "Error",
    disconnected:
      "Disconnected",
    disabled: "Disabled",
  };

  return (
    labels[status] ??
    status.replaceAll("_", " ")
  );
}

function connectionStatusTone(
  status: string,
):
  | "neutral"
  | "accent"
  | "warning"
  | "muted"
  | "success"
  | "danger" {
  switch (status) {
    case "authorized":
    case "connected":
      return "success";

    case "pending_authorization":
      return "warning";

    case "expired":
    case "error":
      return "danger";

    case "disconnected":
    case "disabled":
      return "muted";

    case "not_connected":
      return "warning";

    default:
      return "neutral";
  }
}

function authorizationLabel(
  authorizationType:
    SocialAccountsProvider["authorizationType"],
): string {
  switch (authorizationType) {
    case "oauth2_pkce":
      return "OAuth 2.0 + PKCE";

    case "app_password":
      return "Application password";

    default:
      return "OAuth 2.0";
  }
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Unknown";
  }

  return date.toLocaleString(
    "en-CA",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}

async function readApiResult(
  response: Response,
): Promise<ApiResult> {
  try {
    return (
      (await response.json()) as ApiResult
    );
  } catch {
    return {
      ok: false,
      message:
        "The server returned an invalid response.",
    };
  }
}

export function SocialAccountsManager({
  providers,
  brands,
  initialConnections,
  initialSelectedBrandId,
  canManage,
  dataMessage,
}: {
  providers: SocialAccountsProvider[];
  brands: SocialAccountsBrand[];
  initialConnections: SocialAccountsConnection[];
  initialSelectedBrandId: string;
  canManage: boolean;
  dataMessage?: string | null;
}) {
  const router = useRouter();

  const [
    selectedBrandId,
    setSelectedBrandId,
  ] = useState(
    initialSelectedBrandId,
  );

  const [
    connections,
    setConnections,
  ] = useState(
    initialConnections,
  );

  const [
    busyProvider,
    setBusyProvider,
  ] = useState<
    ProviderKey | null
  >(null);

  const connectInFlightRef =
    useRef(false);

  const [
    busyConnectionId,
    setBusyConnectionId,
  ] = useState<
    string | null
  >(null);

  const [
    notice,
    setNotice,
  ] =
    useState<Notice | null>(
      null,
    );

  const selectedBrand =
    brands.find(
      (brand) =>
        brand.id ===
        selectedBrandId,
    ) ?? null;

  const visibleConnections =
    useMemo(
      () =>
        selectedBrandId
          ? connections.filter(
              (connection) =>
                connection.brandId ===
                selectedBrandId,
            )
          : connections,
      [
        connections,
        selectedBrandId,
      ],
    );

  function connectionForProvider(
    provider: ProviderKey,
  ): SocialAccountsConnection | null {
    if (!selectedBrandId) {
      return null;
    }

    return (
      connections.find(
        (connection) =>
          connection.brandId ===
            selectedBrandId &&
          connection.provider ===
            provider,
      ) ?? null
    );
  }

  async function connectProvider(
    provider: ProviderKey,
  ) {
    if (
      connectInFlightRef.current ||
      busyProvider !== null ||
      busyConnectionId !== null
    ) {
      return;
    }

    if (!selectedBrandId) {
      setNotice({
        tone: "error",
        message:
          "Select a brand before connecting a provider.",
      });

      return;
    }

    if (!canManage) {
      setNotice({
        tone: "error",
        message:
          "You do not have permission to manage social connections.",
      });

      return;
    }

    const providerMeta = providers.find(
      (item) => item.provider === provider,
    );

    if (!providerMeta) {
      setNotice({
        tone: "error",
        message:
          "This provider is not available in the workspace registry.",
      });

      return;
    }

    const existing =
      connectionForProvider(provider);

    const startDecision = canStartProviderConnect({
      implemented: providerMeta.implemented,
      connectable: providerMeta.connectable,
      providerState: providerMeta.state,
      connectionStatus: existing?.status ?? null,
      isPrimaryStartCard: true,
    });

    if (!startDecision.allowed) {
      setNotice({
        tone: "info",
        message:
          startDecision.reason === "coming_soon"
            ? `${providerMeta.label} is coming soon.`
            : startDecision.reason ===
                "pending_authorization"
              ? "An authorization is already pending. Cancel it before starting again."
              : `${providerMeta.label} cannot start authorization right now.`,
      });

      return;
    }

    connectInFlightRef.current = true;
    setBusyProvider(provider);
    setNotice(null);

    let redirected = false;

    try {
      const response =
        await fetch(
          "/api/social/connections/start",
          {
            method: "POST",
            credentials:
              "same-origin",

            headers: {
              Accept:
                "application/json",

              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              provider,
              businessBrandId:
                selectedBrandId,

              returnPath:
                "/dashboard/social/accounts",
            }),
          },
        );

      const result =
        await readApiResult(
          response,
        );

      if (
        !response.ok ||
        !result.ok
      ) {
        setNotice({
          tone: "error",
          message:
            result.message ??
            "The provider connection could not be started.",
        });

        return;
      }

      const authorizationUrl =
        result.authorization
          ?.authorizationUrl;

      if (authorizationUrl) {
        redirected = true;
        window.location.assign(
          authorizationUrl,
        );

        return;
      }

      setNotice({
        tone: "info",
        message:
          result.message ??
          "The provider authorization request was prepared, but no redirect URL is available yet.",
      });

      router.refresh();
    } catch {
      setNotice({
        tone: "error",
        message:
          "A network error occurred while starting the provider connection.",
      });
    } finally {
      if (!redirected) {
        connectInFlightRef.current = false;
        setBusyProvider(null);
      }
    }
  }

  async function cancelPendingProvider(
    connection: SocialAccountsConnection,
  ) {
    if (!canManage) {
      setNotice({
        tone: "error",
        message:
          "You do not have permission to manage social connections.",
      });

      return;
    }

    const decision = canCancelPendingConnection(
      connection.status,
    );

    if (!decision.allowed) {
      setNotice({
        tone: "error",
        message: decision.reason,
      });

      return;
    }

    if (busyConnectionId !== null) {
      return;
    }

    setBusyConnectionId(connection.id);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/social/connections/${encodeURIComponent(
          connection.id,
        )}/cancel-pending?provider=${encodeURIComponent(
          connection.provider,
        )}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const result = await readApiResult(response);

      if (!response.ok || !result.ok) {
        setNotice({
          tone: "error",
          message:
            result.message ??
            "The pending authorization could not be cancelled.",
        });

        return;
      }

      setConnections((current) =>
        current.map((item) =>
          item.id === connection.id
            ? {
                ...item,
                status:
                  result.connection?.status ??
                  "not_connected",
                hasCredential: false,
                accountCount: 0,
                accounts: [],
                lastErrorMessage: null,
              }
            : item,
        ),
      );

      setNotice({
        tone: "success",
        message:
          result.message ??
          "Pending authorization cancelled. You can connect again.",
      });

      router.refresh();
    } catch {
      setNotice({
        tone: "error",
        message:
          "A network error occurred while cancelling the pending authorization.",
      });
    } finally {
      setBusyConnectionId(null);
    }
  }

  async function continuePendingProvider(
    connection: SocialAccountsConnection,
  ) {
    if (!canManage) {
      setNotice({
        tone: "error",
        message:
          "You do not have permission to manage social connections.",
      });

      return;
    }

    if (
      connectInFlightRef.current ||
      busyProvider !== null ||
      busyConnectionId !== null
    ) {
      return;
    }

    const providerMeta = providers.find(
      (item) => item.provider === connection.provider,
    );

    if (!providerMeta) {
      return;
    }

    const decision = canContinueAuthorization({
      implemented: providerMeta.implemented,
      connectable: providerMeta.connectable,
      providerState: providerMeta.state,
      connectionStatus: connection.status,
      isPrimaryStartCard: true,
    });

    if (!decision.allowed) {
      setNotice({
        tone: "error",
        message: decision.reason,
      });

      return;
    }

    connectInFlightRef.current = true;
    setBusyConnectionId(connection.id);
    setBusyProvider(connection.provider as ProviderKey);
    setNotice(null);

    let redirected = false;

    try {
      const response = await fetch(
        `/api/social/connections/${encodeURIComponent(
          connection.id,
        )}/continue?provider=${encodeURIComponent(
          connection.provider,
        )}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            returnPath: "/dashboard/social/accounts",
          }),
        },
      );

      const result = await readApiResult(response);

      if (!response.ok || !result.ok) {
        setNotice({
          tone: "error",
          message:
            result.message ??
            "The pending authorization could not be continued.",
        });

        return;
      }

      const authorizationUrl =
        result.authorization?.authorizationUrl;

      if (authorizationUrl) {
        redirected = true;
        window.location.assign(authorizationUrl);
        return;
      }

      setNotice({
        tone: "info",
        message:
          result.message ??
          "Continue prepared, but no authorization URL is available.",
      });

      router.refresh();
    } catch {
      setNotice({
        tone: "error",
        message:
          "A network error occurred while continuing authorization.",
      });
    } finally {
      if (!redirected) {
        connectInFlightRef.current = false;
        setBusyConnectionId(null);
        setBusyProvider(null);
      }
    }
  }

  async function addAnotherAccount(
    connection: SocialAccountsConnection,
  ) {
    if (!canManage) {
      setNotice({
        tone: "error",
        message:
          "You do not have permission to manage social connections.",
      });

      return;
    }

    if (
      connectInFlightRef.current ||
      busyProvider !== null ||
      busyConnectionId !== null
    ) {
      return;
    }

    const providerMeta = providers.find(
      (item) => item.provider === connection.provider,
    );

    if (!providerMeta) {
      return;
    }

    const hasPending = connections.some(
      (item) =>
        item.brandId === connection.brandId &&
        item.provider === connection.provider &&
        item.status === "pending_authorization",
    );

    const decision = canAddAnotherAccount({
      implemented: providerMeta.implemented,
      connectable: providerMeta.connectable,
      providerState: providerMeta.state,
      supportsMultipleAccounts:
        providerMeta.supportsMultipleAccounts,
      sourceConnectionStatus: connection.status,
      isPrimaryStartCard: true,
      hasPendingForProviderBrand: hasPending,
    });

    if (!decision.allowed) {
      setNotice({
        tone: "info",
        message:
          decision.reason === "multiple_accounts_unsupported"
            ? `${providerMeta.label} does not support adding another account yet.`
            : decision.reason,
      });

      return;
    }

    connectInFlightRef.current = true;
    setBusyConnectionId(connection.id);
    setBusyProvider(connection.provider as ProviderKey);
    setNotice(null);

    let redirected = false;

    try {
      const response = await fetch(
        "/api/social/connections/add-another",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceConnectionId: connection.id,
            provider: connection.provider,
            returnPath: "/dashboard/social/accounts",
          }),
        },
      );

      const result = await readApiResult(response);

      if (!response.ok || !result.ok) {
        setNotice({
          tone: "error",
          message:
            result.message ??
            "Another account authorization could not be started.",
        });

        return;
      }

      const authorizationUrl =
        result.authorization?.authorizationUrl;

      if (authorizationUrl) {
        redirected = true;
        window.location.assign(authorizationUrl);
        return;
      }

      setNotice({
        tone: "info",
        message:
          result.message ??
          "Another account request was prepared, but no authorization URL is available.",
      });

      router.refresh();
    } catch {
      setNotice({
        tone: "error",
        message:
          "A network error occurred while starting another account.",
      });
    } finally {
      if (!redirected) {
        connectInFlightRef.current = false;
        setBusyConnectionId(null);
        setBusyProvider(null);
      }
    }
  }

  async function disconnectProvider(
    connection:
      SocialAccountsConnection,
  ) {
    if (!canManage) {
      setNotice({
        tone: "error",
        message:
          "You do not have permission to disconnect social providers.",
      });

      return;
    }

    if (
      connection.status ===
      "pending_authorization"
    ) {
      setNotice({
        tone: "info",
        message:
          "Use Cancel pending to abandon an unfinished authorization without disconnecting a live account.",
      });

      return;
    }

    const confirmed =
      window.confirm(
        `Disconnect ${connection.provider} from ${connection.brandName}? Encrypted credentials will be removed.`,
      );

    if (!confirmed) {
      return;
    }

    if (busyConnectionId !== null) {
      return;
    }

    setBusyConnectionId(
      connection.id,
    );
    setNotice(null);

    try {
      const response = await fetch(
        `/api/social/connections/${encodeURIComponent(
          connection.id,
        )}?provider=${encodeURIComponent(
          connection.provider,
        )}`,
        {
          method: "DELETE",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const result =
        await readApiResult(response);

      if (!response.ok || !result.ok) {
        setNotice({
          tone: "error",
          message:
            result.message ??
            "The provider could not be disconnected.",
        });

        return;
      }

      setConnections((current) =>
        current.map((item) =>
          item.id === connection.id
            ? {
                ...item,
                status: "disconnected",
                hasCredential: false,
                accountCount: 0,
                accounts: [],
                disconnectedAt:
                  result.connection
                    ?.disconnectedAt ??
                  new Date().toISOString(),
                lastErrorMessage: null,
              }
            : item,
        ),
      );

      setNotice({
        tone: "success",
        message:
          result.message ??
          "The social provider was disconnected successfully.",
      });

      router.refresh();
    } catch {
      setNotice({
        tone: "error",
        message:
          "A network error occurred while disconnecting the provider.",
      });
    } finally {
      setBusyConnectionId(null);
    }
  }

  if (brands.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <Building2 className="mx-auto h-9 w-9 text-slate-400" />

        <h2 className="mt-4 text-base font-semibold text-slate-950">
          Create a brand first
        </h2>

        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
          Every provider connection must
          belong to a real brand inside the
          active workspace.
        </p>

        <Link
          href="/dashboard/brands/new"
          className="mt-5 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          Create brand
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {dataMessage ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />

          <span>{dataMessage}</span>
        </div>
      ) : null}

      {notice ? (
        <div
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            notice.tone ===
            "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : notice.tone ===
                  "error"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-indigo-200 bg-indigo-50 text-indigo-900"
          }`}
        >
          {notice.tone ===
          "success" ? (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          ) : notice.tone ===
            "error" ? (
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <PlugZap className="mt-0.5 h-4 w-4 shrink-0" />
          )}

          <span>{notice.message}</span>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <label
              htmlFor="social-brand"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Brand context
            </label>

            <select
              id="social-brand"
              value={
                selectedBrandId
              }
              onChange={(event) => {
                setSelectedBrandId(
                  event.target.value,
                );

                setNotice(null);
              }}
              className="mt-2 block min-w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500"
            >
              <option value="">
                All brands — select one to connect
              </option>

              {brands.map(
                (brand) => (
                  <option
                    key={brand.id}
                    value={brand.id}
                  >
                    {brand.name}
                    {brand.status !==
                    "active"
                      ? ` — ${brand.status}`
                      : ""}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="text-sm text-slate-500">
            {selectedBrand ? (
              <>
                Managing providers for{" "}
                <span className="font-medium text-slate-900">
                  {
                    selectedBrand.name
                  }
                </span>
              </>
            ) : (
              "Select a brand to begin a connection."
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Direct provider connections
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Connections use each
              platform&apos;s official
              authorization system. TAKATAK
              does not request social account
              passwords.
            </p>
          </div>

          <Badge tone="neutral">
            {providers.length} providers
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {providers.map(
            (provider) => {
              const connection =
                connectionForProvider(
                  provider.provider,
                );

              const busy =
                busyProvider ===
                provider.provider;

              const startDecision =
                canStartProviderConnect({
                  implemented:
                    provider.implemented,
                  connectable:
                    provider.connectable,
                  providerState:
                    provider.state,
                  connectionStatus:
                    connection?.status ??
                    null,
                  isPrimaryStartCard: true,
                });

              const disabled =
                busy ||
                !canManage ||
                !selectedBrandId ||
                !startDecision.allowed ||
                busyConnectionId !== null;

              const actionLabel =
                resolveProviderCardLabel({
                  implemented:
                    provider.implemented,
                  connectable:
                    provider.connectable,
                  providerState:
                    provider.state,
                  connectionStatus:
                    connection?.status ??
                    null,
                  isPrimaryStartCard: true,
                  busy,
                  defaultActionLabel:
                    !canManage
                      ? "View only"
                      : !selectedBrandId
                        ? "Select brand"
                        : "Connect",
                });

              return (
                <article
                  key={
                    provider.provider
                  }
                  className="flex min-h-72 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                      <Cable className="h-5 w-5" />
                    </span>

                    <Badge
                      tone={
                        connection
                          ? connectionStatusTone(
                              connection.status,
                            )
                          : providerStateTone(
                              provider.state,
                            )
                      }
                    >
                      {connection
                        ? connectionStatusLabel(
                            connection.status,
                          )
                        : provider.implemented
                          ? providerStateLabel(
                              provider.state,
                            )
                          : "Coming soon"}
                    </Badge>
                  </div>

                  <h3 className="mt-4 font-semibold text-slate-950">
                    {provider.label}
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {
                      provider.description
                    }
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {provider.platforms.map(
                      (platform) => (
                        <span
                          key={
                            platform
                          }
                          className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"
                        >
                          {PLATFORM_LABELS[
                            platform
                          ] ??
                            platform}
                        </span>
                      ),
                    )}
                  </div>

                  <div className="mt-4 space-y-1 text-xs text-slate-500">
                    <p>
                      Authorization:{" "}
                      <span className="font-medium text-slate-700">
                        {authorizationLabel(
                          provider.authorizationType,
                        )}
                      </span>
                    </p>

                    <p>
                      App configuration:{" "}
                      <span className="font-medium text-slate-700">
                        {provider.configured
                          ? "Detected"
                          : "Not configured"}
                      </span>
                    </p>

                    {connection ? (
                      <p>
                        Imported accounts:{" "}
                        <span className="font-medium text-slate-700">
                          {
                            connection.accountCount
                          }
                        </span>
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      connectProvider(
                        provider.provider,
                      )
                    }
                    className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : connection?.status ===
                      "pending_authorization" ? (
                      <Loader2 className="h-4 w-4" />
                    ) : connection ? (
                      <RefreshCw className="h-4 w-4" />
                    ) : (
                      <PlugZap className="h-4 w-4" />
                    )}

                    {busy
                      ? "Checking…"
                      : actionLabel}
                  </button>

                  {canManage &&
                  connection &&
                  canCancelPendingConnection(
                    connection.status,
                  ).allowed ? (
                    <button
                      type="button"
                      disabled={
                        busyConnectionId ===
                        connection.id
                      }
                      onClick={() =>
                        void cancelPendingProvider(
                          connection,
                        )
                      }
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyConnectionId ===
                      connection.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}

                      Cancel pending
                    </button>
                  ) : null}
                </article>
              );
            },
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Workspace connections
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Stored connection records never
              expose provider tokens in the
              browser.
            </p>
          </div>

          <Badge tone="neutral">
            {visibleConnections.length}{" "}
            connection
            {visibleConnections.length ===
            1
              ? ""
              : "s"}
          </Badge>
        </div>

        {visibleConnections.length ===
        0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-400" />

            <h3 className="mt-3 font-semibold text-slate-950">
              No native connections yet
            </h3>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
              Select a brand and choose a
              provider above. Planned providers
              will return an honest readiness
              message until their real adapter
              is implemented.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleConnections.map(
              (connection) => {
                const provider =
                  providers.find(
                    (item) =>
                      item.provider ===
                      connection.provider,
                  );

                const disconnecting =
                  busyConnectionId ===
                  connection.id;

                return (
                  <article
                    key={
                      connection.id
                    }
                    className="rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-950">
                            {provider
                              ?.label ??
                              connection.provider}
                          </h3>

                          <Badge
                            tone={connectionStatusTone(
                              connection.status,
                            )}
                          >
                            {connectionStatusLabel(
                              connection.status,
                            )}
                          </Badge>

                          <Badge
                            tone={
                              connection.hasCredential
                                ? "success"
                                : "muted"
                            }
                          >
                            {connection.hasCredential
                              ? "Encrypted credential stored"
                              : "No credential stored"}
                          </Badge>
                        </div>

                        <p className="mt-1 text-sm text-slate-600">
                          {
                            connection.brandName
                          }
                          {connection.displayName
                            ? ` · ${connection.displayName}`
                            : ""}
                        </p>

                        <div className="mt-3 grid gap-x-8 gap-y-2 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
                          <p>
                            Accounts:{" "}
                            <span className="font-medium text-slate-700">
                              {
                                connection.accountCount
                              }
                            </span>
                          </p>

                          <p>
                            Connected:{" "}
                            <span className="font-medium text-slate-700">
                              {formatDate(
                                connection.connectedAt,
                              )}
                            </span>
                          </p>

                          <p>
                            Last validated:{" "}
                            <span className="font-medium text-slate-700">
                              {formatDate(
                                connection.lastValidatedAt,
                              )}
                            </span>
                          </p>

                          <p>
                            Last sync:{" "}
                            <span className="font-medium text-slate-700">
                              {formatDate(
                                connection.lastSyncAt,
                              )}
                            </span>
                          </p>
                        </div>

                        {connection.lastErrorMessage ? (
                          <p className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                            {
                              connection.lastErrorMessage
                            }
                          </p>
                        ) : null}
                      </div>

                      {canManage &&
                      connection.status ===
                        "pending_authorization" ? (
                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            disabled={
                              disconnecting ||
                              busyProvider !== null
                            }
                            onClick={() =>
                              void continuePendingProvider(
                                connection,
                              )
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 px-3.5 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {disconnecting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            Continue
                          </button>

                          <button
                            type="button"
                            disabled={
                              disconnecting
                            }
                            onClick={() =>
                              void cancelPendingProvider(
                                connection,
                              )
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {disconnecting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}

                            {disconnecting
                              ? "Cancelling…"
                              : "Cancel pending"}
                          </button>
                        </div>
                      ) : null}

                      {canManage &&
                      (connection.status ===
                        "authorized" ||
                        connection.status ===
                          "connected") &&
                      providers.find(
                        (item) =>
                          item.provider ===
                          connection.provider,
                      )?.supportsMultipleAccounts ? (
                        <button
                          type="button"
                          disabled={
                            disconnecting ||
                            busyProvider !== null
                          }
                          onClick={() =>
                            void addAnotherAccount(
                              connection,
                            )
                          }
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-indigo-200 px-3.5 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Add another account
                        </button>
                      ) : null}

                      {canManage &&
                      connection.status !==
                        "disconnected" &&
                      connection.status !==
                        "pending_authorization" &&
                      connection.status !==
                        "not_connected" ? (
                        <button
                          type="button"
                          disabled={
                            disconnecting
                          }
                          onClick={() =>
                            disconnectProvider(
                              connection,
                            )
                          }
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {disconnecting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Unplug className="h-4 w-4" />
                          )}

                          {disconnecting
                            ? "Disconnecting…"
                            : "Disconnect"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>
    </div>
  );
}
