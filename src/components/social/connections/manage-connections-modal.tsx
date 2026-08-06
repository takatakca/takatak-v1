"use client";

import {
  CircleAlert,
  Loader2,
  ShieldCheck,
  Unplug,
  X,
} from "lucide-react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  useRef,
  useState,
} from "react";

import {
  SocialPlatformIcon,
  type SocialPlatformKey,
} from "@/components/social/navigation/social-platform-icon";

export type ManageConnectionsProvider = {
  provider:
    | "meta"
    | "google"
    | "linkedin"
    | "tiktok"
    | "pinterest"
    | "x"
    | "bluesky"
    | "twitch";

  label: string;
  description: string;
  platforms: string[];
  implemented: boolean;
  connectable: boolean;
  configured: boolean;

  state:
    | "planned"
    | "not_configured"
    | "ready_for_authorization";
};

export type ManageConnectionsAccount = {
  id: string;
  platform: string;
  externalAccountId: string | null;
  handle: string | null;
  displayName: string | null;
  status: string;
};

export type ManageConnectionsConnection = {
  id: string;
  provider: string;
  status: string;
  brandId: string;
  brandName: string;
  accounts: ManageConnectionsAccount[];
  lastErrorMessage: string | null;
};

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

type ProviderName =
  ManageConnectionsProvider["provider"];

type ConnectionCard = {
  key: string;
  label: string;
  actionLabel: string;
  platform: SocialPlatformKey;
  accountPlatform: string | null;
  provider: ProviderName | null;
  backgroundClassName: string;
  textClassName: string;
  planned?: boolean;
  hoverMessage?: string;
};

const CONNECTION_CARDS: ConnectionCard[] = [
  {
    key: "web",
    label: "Web",
    actionLabel: "Connect a web page",
    platform: "web",
    accountPlatform: null,
    provider: null,
    backgroundClassName:
      "bg-[#8790f6] hover:bg-[#7883ec]",
    textClassName: "text-white",
    planned: true,
  },
  {
    key: "blog",
    label: "Blog",
    actionLabel: "Connect a blog",
    platform: "blog",
    accountPlatform: null,
    provider: null,
    backgroundClassName:
      "bg-[#b8cdd1] hover:bg-[#aac1c6]",
    textClassName: "text-white",
    planned: true,
    hoverMessage:
      "In order to connect a blog, you need to connect a web page first.",
  },
  {
    key: "facebook",
    label: "Facebook",
    actionLabel: "Connect a Facebook page",
    platform: "facebook",
    accountPlatform: "facebook",
    provider: "meta",
    backgroundClassName:
      "bg-[#126df7] hover:bg-[#075fde]",
    textClassName: "text-white",
  },
  {
    key: "instagram",
    label: "Instagram",
    actionLabel:
      "Connect an Instagram professional account",
    platform: "instagram",
    accountPlatform: "instagram",
    provider: "meta",
    backgroundClassName:
      "bg-[#ff0064] hover:bg-[#e9005b]",
    textClassName: "text-white",
  },
  {
    key: "threads",
    label: "Threads",
    actionLabel: "Connect a Threads account",
    platform: "threads",
    accountPlatform: "threads",
    provider: "meta",
    backgroundClassName:
      "bg-black hover:bg-[#181818]",
    textClassName: "text-white",
  },
  {
    key: "x",
    label: "X",
    actionLabel: "Connect a Twitter / X account",
    platform: "x",
    accountPlatform: "x",
    provider: "x",
    backgroundClassName:
      "bg-[#f7fadf] hover:bg-[#eff4cc]",
    textClassName: "text-slate-900",
  },
  {
    key: "bluesky",
    label: "Bluesky",
    actionLabel: "Connect a Bluesky account",
    platform: "bluesky",
    accountPlatform: "bluesky",
    provider: "bluesky",
    backgroundClassName:
      "bg-[#2687f8] hover:bg-[#1478e8]",
    textClassName: "text-white",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    actionLabel: "Connect a LinkedIn account",
    platform: "linkedin",
    accountPlatform: "linkedin",
    provider: "linkedin",
    backgroundClassName:
      "bg-[#f7fadf] hover:bg-[#eff4cc]",
    textClassName: "text-slate-900",
  },
  {
    key: "pinterest",
    label: "Pinterest",
    actionLabel: "Connect a Pinterest account",
    platform: "pinterest",
    accountPlatform: "pinterest",
    provider: "pinterest",
    backgroundClassName:
      "bg-[#e60023] hover:bg-[#cc001f]",
    textClassName: "text-white",
  },
  {
    key: "tiktok-personal",
    label: "TikTok personal",
    actionLabel:
      "Connect a TikTok personal account",
    platform: "tiktok",
    accountPlatform: "tiktok",
    provider: "tiktok",
    backgroundClassName:
      "bg-black hover:bg-[#181818]",
    textClassName: "text-white",
  },
  {
    key: "tiktok-business",
    label: "TikTok business",
    actionLabel:
      "Connect a TikTok business account",
    platform: "tiktok_business",
    accountPlatform: "tiktok",
    provider: "tiktok",
    backgroundClassName:
      "bg-black hover:bg-[#181818]",
    textClassName: "text-white",
  },
  {
    key: "google-business",
    label: "Google Business Profile",
    actionLabel:
      "Connect a Google Business Profile account",
    platform: "google_business",
    accountPlatform: "google_business",
    provider: "google",
    backgroundClassName:
      "bg-[#4d8bf6] hover:bg-[#3c7de7]",
    textClassName: "text-white",
  },
  {
    key: "youtube",
    label: "YouTube",
    actionLabel: "Connect a YouTube channel",
    platform: "youtube",
    accountPlatform: "youtube",
    provider: "google",
    backgroundClassName:
      "bg-[#ff0808] hover:bg-[#e60000]",
    textClassName: "text-white",
  },
  {
    key: "twitch",
    label: "Twitch",
    actionLabel: "Connect a Twitch account",
    platform: "twitch",
    accountPlatform: "twitch",
    provider: "twitch",
    backgroundClassName:
      "bg-[#9146ff] hover:bg-[#8035ec]",
    textClassName: "text-white",
  },
  {
    key: "meta-ads",
    label: "Meta Ads",
    actionLabel: "Connect a Meta Ads account",
    platform: "meta_ads",
    accountPlatform: null,
    provider: null,
    backgroundClassName:
      "bg-[#126df7] hover:bg-[#075fde]",
    textClassName: "text-white",
    planned: true,
  },
  {
    key: "google-ads",
    label: "Google Ads",
    actionLabel: "Connect a Google Ads account",
    platform: "google_ads",
    accountPlatform: null,
    provider: null,
    backgroundClassName:
      "bg-[#4d8bf6] hover:bg-[#3c7de7]",
    textClassName: "text-white",
    planned: true,
  },
  {
    key: "tiktok-ads",
    label: "TikTok Ads",
    actionLabel: "Connect a TikTok Ads account",
    platform: "tiktok_ads",
    accountPlatform: null,
    provider: null,
    backgroundClassName:
      "bg-black hover:bg-[#181818]",
    textClassName: "text-white",
    planned: true,
  },
  {
    key: "looker-studio",
    label: "Looker Studio",
    actionLabel: "Connect Looker Studio",
    platform: "looker_studio",
    accountPlatform: null,
    provider: null,
    backgroundClassName:
      "bg-[#f7fadf] hover:bg-[#eff4cc]",
    textClassName: "text-slate-900",
    planned: true,
  },
];

