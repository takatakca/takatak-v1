"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { withSocialPreview } from "@/components/social/preview/social-preview-query";
import { MetaAdsSubscribedDashboard } from "@/components/social/platforms/meta-ads-subscribed-dashboard";

type Choice = {
  id: string;
  displayName: string;
  currency: string;
};

type StartAuthorizationResponse = {
  ok?: boolean;
  message?: string;
  authorization?: {
    authorizationUrl?: string;
  };
};

function noticeForOauth(value: string | null): string | null {
  if (value === "cancelled") {
    return "Meta Ads authorization was cancelled.";
  }
  if (value === "expired") {
    return "Meta Ads authorization expired. Start again.";
  }
  if (value === "conflict") {
    return "This Meta ad account is already connected in this workspace.";
  }
  if (value === "failed") {
    return "Meta Ads could not be connected. You can try again.";
  }
  return null;
}

async function readJson(response: Response): Promise<StartAuthorizationResponse> {
  try {
    return (await response.json()) as StartAuthorizationResponse;
  } catch {
    return {};
  }
}

export function MetaAdsConnectPage({
  activeBrandId,
  canManage,
  connectionId = null,
  state,
  connectedLabel = null,
  choices = [],
}: {
  activeBrandId: string | null;
  canManage: boolean;
  connectionId?: string | null;
  state: "connect" | "choose" | "empty" | "ready" | "ambiguous";
  connectedLabel?: string | null;
  currency?: string | null;
  choices?: Choice[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(choices[0]?.id ?? "");
  const [error, setError] = useState<string | null>(
    noticeForOauth(searchParams.get("social_oauth")),
  );

  async function startOAuth() {
    if (busy) return;

    if (!canManage) {
      setError("You do not have permission to manage social connections.");
      return;
    }

    if (!activeBrandId) {
      setError("Choose an active brand before connecting Meta Ads.");
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
          provider: "meta_ads",
          businessBrandId: activeBrandId,
          returnPath: withSocialPreview(
            "/dashboard/social/meta_ads",
            searchParams,
          ),
        }),
      });

      const result = await readJson(response);
      const authorizationUrl = result.authorization?.authorizationUrl;

      if (!response.ok || !result.ok || !authorizationUrl) {
        setError(result.message ?? "Meta Ads authorization could not be started.");
        setBusy(false);
        return;
      }

      window.location.assign(authorizationUrl);
    } catch {
      setError("Meta Ads authorization could not be started.");
      setBusy(false);
    }
  }

  async function chooseAccount() {
    if (busy || !connectionId || !selectedId) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/social/connections/${encodeURIComponent(connectionId)}/meta-ads/select`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ socialAccountId: selectedId }),
        },
      );
      const result = await readJson(response);
      if (!response.ok || !result.ok) {
        setError(result.message ?? "The Meta ad account could not be connected.");
        setBusy(false);
        return;
      }
      router.refresh();
      setBusy(false);
    } catch {
      setError("The Meta ad account could not be connected.");
      setBusy(false);
    }
  }

  async function disconnectLogin() {
    if (busy || !connectionId || !canManage) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/social/connections/${encodeURIComponent(connectionId)}?provider=meta_ads`,
        {
          method: "DELETE",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        },
      );
      const result = await readJson(response);
      if (!response.ok || !result.ok) {
        setError(result.message ?? "Meta Ads could not be disconnected.");
        setBusy(false);
        return;
      }
      router.refresh();
      setBusy(false);
    } catch {
      setError("Meta Ads could not be disconnected.");
      setBusy(false);
    }
  }

  if (state === "ready") {
    return <MetaAdsSubscribedDashboard connectedLabel={connectedLabel} />;
  }

  if (state === "ambiguous") {
    return (
      <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-950">
        More than one Meta ad account is selected for this brand. Open Manage
        connections and keep a single ad account.
      </div>
    );
  }

  return (
    <div className="space-y-7 px-1 pb-16 pt-2">
      <header>
        <h1 className="text-[30px] font-semibold leading-tight text-[#20242A]">
          Meta Ads
        </h1>
      </header>

      {state === "choose" ? (
        <section className="rounded-[18px] border border-[#c9dcff] bg-[#f3f7ff] px-7 py-6">
          <h2 className="text-[21px] font-semibold leading-7 text-[#292d34]">
            Choose a Meta ad account
          </h2>
          <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#505761]">
            This Facebook login can access more than one ad account. Connect
            one account to this brand.
          </p>
          <fieldset className="mt-5 space-y-2">
            <legend className="sr-only">Meta ad accounts</legend>
            {choices.map((choice) => (
              <label
                key={choice.id}
                className="flex cursor-pointer items-center gap-3 rounded-[12px] border border-[#d5e3ff] bg-white px-4 py-3"
              >
                <input
                  type="radio"
                  name="meta-ad-account"
                  value={choice.id}
                  checked={selectedId === choice.id}
                  onChange={() => setSelectedId(choice.id)}
                  className="h-4 w-4 accent-[#126df7]"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium text-[#20242A]">
                    {choice.displayName}
                  </span>
                  <span className="block text-sm text-[#68717a]">
                    {choice.currency}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy || !canManage || !selectedId}
              onClick={() => {
                void chooseAccount();
              }}
              className="inline-flex h-11 items-center justify-center rounded-[10px] bg-[#126df7] px-6 text-sm font-semibold text-white transition hover:bg-[#075fde] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Connecting…" : "Connect this ad account"}
            </button>
            <button
              type="button"
              disabled={busy || !canManage}
              onClick={() => {
                void disconnectLogin();
              }}
              className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[#c5ced6] bg-white px-5 text-sm font-semibold text-[#30343a] disabled:opacity-60"
            >
              Use a different Facebook login
            </button>
          </div>
        </section>
      ) : null}

      {state === "empty" ? (
        <section className="rounded-[18px] border border-[#c9dcff] bg-[#f3f7ff] px-7 py-6">
          <h2 className="text-[21px] font-semibold leading-7 text-[#292d34]">
            No ad account was available
          </h2>
          <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#505761]">
            This Facebook login does not have a Meta ad account we can read.
            Create one in Meta Ads Manager, or sign in with a Facebook user
            that can access an ad account.
          </p>
          <button
            type="button"
            disabled={busy || !canManage}
            onClick={() => {
              void disconnectLogin();
            }}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-[10px] bg-[#126df7] px-6 text-sm font-semibold text-white transition hover:bg-[#075fde] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Use a different Facebook login"
            )}
          </button>
        </section>
      ) : null}

      {state === "connect" ? (
        <section className="rounded-[18px] border border-[#c9dcff] bg-[#f3f7ff] px-7 py-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-[21px] font-semibold leading-7 text-[#292d34]">
                Connect a Meta ad account
              </h2>
              <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#505761]">
                Sign in with Facebook to choose an ad account for this brand.
                TAKATAK requests read access to ads. Facebook Page publishing
                is not included.
              </p>
            </div>
            <button
              type="button"
              disabled={busy || !canManage || !activeBrandId}
              onClick={() => {
                void startOAuth();
              }}
              className="inline-flex h-[50px] shrink-0 items-center justify-center rounded-[10px] bg-[#126df7] px-7 text-[15px] font-semibold text-white transition hover:bg-[#075fde] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Opening Facebook…" : "Connect Meta Ads"}
            </button>
          </div>
        </section>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
