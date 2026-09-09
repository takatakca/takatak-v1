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
  useEffect,
  useRef,
  useState,
} from "react";

import {
  SocialPlatformIcon,
  type SocialPlatformKey,
} from "@/components/social/navigation/social-platform-icon";
import { FacebookPageSelectionPanel } from "@/components/social/connections/facebook-page-selection-panel";
import { requestSocialBrandSelectorRefresh } from "@/components/social/navigation/social-brand-selector-events";
import { withSocialPreview } from "@/components/social/preview/social-preview-query";
import {
  pickCanonicalProviderConnection,
  pickMetaSurfaceConnection,
  pickSelectedFacebookAccount,
  pickSelectedInstagramAccount,
  pickSelectedThreadsAccount,
  pickSelectedTikTokAccount,
  pickSelectedXAccount,
} from "@/lib/social/connections/social-canonical-identity";
import { projectMetaBrandSurface } from "@/lib/social/connections/meta-brand-projection";
import {
  canAddAnotherAccount,
  canAttachLinkedInstagram,
  canAttachLinkedThreads,
  canCancelPendingConnection,
  canContinueAuthorization,
  canStartProviderConnect,
  isProviderPlatformConnected,
  resolveConnectedAccountLabel,
  resolveProviderCardLabel,
} from "@/lib/social/connections/social-connection-lifecycle-policy";

export type ManageConnectionsProvider = {
  provider:
    | "meta"
    | "instagram"
    | "threads"
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
  supportsMultipleAccounts: boolean;

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
  accessStatus?: string | null;
  profileImageUrl?: string | null;
};

export type ManageConnectionsConnection = {
  id: string;
  provider: string;
  status: string;
  brandId: string;
  brandName: string;
  accounts: ManageConnectionsAccount[];
  lastErrorCode: string | null;
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
    provider: "instagram",
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
    provider: "threads",
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
    planned: true,
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
    planned: true,
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
  instagram: "instagram",
  threads: "threads",
  google: "youtube",
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

  connection?: {
    id?: string;
    provider?: string;
    status?: string;
  };

  selection?: {
    socialAccountId?: string;
    displayName?: string;
    handle?: string | null;
    profileImageUrl?: string | null;
  };
};

function pickConnectionForProvider(
  provider: string,
  connections: ManageConnectionsConnection[],
): ManageConnectionsConnection | null {
  if (provider === "meta") {
    return pickMetaSurfaceConnection(connections, provider);
  }
  return pickCanonicalProviderConnection(connections, provider);
}

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

