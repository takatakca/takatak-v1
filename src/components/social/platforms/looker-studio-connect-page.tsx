"use client";

import { BarChart3, FileBarChart2, RefreshCw, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { withSocialPreview } from "@/components/social/preview/social-preview-query";
import { LookerStudioSubscribedDashboard } from "@/components/social/platforms/looker-studio-subscribed-dashboard";

type Choice = {
  id: string;
  displayName: string;
  owner: string;
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
    return "Looker Studio authorization was cancelled.";
  }
  if (value === "expired") {
    return "Looker Studio authorization expired. Start again.";
  }
  if (value === "conflict") {
    return "This Looker Studio report is already connected in this workspace.";
  }
  if (value === "failed") {
    return "Looker Studio could not be connected. You can try again.";
  }
  return null;
}

async function readJson(
  response: Response,
): Promise<StartAuthorizationResponse> {
  try {
    return (await response.json()) as StartAuthorizationResponse;
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

        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eeedff] text-[#6C63FF]">
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

export function LookerStudioConnectPage({
  activeBrandId,
  canManage,
  connectionId = null,
  state,
  hasSocialHistory,
  connectedLabel = null,
  owner = null,
  reportUrl = null,
  choices = [],
}: {
  activeBrandId: string | null;
  canManage: boolean;
  connectionId?: string | null;
  state: "connect" | "choose" | "empty" | "ready" | "ambiguous";
  hasSocialHistory: boolean;
  connectedLabel?: string | null;
  owner?: string | null;
  reportUrl?: string | null;
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
      setError("Choose an active brand before connecting Looker Studio.");
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
          provider: "looker_studio",
          businessBrandId: activeBrandId,
          returnPath: withSocialPreview(
            "/dashboard/social/looker_studio?connections=open",
            searchParams,
          ),
        }),
      });

      const result = await readJson(response);
      const authorizationUrl = result.authorization?.authorizationUrl;

      if (!response.ok || !result.ok || !authorizationUrl) {
        setError(
          result.message ??
            "Looker Studio authorization could not be started.",
        );
        setBusy(false);
        return;
      }

      window.location.assign(authorizationUrl);
    } catch {
      setError("Looker Studio authorization could not be started.");
      setBusy(false);
    }
  }

  async function chooseReport() {
    if (busy || !connectionId || !selectedId) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/social/connections/${encodeURIComponent(connectionId)}/looker-studio/select`,
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
          result.message ?? "The Looker Studio report could not be connected.",
        );
        setBusy(false);
        return;
      }
      router.refresh();
      setBusy(false);
    } catch {
      setError("The Looker Studio report could not be connected.");
      setBusy(false);
    }
  }

  if (state === "ambiguous") {
    return (
      <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-950">
        Multiple Looker Studio selections need attention. Open Manage
        connections and confirm a single report for this brand.
      </div>
    );
  }

  if (state === "ready" || state === "empty") {
    return (
      <LookerStudioSubscribedDashboard
        connectedLabel={connectedLabel}
        owner={owner}
      />
    );
  }

  if (state === "choose" && choices.length > 0) {
    return (
      <div className="space-y-7 px-1 pt-2">
        <header>
          <h1 className="text-[30px] font-semibold leading-tight text-[#20242A]">
            Looker Studio
          </h1>
        </header>

        <section className="rounded-[18px] border border-[#d7d4ff] bg-[#f4f2ff] px-7 py-6">
          <h2 className="text-[21px] font-semibold leading-7 text-[#292d34]">
            Choose a Looker Studio report
          </h2>
          <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#505761]">
            This Google login can access more than one report. Connect one
            report to this brand.
          </p>
          <fieldset className="mt-5 space-y-2">
            <legend className="sr-only">Looker Studio reports</legend>
            {choices.map((choice) => (
              <label
                key={choice.id}
                className="flex cursor-pointer items-center gap-3 rounded-[12px] border border-[#e4e7c8] bg-white px-4 py-3"
              >
                <input
                  type="radio"
                  name="looker-studio-report"
                  value={choice.id}
                  checked={selectedId === choice.id}
                  onChange={() => setSelectedId(choice.id)}
                  className="h-4 w-4 accent-[#6C63FF]"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium text-[#20242A]">
                    {choice.displayName}
                  </span>
                  <span className="block text-sm text-[#68717a]">
                    {choice.owner}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            disabled={busy || !canManage || !selectedId}
            onClick={() => {
              void chooseReport();
            }}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-[10px] bg-[#6C63FF] px-6 text-sm font-semibold text-white transition hover:bg-[#5b53e6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Connecting…" : "Connect this report"}
          </button>
          {error ? (
            <p className="mt-3 text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    );
  }

  if (hasSocialHistory && state === "connect") {
    return (
      <div className="space-y-7 px-1 pt-2">
        <header>
          <h1 className="text-[30px] font-semibold leading-tight text-[#20242A]">
            Looker Studio
          </h1>
        </header>

        <section className="flex flex-col gap-5 rounded-[18px] border border-[#e1e4e7] bg-white px-7 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#6C63FF] text-lg font-semibold text-white">
              L
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[18px] font-semibold text-[#20242A]">
                No Looker Studio report connected
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#505761]">
                Your saved Looker Studio history remains stored. Reconnect the
                same report to restore it.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={busy || !canManage || !activeBrandId}
            onClick={() => {
              void startOAuth();
            }}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-[10px] bg-[#6C63FF] px-6 text-sm font-semibold text-white transition hover:bg-[#5b53e6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Opening Google…" : "Reconnect Looker Studio"}
          </button>
        </section>

        {error ? (
          <p className="text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const connectDisabled = busy || !canManage || !activeBrandId;

  return (
    <div className="space-y-7 px-1 pb-16 pt-2">
      <header>
        <h1 className="text-[30px] font-semibold leading-tight text-[#20242A]">
          Looker Studio
        </h1>
      </header>

      <section className="flex flex-col gap-6 rounded-[18px] border border-[#d7d4ff] bg-[#f4f2ff] px-7 py-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-[21px] font-semibold leading-7 text-[#292d34]">
              Connect your Looker Studio report
            </h2>
            <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#505761]">
              Sign in with Google to import a report for this brand. Looker
              Studio uses its own Google login. YouTube, Business Profile, and
              Google Ads stay separate.
            </p>
            {error ? (
              <p className="mt-3 text-sm text-rose-700" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
            <button
              type="button"
              disabled={connectDisabled}
              onClick={() => {
                void startOAuth();
              }}
              className="inline-flex h-[50px] items-center justify-center rounded-[10px] bg-[#6C63FF] px-7 text-[15px] font-semibold text-white transition hover:bg-[#5b53e6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Opening Google…" : "Connect Looker Studio"}
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[18px] border border-[#e1e4e7] bg-white">
        <div className="grid lg:grid-cols-3 lg:divide-x lg:divide-[#e1e4e7]">
          <EducationColumn
            title="Know the report"
            description="Import the Looker Studio report that belongs to this brand."
            icon={FileBarChart2}
            image="/social/summary/community-growth.webp"
            imageAlt="Report preview"
          />
          <EducationColumn
            title="Open it here"
            description="View the connected report from this page after Google authorization."
            icon={BarChart3}
            image="/social/summary/post-reach-bg.webp"
            imageAlt="Dashboard preview"
          />
          <EducationColumn
            title="Independent Google login"
            description="Connect Looker Studio on its own. YouTube, Business Profile, and Google Ads are not reused."
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
              "/dashboard/social/looker_studio?connections=open",
              searchParams,
            )}
            className="mt-5 inline-flex h-12 items-center justify-center rounded-[10px] border border-[#493546] bg-white px-5 text-[15px] font-medium text-[#342431] transition hover:bg-[#f8f8f8]"
          >
            Connect social networks
          </Link>
        </div>
      </section>
    </div>
  );
}
