"use client";

import { Share2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { platformLabel } from "@/components/dashboard/home/format";
import {
  SocialPlatformIcon,
  type SocialPlatformKey,
} from "@/components/social/navigation/social-platform-icon";
import { withSocialPreview } from "@/components/social/preview/social-preview-query";
import type { AccountIntegrationsPageData } from "@/lib/account/account-integrations-data";

const PLATFORM_KEYS: SocialPlatformKey[] = [
  "facebook",
  "instagram",
  "threads",
  "x",
  "bluesky",
  "linkedin",
  "pinterest",
  "tiktok",
  "google_business",
  "youtube",
  "twitch",
];

function isPlatformKey(value: string): value is SocialPlatformKey {
  return PLATFORM_KEYS.includes(value as SocialPlatformKey);
}

export function AccountIntegrationsView({
  data,
}: {
  data: AccountIntegrationsPageData;
}) {
  const searchParams = useSearchParams();

  if (data.source === "unavailable") {
    return (
      <section className="mt-8 rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
        <p className="mt-2 text-sm text-slate-500">{data.message}</p>
      </section>
    );
  }

  const connectionsHref = withSocialPreview(
    "/dashboard/social/brands/settings?tab=connections",
    searchParams,
  );
  const aiHref = withSocialPreview(
    "/dashboard/social/brands/settings?tab=ai",
    searchParams,
  );

  const accountChips = data.connectedAccounts
    .slice(0, 4)
    .map((account) => {
      const label =
        account.displayName?.trim() ||
        account.handle?.trim() ||
        platformLabel(account.platform);
      return { platform: account.platform, label };
    });

  return (
    <div className="mt-8">
      <div className="grid gap-5 lg:grid-cols-2">
        <Link
          href={connectionsHref}
          className="group relative flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:shadow-sm"
        >
          <span className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-lg bg-[#2a1728] text-white">
            <Share2 className="h-5 w-5" />
          </span>
          <h2 className="pr-14 text-[22px] font-semibold tracking-tight text-[#1d1d1f]">
            Social networks
          </h2>
          <p className="mt-2 max-w-[36rem] text-sm leading-6 text-slate-500">
            Connect and manage Facebook, Instagram, YouTube, TikTok, and more
            for {data.workspaceName}. Accounts are attached per brand.
          </p>
          <div className="relative mt-8 flex flex-1 items-center justify-center">
            <div className="absolute h-36 w-52 rounded-2xl bg-gradient-to-br from-[#5b3a7a] via-[#2a1728] to-[#dfff32] opacity-90" />
            {accountChips.length > 0 ? (
              <ul className="relative z-10 flex max-w-sm flex-wrap justify-center gap-2">
                {accountChips.map((chip, index) => (
                  <li
                    key={`${chip.platform}-${chip.label}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-sm ring-1 ring-slate-200"
                  >
                    {isPlatformKey(chip.platform) ? (
                      <SocialPlatformIcon
                        platform={chip.platform}
                        className="h-3.5 w-3.5"
                      />
                    ) : null}
                    {chip.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="relative z-10 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
                No accounts connected
              </p>
            )}
          </div>
          <p className="mt-6 text-sm text-slate-500">
            {data.connectedAccounts.length === 0
              ? "No social accounts are connected on this workspace."
              : `${data.connectedAccounts.length} connected account${data.connectedAccounts.length === 1 ? "" : "s"} across ${data.connectedPlatforms.length} network${data.connectedPlatforms.length === 1 ? "" : "s"}.`}
          </p>
        </Link>

        <Link
          href={aiHref}
          className="group relative flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:shadow-sm"
        >
          <span className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-[#6d4aff] text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <h2 className="pr-14 text-[22px] font-semibold tracking-tight text-[#1d1d1f]">
            Brand AI
          </h2>
          <p className="mt-2 max-w-[36rem] text-sm leading-6 text-slate-500">
            Writing instructions for captions and replies on connected
            platforms. This is TAKATAK brand configuration, not a Claude or
            ChatGPT MCP connection.
          </p>
          <div className="relative mt-8 flex flex-1 items-center justify-center">
            <div className="relative z-10 w-full max-w-xs space-y-2">
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 shadow-sm ring-1 ring-slate-200">
                <span
                  className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                    data.brandsWithAiInstructions > 0
                      ? "bg-emerald-500"
                      : "bg-slate-300"
                  }`}
                />
                {data.brandsWithAiInstructions > 0
                  ? "Instructions saved"
                  : "No instructions yet"}
              </div>
              <div className="ml-6 rounded-xl bg-white px-3 py-2 text-xs text-slate-500 shadow-sm ring-1 ring-slate-200">
                {data.brandCount === 0
                  ? "Add a brand to configure AI."
                  : `${data.brandsWithAiInstructions} of ${data.brandCount} brand${data.brandCount === 1 ? "" : "s"} have instructions.`}
              </div>
            </div>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            Open AI Configuration on the current brand to edit instructions.
          </p>
        </Link>
      </div>
    </div>
  );
}
