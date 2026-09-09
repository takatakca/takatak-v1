"use client";

import { BarChart3, Gem, SquareArrowOutUpRight, Zap } from "lucide-react";
import Link from "next/link";

import { platformLabel } from "@/components/dashboard/home/format";
import {
  SocialPlatformIcon,
  type SocialPlatformKey,
} from "@/components/social/navigation/social-platform-icon";

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

export function AccountApiView({
  apiAccess,
  planName,
  billingHref,
  connectedPlatforms,
}: {
  apiAccess: boolean;
  planName: string;
  billingHref: string;
  connectedPlatforms: string[];
}) {
  const platforms = connectedPlatforms.slice(0, 4);

  return (
    <div className="mt-8 space-y-5">
      <section className="flex flex-col gap-4 rounded-xl bg-[#eef1fb] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold text-[#1d1d1f]">
            {apiAccess
              ? `API access is included on ${planName}`
              : "API access — Advanced & Custom plans"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {apiAccess
              ? "This workspace can use the TAKATAK API when tokens are issued. No API credentials exist yet, so nothing can be called from Zapier, Looker Studio, or a custom app."
              : `Use the API to build custom tools against this workspace. It is included on Advanced and Custom. This workspace is on ${planName}.`}
          </p>
        </div>
        {!apiAccess ? (
          <Link
            href={billingHref}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-[#2a1728] px-4 text-sm font-semibold text-white"
          >
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#dfff32] text-[#1d1d1f]">
              <Gem className="h-2.5 w-2.5" />
            </span>
            Upgrade your plan
          </Link>
        ) : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <article className="relative flex min-h-[280px] flex-col rounded-xl border border-slate-200 bg-white p-5">
          <span className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-md bg-[#dbeafe] text-[#2563eb]">
            <SquareArrowOutUpRight className="h-4 w-4" />
          </span>
          <h3 className="pr-12 text-lg font-semibold text-[#1d1d1f]">
            Export your data
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Pull connected-network analytics from TAKATAK when the public API is
            live. Power BI, Tableau, and Looker Studio are not connected yet.
          </p>
          <div className="mt-8 flex flex-1 items-center justify-center">
            {platforms.length > 0 ? (
              <ul className="flex flex-wrap justify-center gap-2">
                {platforms.map((platform) => (
                  <li
                    key={platform}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                  >
                    {isPlatformKey(platform) ? (
                      <SocialPlatformIcon
                        platform={platform}
                        className="h-3.5 w-3.5"
                      />
                    ) : null}
                    {platformLabel(platform)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200">
                No connected networks to export yet
              </p>
            )}
          </div>
        </article>

        <article className="relative flex min-h-[280px] flex-col rounded-xl border border-slate-200 bg-white p-5">
          <span className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-[#ede9fe] text-[#6d28d9]">
            <Zap className="h-4 w-4" />
          </span>
          <h3 className="pr-12 text-lg font-semibold text-[#1d1d1f]">
            Automate your workflow
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Trigger actions from social activity through the TAKATAK API.
            Zapier, Make, and similar connectors are not available yet.
          </p>
          <div className="mt-8 flex flex-1 items-center justify-center">
            <div className="w-full max-w-[220px] space-y-2">
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
                Tokens not issued
              </div>
              <div className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200">
                Dashboard APIs stay internal
              </div>
            </div>
          </div>
        </article>

        <article className="relative flex min-h-[280px] flex-col rounded-xl border border-slate-200 bg-white p-5">
          <span className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-md bg-[#dbeafe] text-[#2563eb]">
            <BarChart3 className="h-4 w-4" />
          </span>
          <h3 className="pr-12 text-lg font-semibold text-[#1d1d1f]">
            Build custom reports
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Custom report builders and API exports are planned. This page does
            not invent dashboard totals or third-party report tools.
          </p>
          <div className="mt-8 flex flex-1 items-end justify-center gap-2 pb-2">
            <span className="h-8 w-6 rounded-t-sm bg-slate-200" />
            <span className="h-14 w-6 rounded-t-sm bg-slate-300" />
            <span className="h-10 w-6 rounded-t-sm bg-slate-200" />
            <span className="h-16 w-6 rounded-t-sm bg-[#c7d7ff]" />
          </div>
        </article>
      </div>
    </div>
  );
}
