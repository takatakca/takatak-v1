"use client";

import {
  Eye,
  MapPin,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { withSocialPreview } from "@/components/social/preview/social-preview-query";

type StartAuthorizationResponse = {
  ok?: boolean;
  message?: string;
  authorization?: {
    authorizationUrl?: string;
  };
};

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

export function XConnectPage({
  activeBrandId,
  canManage,
  isConnected,
  connectedLabel,
  profileImageUrl = null,
  resolutionIssue = null,
}: {
  activeBrandId: string | null;
  canManage: boolean;
  isConnected: boolean;
  connectedLabel: string | null;
  profileImageUrl?: string | null;
  resolutionIssue?: "ambiguous" | "missing" | null;
}) {
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startOAuth() {
    if (busy) {
      return;
    }

    if (!canManage) {
      setError("You do not have permission to manage social connections.");
      return;
    }

    if (!activeBrandId) {
      setError("Choose an active brand before connecting X.");
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
          provider: "x",
          businessBrandId: activeBrandId,
          returnPath: withSocialPreview(
            "/dashboard/social/x?connections=open",
            searchParams,
          ),
        }),
      });

      const result = await readJson(response);
      const authorizationUrl = result.authorization?.authorizationUrl;

      if (!response.ok || !result.ok || !authorizationUrl) {
        setError(result.message ?? "X authorization could not be started.");
        setBusy(false);
        return;
      }

      window.location.assign(authorizationUrl);
    } catch {
      setError("X authorization could not be started.");
      setBusy(false);
    }
  }

  if (resolutionIssue === "ambiguous") {
    return (
      <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-950">
        Multiple X selections need attention. Open Manage connections and
        confirm a single X account for this brand.
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
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-lg font-semibold text-white">
              {(connectedLabel ?? "X").slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <p className="text-sm font-medium text-slate-500">X</p>
            <h1 className="text-[28px] font-semibold leading-tight text-[#20242A]">
              {connectedLabel ?? "X account"}
            </h1>
          </div>
        </header>

        <section className="rounded-[18px] border border-slate-200 bg-white px-7 py-6">
          <h2 className="text-[18px] font-semibold text-slate-950">
            Account connected
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            This X account is connected independently. Analytics will appear
            here after the next sync step.
          </p>
        </section>
      </div>
    );
  }

  const connectDisabled = busy || !canManage || !activeBrandId;

  return (
    <div className="space-y-7 px-1 pb-16 pt-2">
      <header>
        <h1 className="text-[30px] font-semibold leading-tight text-[#20242A]">
          X
        </h1>
      </header>

      <section className="flex flex-col gap-6 rounded-[18px] border border-[#a8b4ff] bg-[#ebeaff] px-7 py-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-[21px] font-semibold leading-7 text-[#292d34]">
              Connect your X account
            </h2>
            <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#505761]">
              Sign in with X to import this brand’s account. X is a paid add-on
              and needs an available slot.
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
              className="inline-flex h-[50px] items-center justify-center rounded-[10px] bg-black px-7 text-[15px] font-semibold text-white transition hover:bg-[#181818] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Opening X…" : "Connect X"}
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[18px] border border-[#e1e4e7] bg-white">
        <div className="grid lg:grid-cols-3 lg:divide-x lg:divide-[#e1e4e7]">
          <EducationColumn
            title="Get to know your audience"
            description="See how your X community grows after the account is connected."
            icon={MapPin}
            image="/social/summary/community-growth.webp"
            imageAlt="Audience growth preview"
          />
          <EducationColumn
            title="Analyze posts and reach"
            description="Understand which posts drive impressions and engagement."
            icon={Eye}
            image="/social/summary/post-reach-bg.webp"
            imageAlt="Post performance preview"
          />
          <EducationColumn
            title="Independent X login"
            description="Connect an X account through OAuth 2.0. Facebook is not required."
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
              "/dashboard/social/x?connections=open",
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
