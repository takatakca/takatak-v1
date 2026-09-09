"use client";

import { Gem, Loader2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { FaLinkedin } from "react-icons/fa";

import { requestSocialBrandSelectorRefresh } from "@/components/social/navigation/social-brand-selector-events";
import {
  SocialPlatformIcon,
  type SocialPlatformKey,
} from "@/components/social/navigation/social-platform-icon";
import { withSocialPreview } from "@/components/social/preview/social-preview-query";
import type {
  BrandSettingsConnection,
  BrandSettingsProviderConnection,
  BrandSettingsProviderReadiness,
} from "@/lib/brands/brand-settings-data";

type ProviderName = BrandSettingsProviderReadiness["provider"];

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
};

const CONNECTION_CARDS: ConnectionCard[] = [
  {
    key: "web",
    label: "Web",
    actionLabel: "Connect a web page",
    platform: "web",
    accountPlatform: null,
    provider: null,
    backgroundClassName: "bg-[#8790f6] hover:bg-[#7883ec]",
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
    backgroundClassName: "bg-[#b8cdd1] hover:bg-[#aac1c6]",
    textClassName: "text-white",
    planned: true,
  },
  {
    key: "facebook",
    label: "Facebook",
    actionLabel: "Connect a Facebook page",
    platform: "facebook",
    accountPlatform: "facebook",
    provider: "meta",
    backgroundClassName: "bg-[#126df7] hover:bg-[#075fde]",
    textClassName: "text-white",
  },
  {
    key: "instagram",
    label: "Instagram",
    actionLabel: "Connect an Instagram professional account",
    platform: "instagram",
    accountPlatform: "instagram",
    provider: "instagram",
    backgroundClassName: "bg-[#ff0064] hover:bg-[#e9005b]",
    textClassName: "text-white",
  },
  {
    key: "threads",
    label: "Threads",
    actionLabel: "Connect a Threads account",
    platform: "threads",
    accountPlatform: "threads",
    provider: "threads",
    backgroundClassName: "bg-black hover:bg-[#181818]",
    textClassName: "text-white",
  },
  {
    key: "x",
    label: "X",
    actionLabel: "Connect a Twitter / X account",
    platform: "x",
    accountPlatform: "x",
    provider: "x",
    backgroundClassName: "bg-[#f7fadf] hover:bg-[#eff4cc]",
    textClassName: "text-slate-900",
  },
  {
    key: "bluesky",
    label: "Bluesky",
    actionLabel: "Connect a Bluesky account",
    platform: "bluesky",
    accountPlatform: "bluesky",
    provider: "bluesky",
    backgroundClassName: "bg-[#2687f8] hover:bg-[#1478e8]",
    textClassName: "text-white",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    actionLabel: "Connect a LinkedIn account",
    platform: "linkedin",
    accountPlatform: "linkedin",
    provider: "linkedin",
    backgroundClassName: "bg-[#f7fadf] hover:bg-[#eff4cc]",
    textClassName: "text-slate-900",
  },
  {
    key: "pinterest",
    label: "Pinterest",
    actionLabel: "Connect a Pinterest account",
    platform: "pinterest",
    accountPlatform: "pinterest",
    provider: "pinterest",
    backgroundClassName: "bg-[#e60023] hover:bg-[#cc001f]",
    textClassName: "text-white",
  },
  {
    key: "tiktok-personal",
    label: "TikTok personal",
    actionLabel: "Connect a TikTok personal account",
    platform: "tiktok",
    accountPlatform: "tiktok",
    provider: "tiktok",
    backgroundClassName: "bg-black hover:bg-[#181818]",
    textClassName: "text-white",
  },
  {
    key: "tiktok-business",
    label: "TikTok business",
    actionLabel: "Connect a TikTok business account",
    platform: "tiktok_business",
    accountPlatform: "tiktok",
    provider: "tiktok",
    planned: true,
    backgroundClassName: "bg-black hover:bg-[#181818]",
    textClassName: "text-white",
  },
  {
    key: "google-business",
    label: "Google Business Profile",
    actionLabel: "Connect a Google Business Profile account",
    platform: "google_business",
    accountPlatform: "google_business",
    provider: "google",
    planned: true,
    backgroundClassName: "bg-[#4d8bf6] hover:bg-[#3c7de7]",
    textClassName: "text-white",
  },
  {
    key: "youtube",
    label: "YouTube",
    actionLabel: "Connect a YouTube channel",
    platform: "youtube",
    accountPlatform: "youtube",
    provider: "google",
    backgroundClassName: "bg-[#ff0808] hover:bg-[#e60000]",
    textClassName: "text-white",
  },
  {
    key: "twitch",
    label: "Twitch",
    actionLabel: "Connect a Twitch account",
    platform: "twitch",
    accountPlatform: "twitch",
    provider: "twitch",
    backgroundClassName: "bg-[#9146ff] hover:bg-[#8035ec]",
    textClassName: "text-white",
  },
  {
    key: "meta-ads",
    label: "Meta Ads",
    actionLabel: "Connect a Meta Ads account",
    platform: "meta_ads",
    accountPlatform: null,
    provider: null,
    backgroundClassName: "bg-[#126df7] hover:bg-[#075fde]",
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
    backgroundClassName: "bg-[#4d8bf6] hover:bg-[#3c7de7]",
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
    backgroundClassName: "bg-black hover:bg-[#181818]",
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
    backgroundClassName: "bg-[#f7fadf] hover:bg-[#eff4cc]",
    textClassName: "text-slate-900",
    planned: true,
  },
];

