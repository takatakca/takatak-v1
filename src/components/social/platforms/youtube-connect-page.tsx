"use client";

import {
  Eye,
  MapPin,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { withSocialPreview } from "@/components/social/preview/social-preview-query";

type StartAuthorizationResponse = {
  ok?: boolean;
  message?: string;
  authorization?: {
    authorizationUrl?: string;
  };
};

type YoutubeChannelOption = {
  socialAccountId: string;
  name: string;
  handle: string | null;
  profileImageUrl: string | null;
  selected: boolean;
};

async function readJson(
  response: Response,
): Promise<StartAuthorizationResponse & { channels?: YoutubeChannelOption[] }> {
  try {
    return (await response.json()) as StartAuthorizationResponse & {
      channels?: YoutubeChannelOption[];
    };
  } catch {
    return {};
  }
}

function EducationColumn({
  title,
  description,
  icon: Icon,
  image,
  imageAlt,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  image: string;
  imageAlt: string;
}) {
  return (
    <article className="flex min-h-[420px] flex-col overflow-hidden bg-white px-7 pt-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[18px] font-medium leading-7 text-[#30343a]">
            {title}
          </h2>
          <p className="mt-2 max-w-[280px] text-[14px] leading-6 text-[#68717a]">
            {description}
          </p>
        </div>

        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#efeeff] text-[#292531]">
          <Icon className="h-6 w-6" strokeWidth={1.7} />
        </span>
      </div>

      <div className="relative mt-auto h-[250px] w-full">
        <Image
          src={image}
          alt={imageAlt}
          fill
          sizes="(min-width: 1024px) 30vw, 100vw"
          className="object-contain object-bottom"
        />
      </div>
    </article>
  );
}

export function YoutubeConnectPage({
  activeBrandId,
  canManage,
  isConnected,
  connectedLabel,
  profileImageUrl = null,
  resolutionIssue = null,
  needsSelectionConnectionId = null,
}: {
  activeBrandId: string | null;
  canManage: boolean;
  isConnected: boolean;
  connectedLabel: string | null;
  profileImageUrl?: string | null;
  resolutionIssue?: "ambiguous" | "missing" | null;
  needsSelectionConnectionId?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<YoutubeChannelOption[] | null>(null);

  useEffect(() => {
    if (!needsSelectionConnectionId) {
      return;
    }

    const connectionId = needsSelectionConnectionId;
    if (!connectionId) {
      return;
    }

    let cancelled = false;

    async function loadChannels() {
      try {
        const response = await fetch(
          `/api/social/connections/${encodeURIComponent(
            connectionId,
          )}/youtube`,
          {
            credentials: "same-origin",
            headers: { Accept: "application/json" },
          },
        );
        const result = await readJson(response);
        if (cancelled) return;
        if (!response.ok || !result.ok) {
          setError(result.message ?? "YouTube channels could not be loaded.");
          setChannels([]);
          return;
        }
        setChannels(result.channels ?? []);
      } catch {
        if (!cancelled) {
          setError("YouTube channels could not be loaded.");
          setChannels([]);
        }
      }
    }

    void loadChannels();
    return () => {
      cancelled = true;
    };
  }, [needsSelectionConnectionId]);

  async function startGoogleOAuth() {
    if (busy) return;

    if (!canManage) {
      setError("You do not have permission to manage social connections.");
      return;
    }

    if (!activeBrandId) {
      setError("Choose an active brand before connecting YouTube.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/social/connections/start", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "google",
          businessBrandId: activeBrandId,
          returnPath: withSocialPreview(
            "/dashboard/social/youtube",
            searchParams,
          ),
        }),
      });

      const result = await readJson(response);
      const authorizationUrl = result.authorization?.authorizationUrl;

      if (!response.ok || !result.ok || !authorizationUrl) {
        setError(result.message ?? "YouTube authorization could not be started.");
        setBusy(false);
        return;
      }

      window.location.assign(authorizationUrl);
    } catch {
      setError("YouTube authorization could not be started.");
      setBusy(false);
    }
  }

  async function selectChannel(socialAccountId: string) {
    if (busy || !needsSelectionConnectionId) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/social/connections/${encodeURIComponent(
          needsSelectionConnectionId,
        )}/youtube`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ socialAccountId }),
        },
      );
      const result = await readJson(response);
      if (!response.ok || !result.ok) {
        setError(result.message ?? "The YouTube channel could not be selected.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("The YouTube channel could not be selected.");
      setBusy(false);
    }
  }

  if (resolutionIssue === "ambiguous") {
    return (
      <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-950">
        Multiple YouTube channel selections need attention. Open Manage
        connections and confirm a single channel for this brand.
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="space-y-7 px-1 pb-16 pt-2">
        <header className="flex items-center gap-4">
          {profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profileImageUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ff0000] text-lg font-semibold text-white">
              {(connectedLabel ?? "YouTube").slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <p className="text-sm font-medium text-slate-500">YouTube</p>
            <h1 className="text-[28px] font-semibold leading-tight text-[#20242A]">
              {connectedLabel ?? "YouTube channel"}
            </h1>
          </div>
        </header>

        <section className="rounded-[18px] border border-slate-200 bg-white px-7 py-6">
          <h2 className="text-[18px] font-semibold text-slate-950">
            Channel connected
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            This YouTube channel is connected with Google. Analytics will appear
            here after the next sync step. Google Business Profile stays
            unavailable until Google approves API access.
          </p>
        </section>
      </div>
    );
  }

  if (needsSelectionConnectionId) {
    return (
      <div className="space-y-7 px-1 pb-16 pt-2">
        <header>
          <h1 className="text-[30px] font-semibold leading-tight text-[#20242A]">
            YouTube
          </h1>
        </header>

        <section className="rounded-[18px] border border-[#a8b4ff] bg-[#ebeaff] px-7 py-6">
          <h2 className="text-[21px] font-semibold leading-7 text-[#292d34]">
            Choose a YouTube channel
          </h2>
          <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#505761]">
            Google is authorized. Select the channel this brand should use.
          </p>
          {error ? (
            <p className="mt-3 text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            {channels === null ? (
              <p className="text-sm text-slate-600">Loading channels…</p>
            ) : channels.length === 0 ? (
              <p className="text-sm text-slate-600">
                No YouTube channel was found on this Google account.
              </p>
            ) : (
              channels.map((channel) => (
                <button
                  key={channel.socialAccountId}
                  type="button"
                  disabled={busy || !canManage}
                  onClick={() => {
                    void selectChannel(channel.socialAccountId);
                  }}
                  className="flex w-full items-center gap-3 rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {channel.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={channel.profileImageUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff0000] text-sm font-semibold text-white">
                      {channel.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-950">
                      {channel.name}
                    </span>
                    {channel.handle ? (
                      <span className="block text-xs text-slate-500">
                        {channel.handle}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-7 px-1 pb-16 pt-2">
      <header>
        <h1 className="text-[30px] font-semibold leading-tight text-[#20242A]">
          YouTube
        </h1>
      </header>

      <section className="flex flex-col gap-6 rounded-[18px] border border-[#a8b4ff] bg-[#ebeaff] px-7 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div className="min-w-0">
          <h2 className="text-[21px] font-semibold leading-7 text-[#292d34]">
            Connect your YouTube channel
          </h2>
          <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#505761]">
            Sign in with Google, then TAKATAK uses the YouTube channel on that
            account. Google Business Profile is not part of this step.
          </p>
          {error ? (
            <p className="mt-3 text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          disabled={busy || !canManage || !activeBrandId}
          onClick={() => {
            void startGoogleOAuth();
          }}
          className="inline-flex h-[50px] shrink-0 items-center justify-center rounded-[10px] bg-[#2c1929] px-7 text-[15px] font-semibold text-[#ddff35] transition hover:bg-[#3b2237] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Opening Google…" : "Connect YouTube"}
        </button>
      </section>

      <section className="overflow-hidden rounded-[18px] border border-[#e1e4e7] bg-white">
        <div className="grid lg:grid-cols-3 lg:divide-x lg:divide-[#e1e4e7]">
          <EducationColumn
            title="Get to know your audience"
            description="See how your YouTube channel grows after it is connected."
            icon={MapPin}
            image="/social/summary/community-growth.webp"
            imageAlt="Audience growth preview"
          />
          <EducationColumn
            title="Analyze videos"
            description="Understand which videos drive views and watch time."
            icon={Eye}
            image="/social/summary/post-reach-bg.webp"
            imageAlt="Video performance preview"
          />
          <EducationColumn
            title="One Google login"
            description="YouTube uses your Google account. Business Profile will use the same Google app after Google approves access."
            icon={RefreshCw}
            image="/social/summary/ad-campaigns.webp"
            imageAlt="Connected networks preview"
          />
        </div>
      </section>

      <section className="relative min-h-[245px] overflow-hidden rounded-[18px] border border-[#e1e4e7] bg-white px-8 py-9">
        <div className="relative z-10 max-w-2xl">
          <h2 className="text-[21px] font-medium leading-7 text-[#30343a]">
            Connect social networks
          </h2>
          <p className="mt-4 text-[15px] leading-6 text-[#68717a]">
            Connect your accounts to unlock analytics, scheduling and content
            management.
          </p>
          <Link
            href={withSocialPreview(
              "/dashboard/social/youtube?connections=open",
              searchParams,
            )}
            className="mt-5 inline-flex h-12 items-center justify-center rounded-[10px] border border-[#493546] bg-white px-7 text-[15px] font-medium text-[#342431] transition hover:bg-[#f8f8f8]"
          >
            Connect social networks
          </Link>
        </div>
      </section>
    </div>
  );
}
