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

import { FacebookSubscribedDashboard } from "@/components/social/platforms/facebook-subscribed-dashboard";
import { FacebookPageSyncDashboard } from "@/components/social/platforms/facebook-page-sync-dashboard";
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

export function FacebookConnectPage({
  activeBrandId,
  activeBrandName: _activeBrandName,
  canManage,
  isConnected,
  connectedLabel,
  profileImageUrl = null,
  initialSyncStatus: _initialSyncStatus = null,
  resolutionIssue = null,
}: {
  activeBrandId: string | null;
  activeBrandName: string | null;
  canManage: boolean;
  isConnected: boolean;
  connectedLabel: string | null;
  profileImageUrl?: string | null;
  initialSyncStatus?:
    | "idle"
    | "syncing"
    | "ready"
    | "empty"
    | "degraded"
    | "action_required"
    | "failed"
    | null;
  resolutionIssue?: "ambiguous" | "missing" | null;
}) {
  const searchParams = useSearchParams();
  const subscribedPreview = searchParams.get("preview") === "subscribed";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startFacebookOAuth() {
    if (busy) {
      return;
    }

    if (!canManage) {
      setError(
        "You do not have permission to manage social connections.",
      );
      return;
    }

    if (!activeBrandId) {
      setError("Choose an active brand before connecting Facebook.");
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
          provider: "meta",
          businessBrandId: activeBrandId,
          returnPath: withSocialPreview(
            "/dashboard/social/facebook",
            searchParams,
          ),
        }),
      });

      const result = await readJson(response);
      const authorizationUrl = result.authorization?.authorizationUrl;

      if (!response.ok || !result.ok || !authorizationUrl) {
        setError(
          result.message ??
            "Facebook authorization could not be started.",
        );
        setBusy(false);
        return;
      }

      // Live Meta handoff — Facebook login appears when the user is not already signed in.
      window.location.assign(authorizationUrl);
    } catch {
      setError("Facebook authorization could not be started.");
      setBusy(false);
    }
  }

  if (resolutionIssue === "ambiguous") {
    return (
      <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-950">
        Multiple Facebook Page selections need attention. Open Manage
        connections and confirm a single Page for this brand.
      </div>
    );
  }

  if (isConnected) {
    return (
      <FacebookPageSyncDashboard
        pageName={connectedLabel}
        profileImageUrl={profileImageUrl}
        initialSyncStatus={_initialSyncStatus ?? "syncing"}
      />
    );
  }

  if (subscribedPreview) {
    return <FacebookSubscribedDashboard />;
  }

  return (
    <div className="space-y-7 px-1 pb-16 pt-2">
      <header>
        <h1 className="text-[30px] font-semibold leading-tight text-[#20242A]">
          Facebook
        </h1>
      </header>

      <section className="flex flex-col gap-6 rounded-[18px] border border-[#a8b4ff] bg-[#ebeaff] px-7 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div className="min-w-0">
          <h2 className="text-[21px] font-semibold leading-7 text-[#292d34]">
            Connect your Facebook page
          </h2>
          <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#505761]">
            Discover how your community grows, what content gets the most reach
            and how you compare to your competitors.
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
            void startFacebookOAuth();
          }}
          className="inline-flex h-[50px] shrink-0 items-center justify-center rounded-[10px] bg-[#2c1929] px-7 text-[15px] font-semibold text-[#ddff35] transition hover:bg-[#3b2237] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Opening Facebook…" : "Connect Facebook"}
        </button>
      </section>

      <section className="overflow-hidden rounded-[18px] border border-[#e1e4e7] bg-white">
        <div className="grid lg:grid-cols-3 lg:divide-x lg:divide-[#e1e4e7]">
          <EducationColumn
            title="Get to know your audience"
            description="See where your followers are and how your community evolves over time."
            icon={MapPin}
            image="/social/summary/community-growth.webp"
            imageAlt="Audience growth preview"
          />
          <EducationColumn
            title="Analyze the performance of your posts and reels"
            description="Find which formats drive reach and engagement on your Facebook Page."
            icon={Eye}
            image="/social/summary/post-reach-bg.webp"
            imageAlt="Post performance preview"
          />
          <EducationColumn
            title="Monitor your competitors"
            description="Compare your Page growth against competitors from one place."
            icon={RefreshCw}
            image="/social/summary/ad-campaigns.webp"
            imageAlt="Competitor monitoring preview"
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
              "/dashboard/social/facebook?connections=open",
              searchParams,
            )}
            className="mt-5 inline-flex h-12 items-center justify-center rounded-[10px] border border-[#493546] bg-white px-7 text-[15px] font-medium text-[#342431] transition hover:bg-[#f8f8f8]"
          >
            Connect social networks
          </Link>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[278px] right-[-80px] h-[470px] w-[700px] rounded-[50%]"
          style={{
            background:
              "repeating-conic-gradient(from 202deg, #d9f5ff 0deg 2.5deg, transparent 2.5deg 6.5deg)",
            WebkitMask:
              "radial-gradient(ellipse at center, transparent 0 58%, #000 59% 67%, transparent 68%)",
            mask: "radial-gradient(ellipse at center, transparent 0 58%, #000 59% 67%, transparent 68%)",
          }}
        />
      </section>
    </div>
  );
}