function accountKind(account: BrandSettingsConnection, card: ConnectionCard): string {
  if (card.accountPlatform === "facebook") return "Page";
  if (card.accountPlatform === "instagram") return "Professional account";
  if (card.accountPlatform === "tiktok") {
    const type = account.accountType?.toLowerCase() ?? "";
    if (type.includes("business")) return "Business account";
    return "Personal account";
  }
  if (card.platform === "pinterest") return "Business account";
  if (card.platform.endsWith("_ads") || card.platform === "meta_ads") {
    return "Ads account";
  }
  return "Account";
}

function accountLabel(account: BrandSettingsConnection): string {
  return (
    account.displayName?.trim() ||
    account.handle?.trim() ||
    "Connected account"
  );
}

function PlatformGlyph({
  platform,
  className,
  inverse,
}: {
  platform: SocialPlatformKey;
  className?: string;
  inverse?: boolean;
}) {
  if (platform === "linkedin") {
    return (
      <FaLinkedin
        aria-hidden="true"
        className={className}
        color={inverse ? "#ffffff" : "#0A66C2"}
      />
    );
  }

  return (
    <SocialPlatformIcon
      platform={platform}
      className={className}
      inverse={inverse}
    />
  );
}

export function BrandSettingsConnections({
  brandId,
  brandName,
  connections,
  providerConnections,
  providers,
  canManage,
}: {
  brandId: string;
  brandName: string;
  connections: BrandSettingsConnection[];
  providerConnections: BrandSettingsProviderConnection[];
  providers: BrandSettingsProviderReadiness[];
  canManage: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function providerMeta(provider: string | null) {
    if (!provider) return null;
    return providers.find((item) => item.provider === provider) ?? null;
  }

  function shellFor(provider: string | null) {
    if (!provider) return null;
    return (
      providerConnections.find(
        (item) =>
          item.provider === provider &&
          item.status !== "disconnected" &&
          item.status !== "disabled",
      ) ?? null
    );
  }

  function accountFor(card: ConnectionCard) {
    if (card.planned || !card.accountPlatform) {
      return null;
    }

    return (
      connections.find((item) => item.platform === card.accountPlatform) ??
      null
    );
  }

  async function startConnect(card: ConnectionCard) {
    if (!canManage || !card.provider || busyKey) {
      return;
    }

    const meta = providerMeta(card.provider);
    if (card.planned || !meta?.implemented) {
      setError(null);
      setMessage(`${card.label} connection is not available yet.`);
      return;
    }

    if (!meta.connectable) {
      setMessage(null);
      setError(`${card.label} is not configured for authorization yet.`);
      return;
    }

    setBusyKey(card.key);
    setMessage(null);
    setError(null);

    let redirected = false;

    try {
      const returnPath = withSocialPreview(
        "/dashboard/social/brands/settings?tab=connections",
        searchParams,
      );

      const response = await fetch("/api/social/connections/start", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: card.provider,
          businessBrandId: brandId,
          returnPath,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        authorization?: { authorizationUrl?: string };
      };

      if (!response.ok || !result.ok) {
        setError(
          result.message ?? `${card.label} could not start authorization.`,
        );
        return;
      }

      const url = result.authorization?.authorizationUrl;
      if (url) {
        redirected = true;
        window.location.assign(url);
        return;
      }

      setMessage(result.message ?? "Authorization was created.");
      router.refresh();
    } catch {
      setError("A network error occurred while starting the connection.");
    } finally {
      if (!redirected) {
        setBusyKey(null);
      }
    }
  }

  async function disconnectCard(
    card: ConnectionCard,
    account: BrandSettingsConnection,
  ) {
    if (!canManage || busyKey) {
      return;
    }

    const connectionId = account.connectionId;
    const provider = account.provider ?? card.provider;
    if (!connectionId || !provider) {
      setError("This account cannot be disconnected from here.");
      return;
    }

    const confirmed = window.confirm(
      `Disconnect ${accountLabel(account)} from ${brandName}?`,
    );
    if (!confirmed) {
      return;
    }

    setBusyKey(card.key);
    setMessage(null);
    setError(null);

    try {
      let url = `/api/social/connections/${encodeURIComponent(connectionId)}?provider=${encodeURIComponent(provider)}`;
      const method = "DELETE" as const;

      if (provider === "meta" && card.accountPlatform === "facebook") {
        url = `/api/social/connections/${encodeURIComponent(connectionId)}/pages/select`;
      } else if (provider === "meta" && card.accountPlatform === "instagram") {
        url = `/api/social/connections/${encodeURIComponent(connectionId)}/instagram`;
      } else if (provider === "meta" && card.accountPlatform === "threads") {
        url = `/api/social/connections/${encodeURIComponent(connectionId)}/threads`;
      }

      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!response.ok || result?.ok === false) {
        setError(
          result?.message ?? `${card.label} could not be disconnected.`,
        );
        return;
      }

      setMessage(result?.message ?? `${card.label} was disconnected.`);
      requestSocialBrandSelectorRefresh();
      router.refresh();
    } catch {
      setError("A network error occurred while disconnecting.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="mt-8">
      {message ? (
        <p className="mb-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mb-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
        {CONNECTION_CARDS.map((card) => {
          const account = accountFor(card);
          const meta = providerMeta(card.provider);
          const shell = shellFor(card.provider);
          const connected = Boolean(account);
          const busy = busyKey === card.key;
          const premiumLook =
            card.backgroundClassName.includes("f7fadf") ||
            (!card.planned && meta?.implemented === false);
          const facebookNeedsPage =
            card.accountPlatform === "facebook" &&
            !connected &&
            shell?.provider === "meta" &&
            (shell.status === "authorized" ||
              shell.status === "reauthorization_required");

          return (
            <article key={card.key} className="min-w-0">
              <div className="mb-3 flex items-center gap-3">
                <PlatformGlyph
                  platform={card.platform}
                  className="h-6 w-6 shrink-0"
                />
                <h3 className="truncate text-[17px] font-normal text-slate-950">
                  {card.label}
                </h3>
              </div>

              {connected && account ? (
                <div className="relative flex min-h-[52px] items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                  {account.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={account.imageUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600">
                      {accountLabel(account).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1 pr-7">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      {accountKind(account, card)}
                    </p>
                    <p className="truncate text-[14px] font-medium text-slate-950">
                      {accountLabel(account)}
                    </p>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      aria-label={`Disconnect ${card.label}`}
                      disabled={busy}
                      onClick={() => void disconnectCard(card, account)}
                      className="absolute right-2 top-2 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </button>
                  ) : null}
                </div>
              ) : facebookNeedsPage ? (
                <a
                  href={withSocialPreview(
                    "/dashboard/social/brands/settings?tab=connections&connections=open",
                    searchParams,
                  )}
                  className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md px-3 text-[15px] font-medium ${card.backgroundClassName} ${card.textClassName}`}
                >
                  Select a Facebook page
                </a>
              ) : (
                <button
                  type="button"
                  disabled={busy || !canManage}
                  title={
                    card.planned || !meta?.implemented
                      ? `${card.label} is not available yet.`
                      : !canManage
                        ? "You can view connections, but you cannot change them."
                        : card.actionLabel
                  }
                  onClick={() => void startConnect(card)}
                  className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md px-3 text-[15px] font-medium transition disabled:cursor-not-allowed ${card.backgroundClassName} ${card.textClassName}`}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {premiumLook ? (
                        <Gem className="h-4 w-4 shrink-0 text-[#7a8a12]" />
                      ) : (
                        <PlatformGlyph
                          platform={card.platform}
                          className="h-4 w-4 shrink-0"
                          inverse={card.textClassName === "text-white"}
                        />
                      )}
                      {card.actionLabel}
                    </>
                  )}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