function mapApiConnections(
  rows: unknown,
): ManageConnectionsConnection[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") {
      return [];
    }

    const item = row as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    const provider =
      typeof item.provider === "string" ? item.provider : "";
    const status =
      typeof item.status === "string" ? item.status : "";
    const brandId =
      typeof item.brandId === "string" ? item.brandId : "";
    const brandName =
      typeof item.brandName === "string" ? item.brandName : "";

    if (!id || !provider || !status || !brandId) {
      return [];
    }

    const accountsRaw = Array.isArray(item.accounts)
      ? item.accounts
      : [];

    const accounts: ManageConnectionsAccount[] =
      accountsRaw.flatMap((accountRow) => {
        if (
          !accountRow ||
          typeof accountRow !== "object"
        ) {
          return [];
        }

        const account = accountRow as Record<
          string,
          unknown
        >;
        const accountId =
          typeof account.id === "string"
            ? account.id
            : "";
        const platform =
          typeof account.platform === "string"
            ? account.platform
            : "";
        const accountStatus =
          typeof account.status === "string"
            ? account.status
            : "";

        if (!accountId || !platform) {
          return [];
        }

        return [
          {
            id: accountId,
            platform,
            // Never surface Facebook Page IDs in client connection state.
            externalAccountId: null,
            handle:
              typeof account.handle === "string"
                ? account.handle
                : null,
            displayName:
              typeof account.displayName === "string"
                ? account.displayName
                : null,
            status: accountStatus,
            accessStatus:
              typeof account.accessStatus === "string"
                ? account.accessStatus
                : null,
            profileImageUrl:
              typeof account.profileImageUrl === "string"
                ? account.profileImageUrl
                : null,
          },
        ];
      });

    return [
      {
        id,
        provider,
        status,
        brandId,
        brandName,
        accounts,
        lastErrorCode:
          typeof item.lastErrorCode === "string"
            ? item.lastErrorCode
            : null,
        lastErrorMessage:
          typeof item.lastErrorMessage === "string"
            ? item.lastErrorMessage
            : null,
      },
    ];
  });
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

  /** Card being started (e.g. "facebook"), NOT shared provider id like "meta". */
  const [busyCardKey, setBusyCardKey] =
    useState<string | null>(null);

  const connectInFlightRef =
    useRef(false);

  const [
    busyConnectionId,
    setBusyConnectionId,
  ] = useState<string | null>(null);

  const [notice, setNotice] =
    useState<Notice | null>(null);

  const [outsidePulse, setOutsidePulse] =
    useState(false);

  const [
    pageSelectionConnectionId,
    setPageSelectionConnectionId,
  ] = useState<string | null>(null);

  const pulseTimeoutRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const connectionsFetchGenerationRef =
    useRef(0);

  async function refreshConnectionsFromServer() {
    if (!activeBrandId) {
      return;
    }

    const generation =
      ++connectionsFetchGenerationRef.current;

    try {
      const response = await fetch(
        `/api/social/connections?brandId=${encodeURIComponent(
          activeBrandId,
        )}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        connections?: unknown;
      };

      if (
        generation !==
        connectionsFetchGenerationRef.current
      ) {
        return;
      }

      if (!response.ok || !body.ok) {
        return;
      }

      setConnections(
        mapApiConnections(body.connections),
      );
    } catch {
      // Keep existing local state; router.refresh still reconciles RSC.
    }
  }

  useEffect(() => {
    setConnections(initialConnections);
  }, [initialConnections]);

  useEffect(() => {
    if (!open || !activeBrandId) {
      return;
    }

    void refreshConnectionsFromServer();
    // Refetch whenever Manage connections opens so status/Page identity is live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeBrandId]);

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
    card: ConnectionCard,
  ) {
    if (!card.provider) {
      return;
    }

    // Only the primary card for a provider may start OAuth.
    if (
      PRIMARY_CARD_BY_PROVIDER[
        card.provider
      ] !== card.key
    ) {
      setNotice({
        tone: "info",
        message:
          card.provider === "meta"
            ? "Connect Facebook from the Facebook card."
            : "This network is started from its primary connect card.",
      });

      return;
    }

    if (
      connectInFlightRef.current ||
      busyCardKey !== null ||
      busyConnectionId !== null
    ) {
      return;
    }

    const providerMeta = providers.find(
      (item) => item.provider === card.provider,
    );

    if (!providerMeta) {
      setNotice({
        tone: "error",
        message:
          "This provider is not available in the workspace registry.",
      });

      return;
    }

    const startDecision = canStartProviderConnect({
      implemented:
        providerMeta.implemented && !card.planned,
      connectable: providerMeta.connectable,
      providerState: providerMeta.state,
      connectionStatus:
        connections.find(
          (item) =>
            item.provider === card.provider,
        )?.status ?? null,
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
              : startDecision.reason ===
                  "already_connected"
                ? "This provider is already connected."
                : startDecision.reason ===
                    "already_authorized"
                  ? "This provider is already authorized."
                  : `${providerMeta.label} cannot start authorization right now.`,
      });

      return;
    }

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

    connectInFlightRef.current = true;
    setBusyCardKey(card.key);
    setNotice(null);

    let redirected = false;

    try {
      const returnPath = withSocialPreview(
        "/dashboard/social?connections=open" +
          (card.accountPlatform
            ? `&platform=${encodeURIComponent(
                card.accountPlatform,
              )}`
            : ""),
        searchParams,
      );

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
            provider: card.provider,
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
      if (!redirected) {
        connectInFlightRef.current =
          false;
        setBusyCardKey(null);
      }
    }
  }

  async function cancelPendingProvider(
    connection: ManageConnectionsConnection,
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

      const result =
        await readApiResult(response);

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
                  result.connection
                    ?.status ??
                  "not_connected",
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
    connection: ManageConnectionsConnection,
    card: ConnectionCard,
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
      busyCardKey !== null ||
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
    setBusyCardKey(card.key);
    setNotice(null);

    let redirected = false;

    try {
      const returnPath = withSocialPreview(
        "/dashboard/social?connections=open" +
          (card.accountPlatform
            ? `&platform=${encodeURIComponent(
                card.accountPlatform,
              )}`
            : ""),
        searchParams,
      );

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
          body: JSON.stringify({ returnPath }),
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
        setBusyCardKey(null);
      }
    }
  }

  async function addAnotherAccount(
    connection: ManageConnectionsConnection,
    card: ConnectionCard,
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
      busyCardKey !== null ||
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
    setBusyCardKey(card.key);
    setNotice(null);

    let redirected = false;

    try {
      const returnPath = withSocialPreview(
        "/dashboard/social?connections=open" +
          (card.accountPlatform
            ? `&platform=${encodeURIComponent(
                card.accountPlatform,
              )}`
            : ""),
        searchParams,
      );

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
            returnPath,
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
        setBusyCardKey(null);
      }
    }
  }

  async function clearFacebookPageForReselect(
    connection: ManageConnectionsConnection,
  ) {
    if (!canManage) {
      setNotice({
        tone: "error",
        message:
          "You do not have permission to change Facebook Pages.",
      });
      return;
    }

    if (connection.provider !== "meta") {
      return;
    }

    if (connection.status !== "connected") {
      setNotice({
        tone: "info",
        message:
          "Select a Facebook Page to finish setup.",
      });
      setPageSelectionConnectionId(connection.id);
      return;
    }

    const pageLabel =
      resolveConnectedAccountLabel({
        displayName:
          pickSelectedFacebookAccount(connection.accounts)
            ?.displayName ?? null,
        handle: null,
      }) ?? "this Facebook Page";

    const confirmed = window.confirm(
      `Remove ${pageLabel}? You can pick another Facebook Page without reconnecting Meta.`,
    );

    if (!confirmed) {
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
        )}/pages/select`,
        {
          method: "DELETE",
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
            "The Facebook Page could not be removed.",
        });
        return;
      }

      setConnections((current) =>
        current.map((item) =>
          item.id === connection.id
            ? {
                ...item,
                status: "authorized",
                accounts: item.accounts.map((account) =>
                  account.status === "connected" ||
                  account.accessStatus === "selected"
                    ? {
                        ...account,
                        status: "not_connected",
                        accessStatus: "available",
                      }
                    : account,
                ),
                lastErrorMessage: null,
              }
            : item,
        ),
      );

      setNotice({
        tone: "success",
        message:
          result.message ??
          "Facebook Page removed. Select another Page to finish setup.",
      });

      requestSocialBrandSelectorRefresh();
      router.refresh();
      setPageSelectionConnectionId(connection.id);
    } catch {
      setNotice({
        tone: "error",
        message:
          "A network error occurred while removing the Facebook Page.",
      });
    } finally {
      setBusyConnectionId(null);
    }
  }

  async function connectInstagram(
    connection: ManageConnectionsConnection,
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
      busyCardKey !== null ||
      busyConnectionId !== null
    ) {
      return;
    }

    connectInFlightRef.current = true;
    setBusyCardKey("instagram");
    setBusyConnectionId(connection.id);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/social/connections/${encodeURIComponent(
          connection.id,
        )}/instagram`,
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
            "Instagram could not be connected.",
        });
        return;
      }

      const displayName =
        result.selection?.displayName ?? "Instagram account";

      setConnections((current) =>
        current.map((item) =>
          item.id === connection.id
            ? {
                ...item,
                accounts: [
                  ...item.accounts.filter(
                    (account) => account.platform !== "instagram",
                  ),
                  {
                    id:
                      result.selection?.socialAccountId ??
                      `instagram-${connection.id}`,
                    platform: "instagram",
                    externalAccountId: null,
                    handle: result.selection?.handle ?? null,
                    displayName,
                    status: "connected",
                    accessStatus: "selected",
                    profileImageUrl:
                      result.selection?.profileImageUrl ?? null,
                  },
                ],
              }
            : item,
        ),
      );

      setNotice({
        tone: "success",
        message: result.message ?? `${displayName} is connected.`,
      });

      requestSocialBrandSelectorRefresh();
      router.refresh();
    } catch {
      setNotice({
        tone: "error",
        message:
          "A network error occurred while connecting Instagram.",
      });
    } finally {
      connectInFlightRef.current = false;
      setBusyCardKey(null);
      setBusyConnectionId(null);
    }
  }

  async function clearInstagram(
    connection: ManageConnectionsConnection,
  ) {
    if (!canManage) {
      setNotice({
        tone: "error",
        message:
          "You do not have permission to manage social connections.",
      });
      return;
    }

    const label =
      resolveConnectedAccountLabel({
        displayName:
          pickSelectedInstagramAccount(connection.accounts)
            ?.displayName ?? null,
        handle:
          pickSelectedInstagramAccount(connection.accounts)?.handle ??
          null,
      }) ?? "this Instagram account";

    const confirmed = window.confirm(
      `Disconnect ${label}? Facebook Page stays connected.`,
    );

    if (!confirmed) {
      return;
    }

    if (busyConnectionId !== null) {
      return;
    }

    setBusyConnectionId(connection.id);
    setBusyCardKey("instagram");
    setNotice(null);

    try {
      const response = await fetch(
        `/api/social/connections/${encodeURIComponent(
          connection.id,
        )}/instagram`,
        {
          method: "DELETE",
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
            "Instagram could not be disconnected.",
        });
        return;
      }

      setConnections((current) =>
        current.map((item) =>
          item.id === connection.id
            ? {
                ...item,
                accounts: item.accounts.map((account) =>
                  account.platform === "instagram" ||
                  account.platform === "threads"
                    ? {
                        ...account,
                        status: "not_connected",
                        accessStatus: "available",
                      }
                    : account,
                ),
              }
            : item,
        ),
      );

      setNotice({
        tone: "success",
        message:
          result.message ??
          "Instagram disconnected. Facebook Page remains connected.",
      });

      requestSocialBrandSelectorRefresh();
      router.refresh();
    } catch {
      setNotice({
        tone: "error",
        message:
          "A network error occurred while disconnecting Instagram.",
      });
    } finally {
      setBusyConnectionId(null);
      setBusyCardKey(null);
    }
  }

  async function connectThreads(
    connection: ManageConnectionsConnection,
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
      busyCardKey !== null ||
      busyConnectionId !== null
    ) {
      return;
    }

    connectInFlightRef.current = true;
    setBusyCardKey("threads");
    setBusyConnectionId(connection.id);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/social/connections/${encodeURIComponent(
          connection.id,
        )}/threads`,
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
            "Threads could not be connected.",
        });
        return;
      }

      const displayName =
        result.selection?.displayName ?? "Threads account";

      setConnections((current) =>
        current.map((item) =>
          item.id === connection.id
            ? {
                ...item,
                accounts: [
                  ...item.accounts.filter(
                    (account) => account.platform !== "threads",
                  ),
                  {
                    id:
                      result.selection?.socialAccountId ??
                      `threads-${connection.id}`,
                    platform: "threads",
                    externalAccountId: null,
                    handle: result.selection?.handle ?? null,
                    displayName,
                    status: "connected",
                    accessStatus: "selected",
                    profileImageUrl:
                      result.selection?.profileImageUrl ?? null,
                  },
                ],
              }
            : item,
        ),
      );

      setNotice({
        tone: "success",
        message: result.message ?? `${displayName} is connected.`,
      });

      requestSocialBrandSelectorRefresh();
      router.refresh();
    } catch {
      setNotice({
        tone: "error",
        message:
          "A network error occurred while connecting Threads.",
      });
    } finally {
      connectInFlightRef.current = false;
      setBusyCardKey(null);
      setBusyConnectionId(null);
    }
  }

  async function clearThreads(
    connection: ManageConnectionsConnection,
  ) {
    if (!canManage) {
      setNotice({
        tone: "error",
        message:
          "You do not have permission to manage social connections.",
      });
      return;
    }

    const label =
      resolveConnectedAccountLabel({
        displayName:
          pickSelectedThreadsAccount(connection.accounts)
            ?.displayName ?? null,
        handle:
          pickSelectedThreadsAccount(connection.accounts)?.handle ??
          null,
      }) ?? "this Threads account";

    const confirmed = window.confirm(
      `Disconnect ${label}? Facebook Page stays connected.`,
    );

    if (!confirmed) {
      return;
    }

    if (busyConnectionId !== null) {
      return;
    }

    setBusyConnectionId(connection.id);
    setBusyCardKey("threads");
    setNotice(null);

    try {
      const response = await fetch(
        `/api/social/connections/${encodeURIComponent(
          connection.id,
        )}/threads`,
        {
          method: "DELETE",
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
            "Threads could not be disconnected.",
        });
        return;
      }

      setConnections((current) =>
        current.map((item) =>
          item.id === connection.id
            ? {
                ...item,
                accounts: item.accounts.map((account) =>
                  account.platform === "threads"
                    ? {
                        ...account,
                        status: "not_connected",
                        accessStatus: "available",
                      }
                    : account,
                ),
              }
            : item,
        ),
      );

      setNotice({
        tone: "success",
        message:
          result.message ??
          "Threads disconnected. Facebook Page remains connected.",
      });

      requestSocialBrandSelectorRefresh();
      router.refresh();
    } catch {
      setNotice({
        tone: "error",
        message:
          "A network error occurred while disconnecting Threads.",
      });
    } finally {
      setBusyConnectionId(null);
      setBusyCardKey(null);
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

    if (
      connection.status ===
      "pending_authorization"
    ) {
      setNotice({
        tone: "info",
        message:
          "Use Cancel pending authorization to abandon an unfinished connect without disconnecting a live account.",
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

      requestSocialBrandSelectorRefresh();
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

                const metaConnection =
                  pickConnectionForProvider(
                    "meta",
                    connections,
                  );

                let resolvedConnection =
                  card.provider
                    ? pickConnectionForProvider(
                        card.provider,
                        connections,
                      )
                    : null;

                let independentInstagramLive = false;
                let independentThreadsLive = false;

                if (card.accountPlatform === "instagram") {
                  const independentSelected = resolvedConnection
                    ? pickSelectedInstagramAccount(
                        resolvedConnection.accounts,
                      )
                    : null;
                  const linkedSelected = metaConnection
                    ? pickSelectedInstagramAccount(
                        metaConnection.accounts,
                      )
                    : null;
                  independentInstagramLive =
                    Boolean(independentSelected) ||
                    Boolean(
                      resolvedConnection &&
                        resolvedConnection.status ===
                          "pending_authorization",
                    );

                  if (linkedSelected) {
                    resolvedConnection = metaConnection;
                  }
                }

                if (card.accountPlatform === "threads") {
                  const independentSelected = resolvedConnection
                    ? pickSelectedThreadsAccount(
                        resolvedConnection.accounts,
                      )
                    : null;
                  const linkedSelected = metaConnection
                    ? pickSelectedThreadsAccount(
                        metaConnection.accounts,
                      )
                    : null;
                  independentThreadsLive =
                    Boolean(independentSelected) ||
                    Boolean(
                      resolvedConnection &&
                        resolvedConnection.status ===
                          "pending_authorization",
                    );

                  if (linkedSelected) {
                    resolvedConnection = metaConnection;
                  }
                }

                const connection = resolvedConnection;

                const facebookAccount = connection
                  ? pickSelectedFacebookAccount(connection.accounts)
                  : null;

                const account =
                  card.accountPlatform === "facebook"
                    ? facebookAccount
                    : card.accountPlatform === "instagram" && connection
                      ? pickSelectedInstagramAccount(connection.accounts)
                    : card.accountPlatform === "threads" && connection
                      ? pickSelectedThreadsAccount(connection.accounts)
                      : card.accountPlatform === "tiktok" && connection
                        ? pickSelectedTikTokAccount(connection.accounts)
                      : card.accountPlatform === "x" && connection
                        ? pickSelectedXAccount(connection.accounts)
                        : card.accountPlatform && connection
                        ? connection.accounts.find(
                            (item) =>
                              item.platform ===
                                card.accountPlatform &&
                              item.status === "connected",
                          ) ?? null
                        : null;

                const facebookPageSelected = Boolean(
                  facebookAccount &&
                    facebookAccount.status === "connected" &&
                    (facebookAccount.accessStatus === "selected" ||
                      facebookAccount.accessStatus == null),
                );

                const activeConnection =
                  connection
                    ? connectionIsActive(
                        connection.status,
                      )
                    : false;

                const platformConnected =
                  isProviderPlatformConnected({
                    connectionStatus:
                      connection?.status ?? null,
                    accountStatus:
                      account?.status ?? null,
                    requiresConnectedAccount:
                      card.accountPlatform !==
                      null,
                  });

                const connectedAccountLabel =
                  account &&
                  account.status === "connected"
                    ? resolveConnectedAccountLabel({
                        displayName:
                          account.displayName,
                        handle: account.handle,
                      })
                    : null;

                const isPrimaryStartCard =
                  card.provider !==
                    null &&
                  PRIMARY_CARD_BY_PROVIDER[
                    card.provider
                  ] === card.key;

                const startDecision =
                  card.provider !== null &&
                  provider !== null
                    ? canStartProviderConnect({
                        implemented:
                          provider.implemented &&
                          !card.planned,
                        connectable:
                          provider.connectable,
                        providerState:
                          provider.state,
                        connectionStatus:
                          connection?.status ??
                          null,
                        isPrimaryStartCard,
                      })
                    : {
                        allowed: false as const,
                        reason:
                          "unavailable",
                      };

                const metaFacebookSelected = Boolean(
                  metaConnection &&
                    pickSelectedFacebookAccount(
                      metaConnection.accounts,
                    )?.status === "connected",
                );
                const metaInstagramConnected = Boolean(
                  metaConnection &&
                    pickSelectedInstagramAccount(
                      metaConnection.accounts,
                    ),
                );

                const instagramAttachDecision =
                  card.accountPlatform === "instagram"
                    ? canAttachLinkedInstagram({
                        facebookPageSelected: metaFacebookSelected,
                        instagramAlreadyConnected:
                          platformConnected || independentInstagramLive,
                        connectionStatus:
                          metaConnection?.status ?? null,
                      })
                    : null;

                const threadsAttachDecision =
                  card.accountPlatform === "threads"
                    ? canAttachLinkedThreads({
                        facebookPageSelected: metaFacebookSelected,
                        metaInstagramConnected,
                        threadsAlreadyConnected:
                          platformConnected || independentThreadsLive,
                        connectionStatus:
                          metaConnection?.status ?? null,
                      })
                    : null;

                const metaProjection =
                  card.accountPlatform === "facebook" &&
                  card.provider === "meta" &&
                  connection
                    ? projectMetaBrandSurface({
                        connection: {
                          id: connection.id,
                          status: connection.status,
                          lastErrorCode: connection.lastErrorCode,
                        },
                        selectedPage:
                          facebookAccount
                            ? {
                                id: facebookAccount.id,
                                status: facebookAccount.status,
                                accessStatus: facebookAccount.accessStatus,
                                displayName: facebookAccount.displayName,
                                profileImageUrl:
                                  facebookAccount.profileImageUrl,
                              }
                            : null,
                        hasPendingOAuthAttempt:
                          connection.lastErrorCode ===
                          "reauthorization_pending",
                      })
                    : null;

                // Reconnect / retry for Meta attention states — never claim "Connect".
                const shouldReconnectMeta =
                  Boolean(metaProjection) &&
                  (metaProjection!.state === "action_required" ||
                    metaProjection!.state === "refresh_failed" ||
                    metaProjection!.state === "reauthorization_pending");

                const canStart =
                  ((startDecision.allowed && !shouldReconnectMeta) ||
                    instagramAttachDecision?.allowed === true ||
                    threadsAttachDecision?.allowed === true) &&
                  Boolean(activeBrandId) &&
                  canManage &&
                  busyCardKey === null &&
                  busyConnectionId === null;

                const busy =
                  busyCardKey ===
                  card.key;

                const buttonLabel =
                  card.accountPlatform === "instagram" &&
                  instagramAttachDecision?.allowed
                    ? busy
                      ? "Connecting Instagram…"
                      : "Use Instagram linked to Facebook"
                    : card.accountPlatform === "threads" &&
                        threadsAttachDecision?.allowed
                      ? busy
                        ? "Connecting Threads…"
                        : "Use Threads linked to Facebook"
                      : metaProjection?.manageLabel ??
                  resolveProviderCardLabel({
                        implemented:
                          provider?.implemented !==
                            false &&
                          !card.planned,
                        connectable:
                          provider?.connectable ??
                          false,
                        providerState:
                          provider?.state ??
                          "planned",
                        connectionStatus:
                          platformConnected
                            ? "connected"
                            : connection?.status ??
                              null,
                        isPrimaryStartCard,
                        busy,
                        defaultActionLabel:
                          !activeBrandId
                            ? "Select a brand"
                            : !canManage
                              ? "View only"
                              : card.actionLabel,
                      });

                const primaryProviderCard =
                  provider !== null &&
                  PRIMARY_CARD_BY_PROVIDER[
                    provider.provider
                  ] === card.key;

                const canCancelPending =
                  primaryProviderCard &&
                  connection !== null &&
                  canManage &&
                  canCancelPendingConnection(
                    connection.status,
                  ).allowed;

                const canContinuePending =
                  primaryProviderCard &&
                  connection !== null &&
                  canManage &&
                  provider !== null &&
                  canContinueAuthorization({
                    implemented:
                      provider.implemented &&
                      !card.planned,
                    connectable:
                      provider.connectable,
                    providerState: provider.state,
                    connectionStatus:
                      connection.status,
                    isPrimaryStartCard: true,
                  }).allowed &&
                  busyCardKey === null &&
                  busyConnectionId === null;

                const canAddAnother =
                  primaryProviderCard &&
                  connection !== null &&
                  canManage &&
                  provider !== null &&
                  canAddAnotherAccount({
                    implemented:
                      provider.implemented &&
                      !card.planned,
                    connectable:
                      provider.connectable,
                    providerState: provider.state,
                    supportsMultipleAccounts:
                      provider.supportsMultipleAccounts,
                    sourceConnectionStatus:
                      connection.status,
                    isPrimaryStartCard: true,
                    hasPendingForProviderBrand:
                      connections.some(
                        (item) =>
                          item.provider ===
                            provider.provider &&
                          item.status ===
                            "pending_authorization",
                      ),
                  }).allowed &&
                  busyCardKey === null &&
                  busyConnectionId === null;

                const iconIsWhite =
                  card.textClassName ===
                    "text-white" ||
                  platformConnected;

                const hasSelectedFacebookPage = facebookPageSelected;

                const showConnectedPageCard =
                  Boolean(connectedAccountLabel) &&
                  connection !== null &&
                  canManage &&
                  ((card.accountPlatform === "instagram" ||
                    card.accountPlatform === "threads")
                    ? platformConnected
                    : primaryProviderCard &&
                      (platformConnected ||
                        shouldReconnectMeta ||
                        hasSelectedFacebookPage));

                const showMetaAttention =
                  shouldReconnectMeta &&
                  Boolean(connectedAccountLabel) &&
                  connection !== null &&
                  primaryProviderCard;

                const showSelectFacebookPage =
                  primaryProviderCard &&
                  connection !== null &&
                  connection.provider === "meta" &&
                  connection.status === "authorized" &&
                  canManage &&
                  !hasSelectedFacebookPage &&
                  !shouldReconnectMeta;

                return (
                  <article
                    key={card.key}
                    className={
                      showConnectedPageCard
                        ? "group relative min-w-0 rounded-xl bg-transparent p-1"
                        : "group relative min-w-0 rounded-xl border border-slate-200 bg-white p-3 transition-[border-color,box-shadow,transform] duration-150 hover:z-40 hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] focus-within:z-40 focus-within:border-slate-300 focus-within:shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
                    }
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

                    {showConnectedPageCard ? (
                      <div className="relative flex min-h-13 w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                        {account?.profileImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={account.profileImageUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-10 w-10 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600">
                            {connectedAccountLabel
                              ?.slice(0, 1)
                              .toUpperCase()}
                          </span>
                        )}

                        <div className="min-w-0 flex-1 pr-6">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            {card.accountPlatform ===
                            "facebook"
                              ? "Page"
                              : "Account"}
                          </p>
                          <p className="truncate text-[14px] font-medium text-slate-950">
                            {connectedAccountLabel}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={
                            busyConnectionId ===
                            connection.id
                          }
                          onClick={() => {
                            if (
                              connection.provider ===
                                "meta" &&
                              card.accountPlatform ===
                                "facebook"
                            ) {
                              void clearFacebookPageForReselect(
                                connection,
                              );
                              return;
                            }

                            if (
                              connection.provider ===
                                "meta" &&
                              card.accountPlatform ===
                                "instagram"
                            ) {
                              void clearInstagram(connection);
                              return;
                            }

                            if (
                              connection.provider ===
                                "meta" &&
                              card.accountPlatform ===
                                "threads"
                            ) {
                              void clearThreads(connection);
                              return;
                            }

                            void disconnectProvider(
                              connection,
                            );
                          }}
                          className="absolute right-2 top-2 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                          aria-label={
                            connection.provider ===
                              "meta" &&
                            card.accountPlatform ===
                              "facebook"
                              ? "Remove Facebook Page to pick another"
                              : connection.provider ===
                                  "meta" &&
                                card.accountPlatform ===
                                  "instagram"
                              ? "Disconnect Instagram"
                              : connection.provider ===
                                  "meta" &&
                                card.accountPlatform ===
                                  "threads"
                              ? "Disconnect Threads"
                              : `Disconnect ${card.label}`
                          }
                          title={
                            connection.provider ===
                              "meta" &&
                            card.accountPlatform ===
                              "facebook"
                              ? "Remove Page to pick another"
                              : connection.provider ===
                                  "meta" &&
                                card.accountPlatform ===
                                  "instagram"
                              ? "Disconnect Instagram"
                              : connection.provider ===
                                  "meta" &&
                                card.accountPlatform ===
                                  "threads"
                              ? "Disconnect Threads"
                              : "Disconnect"
                          }
                        >
                          {busyConnectionId ===
                          connection.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          !canStart || busy
                        }
                        aria-busy={busy}
                        onClick={() => {
                          if (
                            card.accountPlatform === "instagram" &&
                            instagramAttachDecision?.allowed &&
                            metaConnection
                          ) {
                            void connectInstagram(metaConnection);
                            return;
                          }
                          if (
                            card.accountPlatform === "threads" &&
                            threadsAttachDecision?.allowed &&
                            metaConnection
                          ) {
                            void connectThreads(metaConnection);
                            return;
                          }
                          void connectProvider(
                            card,
                          );
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
                    )}

                    {instagramAttachDecision?.allowed &&
                    metaConnection &&
                    canManage &&
                    startDecision.allowed ? (
                      <button
                        type="button"
                        disabled={
                          busy || busyConnectionId !== null
                        }
                        onClick={() => {
                          void connectProvider(card);
                        }}
                        className="mt-2 w-full text-center text-xs font-medium text-slate-600 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Or sign in with Instagram independently
                      </button>
                    ) : threadsAttachDecision?.allowed &&
                      metaConnection &&
                      canManage &&
                      startDecision.allowed ? (
                      <button
                        type="button"
                        disabled={
                          busy || busyConnectionId !== null
                        }
                        onClick={() => {
                          void connectProvider(card);
                        }}
                        className="mt-2 w-full text-center text-xs font-medium text-slate-600 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Or sign in with Threads independently
                      </button>
                    ) : null}

                    {showMetaAttention ? (
                      <div className="mt-2 flex flex-wrap items-center gap-3 px-1">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
                          <CircleAlert className="h-3.5 w-3.5" />
                          {metaProjection?.manageLabel ??
                            "Reconnect Facebook"}
                        </span>
                        <button
                          type="button"
                          disabled={
                            busyCardKey !== null ||
                            busyConnectionId !== null
                          }
                          onClick={() => {
                            void (async () => {
                              if (!activeBrandId || !canManage) {
                                return;
                              }
                              setBusyCardKey(card.key);
                              setNotice(null);
                              try {
                                const response = await fetch(
                                  "/api/social/facebook/reconnect",
                                  {
                                    method: "POST",
                                    credentials: "same-origin",
                                    headers: {
                                      Accept: "application/json",
                                      "Content-Type":
                                        "application/json",
                                    },
                                    body: JSON.stringify({
                                      returnPath: withSocialPreview(
                                        "/dashboard/social/facebook?connections=open",
                                        searchParams,
                                      ),
                                    }),
                                  },
                                );
                                const result =
                                  await readApiResult(response);
                                const authorizationUrl =
                                  result.authorization
                                    ?.authorizationUrl;
                                if (
                                  !response.ok ||
                                  !result.ok ||
                                  !authorizationUrl
                                ) {
                                  setNotice({
                                    tone: "error",
                                    message:
                                      result.message ??
                                      "Facebook could not be reconnected.",
                                  });
                                  return;
                                }
                                window.location.assign(
                                  authorizationUrl,
                                );
                              } catch {
                                setNotice({
                                  tone: "error",
                                  message:
                                    "Facebook could not be reached; reconnect again.",
                                });
                              } finally {
                                setBusyCardKey(null);
                              }
                            })();
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 transition hover:text-indigo-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busyCardKey === card.key ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          {metaProjection?.state === "refresh_failed"
                            ? "Try again"
                            : metaProjection?.state ===
                                "reauthorization_pending"
                              ? "Continue on Facebook"
                              : "Reconnect Facebook"}
                        </button>
                        {metaProjection?.state ===
                        "reauthorization_pending" ? (
                          <button
                            type="button"
                            disabled={
                              busyCardKey !== null ||
                              busyConnectionId !== null
                            }
                            onClick={() => {
                              void (async () => {
                                if (!activeBrandId || !canManage) {
                                  return;
                                }
                                setBusyCardKey(card.key);
                                setNotice(null);
                                try {
                                  const response = await fetch(
                                    "/api/social/facebook/reconnect/cancel",
                                    {
                                      method: "POST",
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
                                        "Reconnect could not be cancelled.",
                                    });
                                    return;
                                  }
                                  setConnections((current) =>
                                    current.map((item) =>
                                      item.id === connection?.id
                                        ? {
                                            ...item,
                                            lastErrorCode: null,
                                            lastErrorMessage: null,
                                          }
                                        : item,
                                    ),
                                  );
                                  setNotice({
                                    tone: "info",
                                    message:
                                      result.message ??
                                      "Facebook reconnect cancelled.",
                                  });
                                } catch {
                                  setNotice({
                                    tone: "error",
                                    message:
                                      "Reconnect could not be cancelled.",
                                  });
                                } finally {
                                  setBusyCardKey(null);
                                }
                              })();
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Cancel reconnect
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {card.hoverMessage ? (
                      <div
                        role="tooltip"
                        className="pointer-events-none absolute left-0 right-0 top-full z-50 mt-3 translate-y-1 rounded-2xl border border-slate-100 bg-white px-5 py-3 text-center text-[15px] text-[#2a1728] opacity-0 shadow-lg transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                      >
                        {card.hoverMessage}
                      </div>
                    ) : null}

                    {connectedAccountLabel &&
                    !showConnectedPageCard ? (
                      <p className="mt-2 truncate px-1 text-xs text-slate-500">
                        {connectedAccountLabel}
                      </p>
                    ) : null}

                    {primaryProviderCard &&
                    connection &&
                    connection.status ===
                      "pending_authorization" &&
                    canManage ? (
                      <div className="mt-2 flex flex-wrap items-center gap-3 px-1">
                        <span className="text-xs font-medium text-slate-600">
                          Authorization pending
                        </span>

                        {canContinuePending ? (
                          <button
                            type="button"
                            disabled={
                              busyConnectionId ===
                              connection.id
                            }
                            onClick={() =>
                              void continuePendingProvider(
                                connection,
                                card,
                              )
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 transition hover:text-indigo-900 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busyConnectionId ===
                              connection.id &&
                            busyCardKey ===
                              card.key ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Continue
                          </button>
                        ) : null}

                        {canCancelPending ? (
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
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {showSelectFacebookPage ? (
                      <div className="mt-2 flex flex-wrap items-center gap-3 px-1">
                        <span className="text-xs font-medium text-amber-700">
                          Select a Facebook Page to finish setup
                        </span>
                        <button
                          type="button"
                          disabled={
                            busyConnectionId ===
                              connection.id ||
                            pageSelectionConnectionId !==
                              null
                          }
                          onClick={() =>
                            setPageSelectionConnectionId(
                              connection.id,
                            )
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 transition hover:text-indigo-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Select Facebook Page
                        </button>
                      </div>
                    ) : null}

                    {primaryProviderCard &&
                    connection &&
                    canAddAnother ? (
                      <button
                        type="button"
                        disabled={
                          busyConnectionId ===
                          connection.id
                        }
                        onClick={() =>
                          void addAnotherAccount(
                            connection,
                            card,
                          )
                        }
                        className="mt-2 inline-flex items-center gap-2 px-1 text-xs font-medium text-indigo-700 transition hover:text-indigo-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyConnectionId ===
                          connection.id &&
                        busyCardKey ===
                          card.key ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Add another account
                      </button>
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

      {pageSelectionConnectionId ? (
        <FacebookPageSelectionPanel
          connectionId={pageSelectionConnectionId}
          onClose={() =>
            setPageSelectionConnectionId(null)
          }
          onConnected={(selection) => {
            const connectionId =
              pageSelectionConnectionId;

            setPageSelectionConnectionId(null);
            setNotice({
              tone: "success",
              message: `${selection.pageName} is connected.`,
            });

            // Optimistic local consistency from the selection response only —
            // never invent identity from discovery list order.
            setConnections((current) =>
              current.map((item) =>
                item.id === connectionId
                  ? {
                      ...item,
                      status: "connected",
                      accounts: [
                        {
                          id:
                            selection.socialAccountId ??
                            item.accounts.find(
                              (account) =>
                                account.status ===
                                  "connected" &&
                                account.platform ===
                                  "facebook",
                            )?.id ??
                            item.accounts[0]?.id ??
                            connectionId,
                          platform: "facebook",
                          externalAccountId: null,
                          handle: null,
                          displayName: selection.pageName,
                          status: "connected",
                          accessStatus: "selected",
                          profileImageUrl:
                            selection.profileImageUrl,
                        },
                      ],
                      lastErrorMessage: null,
                    }
                  : item,
              ),
            );

            void (async () => {
              await refreshConnectionsFromServer();
              requestSocialBrandSelectorRefresh();
              router.refresh();
            })();
          }}
        />
      ) : null}
    </div>
  );
}
