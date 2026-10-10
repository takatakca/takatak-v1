"use client";

import {
  BarChart3,
  Building2,
  MapPin,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { withSocialPreview } from "@/components/social/preview/social-preview-query";
import { GoogleBusinessLocationDashboard } from "@/components/social/platforms/google-business-location-dashboard";

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

export function GoogleBusinessConnectPage({
  activeBrandId,
  canManage,
  isConnected,
  accountName,
  profileImageUrl = null,
  resolutionIssue = null,
}: {
  activeBrandId: string | null;
  canManage: boolean;
  isConnected: boolean;
  accountName: string | null;
  profileImageUrl?: string | null;
  resolutionIssue?: "ambiguous" | "missing" | null;
}) {
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    null,
  );

  async function startGoogleBusinessOAuth() {
    if (busy) return;

    if (!canManage) {
      setError(
        "You do not have permission to manage social connections.",
      );
      return;
    }

    if (!activeBrandId) {
      setError(
        "Choose an active brand before connecting Google Business Profile.",
      );
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/social/connections/start",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: "google_business",
            googlePurpose: "google_business",
            businessBrandId: activeBrandId,
            returnPath: withSocialPreview(
              "/dashboard/social/google_business",
              searchParams,
            ),
          }),
        },
      );

      const result = await readJson(response);
      const authorizationUrl =
        result.authorization?.authorizationUrl;

      if (
        !response.ok ||
        !result.ok ||
        !authorizationUrl
      ) {
        setError(
          result.message ??
            "Google Business Profile authorization could not be started.",
        );
        setBusy(false);
        return;
      }

      window.location.assign(authorizationUrl);
    } catch {
      setError(
        "Google Business Profile authorization could not be started.",
      );
      setBusy(false);
    }
  }

  if (resolutionIssue === "ambiguous") {
    return (
      <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-5 py-6 text-sm leading-6 text-amber-950">
        Multiple Google Business locations are assigned to this
        brand. Open Manage connections and keep one selected
        location for this analytics page.
      </div>
    );
  }

  if (isConnected && accountName) {
    return (
      <div className="min-h-full bg-white">
        <GoogleBusinessLocationDashboard
          accountName={accountName}
          profileImageUrl={profileImageUrl}
        />
      </div>
    );
  }

  return (
    <div className="space-y-7 px-1 pb-16 pt-2">
      <header>
        <h1 className="text-[30px] font-semibold leading-tight text-[#20242a]">
          Google Business Profile
        </h1>
      </header>

      <section className="flex flex-col gap-6 rounded-[18px] border border-[#a8b4ff] bg-[#ebeaff] px-7 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div className="min-w-0">
          <h2 className="text-[21px] font-semibold leading-7 text-[#292d34]">
            Connect a Google Business Profile
          </h2>
          <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#505761]">
            Sign in with Google to connect this brand’s business
            location. This authorization is independent from
            YouTube.
          </p>

          {error ? (
            <p
              className="mt-3 text-sm text-rose-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          disabled={
            busy || !canManage || !activeBrandId
          }
          onClick={() => {
            void startGoogleBusinessOAuth();
          }}
          className="inline-flex h-[50px] shrink-0 items-center justify-center rounded-[10px] bg-[#2c1929] px-7 text-[15px] font-semibold text-[#ddff35] transition hover:bg-[#3b2237] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy
            ? "Opening Google…"
            : "Connect Google Business Profile"}
        </button>
      </section>

      <section className="grid overflow-hidden rounded-[18px] border border-[#e1e4e7] bg-white lg:grid-cols-3 lg:divide-x lg:divide-[#e1e4e7]">
        {[
          {
            title: "Understand your visibility",
            description:
              "Review how customers discover your location through Google Search and Maps.",
            icon: MapPin,
          },
          {
            title: "Measure customer actions",
            description:
              "Track website visits, telephone calls and direction requests.",
            icon: BarChart3,
          },
          {
            title: "Manage location performance",
            description:
              "Keep Google Business Profile reporting separate from YouTube analytics.",
            icon: Building2,
          },
        ].map(({ title, description, icon: Icon }) => (
          <article
            key={title}
            className="min-h-[230px] px-7 py-8"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#efeeff] text-[#292531]">
              <Icon className="h-6 w-6" />
            </span>
            <h2 className="mt-6 text-[18px] font-medium text-[#30343a]">
              {title}
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#68717a]">
              {description}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
