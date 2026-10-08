"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { withSocialPreview } from "@/components/social/preview/social-preview-query";

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
    return "Google Ads authorization was cancelled.";
  }
  if (value === "expired") {
    return "Google Ads authorization expired. Start again.";
  }
  if (value === "conflict") {
    return "This Google Ads account is already connected in this workspace.";
  }
  if (value === "failed") {
    return "Google Ads could not be connected. You can try again.";
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

export function GoogleAdsConnectPage({
  activeBrandId,
  canManage,
  connectionId = null,
  state,
  connectedLabel = null,
  currency = null,
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
      setError("Choose an active brand before connecting Google Ads.");
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
          provider: "google_ads",
          businessBrandId: activeBrandId,
          returnPath: withSocialPreview(
            "/dashboard/social/google_ads",
            searchParams,
          ),
        }),
      });

      const result = await readJson(response);
      const authorizationUrl = result.authorization?.authorizationUrl;

      if (!response.ok || !result.ok || !authorizationUrl) {
        setError(
          result.message ?? "Google Ads authorization could not be started.",
        );
        setBusy(false);
        return;
      }

      window.location.assign(authorizationUrl);
    } catch {
      setError("Google Ads authorization could not be started.");
      setBusy(false);
    }
  }

  async function chooseAccount() {
    if (busy || !connectionId || !selectedId) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/social/connections/${encodeURIComponent(connectionId)}/google-ads/select`,
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
        setError(
          result.message ?? "The Google Ads account could not be connected.",
        );
        setBusy(false);
        return;
      }
      router.refresh();
      setBusy(false);
    } catch {
      setError("The Google Ads account could not be connected.");
      setBusy(false);
    }
  }

  async function disconnectLogin() {
    if (busy || !connectionId || !canManage) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/social/connections/${encodeURIComponent(connectionId)}?provider=google_ads`,
        {
          method: "DELETE",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        },
      );
      const result = await readJson(response);
      if (!response.ok || !result.ok) {
        setError(result.message ?? "Google Ads could not be disconnected.");
        setBusy(false);
        return;
      }
      router.refresh();
      setBusy(false);
    } catch {
      setError("Google Ads could not be disconnected.");
      setBusy(false);
    }
  }

  if (state === "ambiguous") {
    return (
      <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-950">
        More than one Google Ads account is selected for this brand. Open
        Manage connections and keep a single ad account.
      </div>
    );
  }

  return (
    <div className="space-y-7 px-1 pb-16 pt-2">
      <header>
        <h1 className="text-[30px] font-semibold leading-tight text-[#20242A]">
          Google Ads
        </h1>
      </header>

      {state === "ready" ? (
        <section className="flex flex-col gap-5 rounded-[18px] border border-[#e1e4e7] bg-white px-7 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Ad account
            </p>
            <h2 className="mt-1 truncate text-[18px] font-semibold text-[#20242A]">
              {connectedLabel ?? "Google Ads account"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#505761]">
              {currency
                ? `Connected for this brand. Currency ${currency}.`
                : "Connected for this brand."}
            </p>
          </div>
        </section>
      ) : null}

      {state === "choose" ? (
        <section className="rounded-[18px] border border-[#c9dcff] bg-[#f3f7ff] px-7 py-6">
          <h2 className="text-[21px] font-semibold leading-7 text-[#292d34]">
            Choose a Google Ads account
          </h2>
          <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#505761]">
            This Google login can access more than one ad account. Connect one
            account to this brand.
          </p>
          <fieldset className="mt-5 space-y-2">
            <legend className="sr-only">Google Ads accounts</legend>
            {choices.map((choice) => (
              <label
                key={choice.id}
                className="flex cursor-pointer items-center gap-3 rounded-[12px] border border-[#d5e3ff] bg-white px-4 py-3"
              >
                <input
                  type="radio"
                  name="google-ad-account"
                  value={choice.id}
                  checked={selectedId === choice.id}
                  onChange={() => setSelectedId(choice.id)}
                  className="h-4 w-4 accent-[#4d8bf6]"
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
              className="inline-flex h-11 items-center justify-center rounded-[10px] bg-[#4d8bf6] px-6 text-sm font-semibold text-white transition hover:bg-[#3c7de7] disabled:cursor-not-allowed disabled:opacity-60"
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
              Use a different Google account
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
            This Google login does not have a Google Ads account we can read.
            Create one in Google Ads, or sign in with a Google user that can
            access an ad account.
          </p>
          <button
            type="button"
            disabled={busy || !canManage}
            onClick={() => {
              void disconnectLogin();
            }}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-[10px] bg-[#4d8bf6] px-6 text-sm font-semibold text-white transition hover:bg-[#3c7de7] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Use a different Google account"
            )}
          </button>
        </section>
      ) : null}

      {state === "connect" ? (
        <section className="rounded-[18px] border border-[#c9dcff] bg-[#f3f7ff] px-7 py-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-[21px] font-semibold leading-7 text-[#292d34]">
                Connect a Google Ads account
              </h2>
              <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#505761]">
                Sign in with Google to choose an ad account for this brand.
                TAKATAK requests read access to Google Ads. YouTube and
                Business Profile stay on their own connections.
              </p>
            </div>
            <button
              type="button"
              disabled={busy || !canManage || !activeBrandId}
              onClick={() => {
                void startOAuth();
              }}
              className="inline-flex h-[50px] shrink-0 items-center justify-center rounded-[10px] bg-[#4d8bf6] px-7 text-[15px] font-semibold text-white transition hover:bg-[#3c7de7] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Opening Google…" : "Connect Google Ads"}
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