const PRIMARY_CARD_BY_PROVIDER: Record<
  ProviderName,
  string
> = {
  meta: "facebook",
  google: "google-business",
  linkedin: "linkedin",
  tiktok: "tiktok-personal",
  pinterest: "pinterest",
  x: "x",
  bluesky: "bluesky",
  twitch: "twitch",
};

type ApiResult = {
  ok?: boolean;
  message?: string;

  authorization?: {
    authorizationUrl?: string;
  };
};

async function readApiResult(
  response: Response,
): Promise<ApiResult> {
  try {
    return (await response.json()) as ApiResult;
  } catch {
    return {
      ok: false,
      message:
        "The server returned an invalid response.",
    };
  }
}

function connectionIsActive(
  status: string,
): boolean {
  return (
    status === "connected" ||
    status === "authorized"
  );
}

export function ManageConnectionsModal({
  activeBrandId,
  providers,
  initialConnections,
  canManage,
}: {
  activeBrandId: string | null;
  activeBrandName: string | null;
  providers: ManageConnectionsProvider[];
  initialConnections:
    ManageConnectionsConnection[];
  canManage: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const open =
    searchParams.get("connections") ===
    "open";

  const [connections, setConnections] =
    useState(initialConnections);

  const [busyProvider, setBusyProvider] =
    useState<ProviderName | null>(null);

  const [
    busyConnectionId,
    setBusyConnectionId,
  ] = useState<string | null>(null);

  const [notice, setNotice] =
    useState<Notice | null>(null);

  const [outsidePulse, setOutsidePulse] =
    useState(false);

  const pulseTimeoutRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  function closeModal() {
    const params = new URLSearchParams(
      searchParams.toString(),
    );

    params.delete("connections");
    params.delete("platform");

    const query = params.toString();

    router.replace(
      query
        ? `${pathname}?${query}`
        : pathname,
    );
  }

  function pulseModal() {
    if (pulseTimeoutRef.current) {
      clearTimeout(
        pulseTimeoutRef.current,
      );
    }

    setOutsidePulse(true);

    pulseTimeoutRef.current =
      setTimeout(() => {
        setOutsidePulse(false);
        pulseTimeoutRef.current =
          null;
      }, 170);
  }

  async function connectProvider(
    provider: ProviderName,
    platform: string | null,
  ) {
    if (!activeBrandId) {
      setNotice({
        tone: "error",
        message:
          "Select or create a brand before connecting a provider.",
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

    setBusyProvider(provider);
    setNotice(null);

    try {
      const returnPath =
        "/dashboard/social?connections=open" +
        (platform
          ? `&platform=${encodeURIComponent(
              platform,
            )}`
          : "");

      const response = await fetch(
        "/api/social/connections/start",
        {
          method: "POST",
          credentials: "same-origin",

          headers: {
            Accept: "application/json",
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            provider,
            businessBrandId:
              activeBrandId,
            returnPath,
          }),
        },
      );

      const result =
        await readApiResult(response);

      if (!response.ok || !result.ok) {
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
        window.location.assign(
          authorizationUrl,
        );

        return;
      }

      setNotice({
        tone: "info",
        message:
          result.message ??
          "The authorization request was created, but no authorization URL is available.",
      });

      router.refresh();
    } catch {
      setNotice({
        tone: "error",
        message:
          "A network error occurred while starting the connection.",
      });
    } finally {
      setBusyProvider(null);
    }
  }

  async function disconnectProvider(
    connection:
      ManageConnectionsConnection,
  ) {
    if (!canManage) {
      setNotice({
        tone: "error",
        message:
          "You do not have permission to disconnect providers.",
      });

      return;
    }

    const confirmed =
      window.confirm(
        `Disconnect ${connection.provider} from ${connection.brandName}? This disconnects all imported accounts belonging to this provider.`,
      );

    if (!confirmed) {
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
          "The provider was disconnected successfully.",
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

  if (!open) {
    return null;
  }

  return (
    <div
      // className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-[18px]"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 px-[18px] pb-[18px] pt-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-connections-title"
    >
      <button
        type="button"
        aria-label="Manage connections modal background"
        onClick={pulseModal}
        className="absolute inset-0 cursor-default"
      />

      <section
        className={`relative z-10 flex max-h-[calc(100vh-36px)] w-full max-w-[1400px] flex-col overflow-visible rounded-xl bg-white shadow-2xl transition-transform duration-150 ease-out ${
          outsidePulse
            ? "scale-[0.975]"
            : "scale-100"
        }`}
      >
        {/* <button
          type="button"
          onClick={closeModal}
          aria-label="Close manage connections"
          className="absolute right-5 top-0 z-20 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-[#2a1728] text-[#dfff32] shadow-xl transition-transform hover:scale-105"
        >
          <X className="h-7 w-7" />
        </button> */}
        <button
          type="button"
          onClick={closeModal}
          aria-label="Close manage connections"
          className="absolute right-6 top-0 z-30 flex h-[50px] w-[50px] -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-white bg-[#2a1728] text-[#dfff32]"
        >
          <X className="h-8 w-8 stroke-[1.0]" />
        </button>

        <div className="flex max-h-[calc(100vh-58px)] min-h-0 w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl">


        <header className="shrink-0 border-b border-slate-200 px-9 py-7">
          <h2
            id="manage-connections-title"
            className="text-[22px] font-normal text-slate-950"
          >
            Manage connections
          </h2>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-9 py-8">
          {notice ? (
            <div
              className={`mb-7 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
                notice.tone === "success"
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
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0" />
              )}

              <span>{notice.message}</span>
            </div>
          ) : null}

          {!activeBrandId ? (
            <div className="mb-7 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Select or create a brand before
              connecting social accounts.
            </div>
          ) : null}

          <div 
          // className="grid gap-x-5 gap-y-8 md:grid-cols-2 xl:grid-cols-3"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {CONNECTION_CARDS.map(
              (card) => {
                const provider =
                  card.provider
                    ? providers.find(
                        (item) =>
                          item.provider ===
                          card.provider,
                      ) ?? null
                    : null;

                const connection =
                  card.provider
                    ? connections.find(
                        (item) =>
                          item.provider ===
                          card.provider,
                      ) ?? null
                    : null;

                const account =
                  card.accountPlatform &&
                  connection
                    ? connection.accounts.find(
                        (item) =>
                          item.platform ===
                          card.accountPlatform,
                      ) ?? null
                    : null;

                const activeConnection =
                  connection
                    ? connectionIsActive(
                        connection.status,
                      )
                    : false;

                const platformConnected =
                  activeConnection &&
                  account !== null;

                const providerPending =
                  connection?.status ===
                  "pending_authorization";

                const needsReconnect =
                  connection?.status ===
                    "expired" ||
                  connection?.status ===
                    "error" ||
                  connection?.status ===
                    "disconnected";

                const canStart =
                  card.provider !== null &&
                  !card.planned &&
                  Boolean(activeBrandId) &&
                  canManage &&
                  provider !== null &&
                  provider.connectable &&
                  !activeConnection &&
                  !providerPending;

                const busy =
                  card.provider !== null &&
                  busyProvider ===
                    card.provider;

                let buttonLabel =
                  card.actionLabel;

                if (busy) {
                  buttonLabel =
                    "Starting authorization...";
                } else if (
                  platformConnected
                ) {
                  buttonLabel = "Connected";
                } else if (
                  activeConnection
                ) {
                  buttonLabel =
                    "Provider connected";
                } else if (
                  providerPending
                ) {
                  buttonLabel =
                    "Authorization pending";
                } else if (
                  needsReconnect
                ) {
                  buttonLabel = "Reconnect";
                } else if (
                  card.planned ||
                  provider?.state ===
                    "planned"
                ) {
                  buttonLabel = "Planned";
                } else if (
                  !activeBrandId
                ) {
                  buttonLabel =
                    "Select a brand";
                } else if (!canManage) {
                  buttonLabel = "View only";
                } else if (
                  provider?.state ===
                  "not_configured"
                ) {
                  buttonLabel =
                    "Not configured";
                }

                const primaryProviderCard =
                  provider !== null &&
                  PRIMARY_CARD_BY_PROVIDER[
                    provider.provider
                  ] === card.key;

                const iconIsWhite =
                  card.textClassName ===
                    "text-white" ||
                  platformConnected;

                return (
                  <article
                    key={card.key}
                    className="group relative min-w-0 rounded-xl border border-slate-200 bg-white p-3 transition-[border-color,box-shadow,transform] duration-150 hover:z-40 hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] focus-within:z-40 focus-within:border-slate-300 focus-within:shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
                  >
                    <div className="mb-3 flex items-center gap-3 px-1">
                      <SocialPlatformIcon
                        platform={
                          card.platform
                        }
                        className="h-6 w-6 shrink-0"
                      />

                      <h3 className="truncate text-[17px] font-normal text-slate-950">
                        {card.label}
                      </h3>
                    </div>

                    <button
                      type="button"
                      disabled={!canStart}
                      onClick={() => {
                        if (
                          card.provider
                        ) {
                          void connectProvider(
                            card.provider,
                            card.accountPlatform,
                          );
                        }
                      }}
                      className={`flex min-h-13 w-full items-center justify-between rounded-md px-5 py-3.5 text-[15px] font-normal transition-colors disabled:cursor-not-allowed disabled:opacity-100 ${
                        platformConnected
                          ? "bg-emerald-600 text-white"
                          : `${card.backgroundClassName} ${card.textClassName}`
                      }`}
                    >
                      <span className="truncate pr-4">
                        {buttonLabel}
                      </span>

                      {busy ? (
                        <Loader2 className="h-6 w-6 shrink-0 animate-spin" />
                      ) : (
                        <SocialPlatformIcon
                          platform={
                            card.platform
                          }
                          className="h-6 w-6 shrink-0"
                          inverse={
                            iconIsWhite
                          }
                        />
                      )}
                    </button>

                    {card.hoverMessage ? (
                      <div
                        role="tooltip"
                        className="pointer-events-none absolute left-0 right-0 top-full z-50 mt-3 translate-y-1 rounded-2xl border border-slate-100 bg-white px-5 py-3 text-center text-[15px] text-[#2a1728] opacity-0 shadow-lg transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                      >
                        {card.hoverMessage}
                      </div>
                    ) : null}

                    {account ? (
                      <p className="mt-2 truncate px-1 text-xs text-slate-500">
                        {account.displayName ||
                          account.handle ||
                          account.externalAccountId}
                      </p>
                    ) : null}

                    {primaryProviderCard &&
                    connection &&
                    activeConnection &&
                    canManage ? (
                      <button
                        type="button"
                        disabled={
                          busyConnectionId ===
                          connection.id
                        }
                        onClick={() =>
                          void disconnectProvider(
                            connection,
                          )
                        }
                        className="mt-2 inline-flex items-center gap-2 px-1 text-xs font-medium text-rose-700 transition hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyConnectionId ===
                        connection.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Unplug className="h-3.5 w-3.5" />
                        )}

                        Disconnect provider
                      </button>
                    ) : null}
                  </article>
                );
              },
            )}
          </div>
        </div>
        </div>
      </section>
    </div>
  );
}
