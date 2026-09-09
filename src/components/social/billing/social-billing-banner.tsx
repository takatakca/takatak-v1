"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import {
  SOCIAL_BILLING_HREF,
  type SocialBillingBannerModel,
} from "@/lib/billing/social/billing-banner-policy";

const TONE_CLASS: Record<
  SocialBillingBannerModel["tone"],
  string
> = {
  info: "border-slate-200 bg-white text-slate-800",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  danger: "border-rose-200 bg-rose-50 text-rose-950",
};

export function SocialBillingBanner({
  banner,
  className = "",
}: {
  banner: SocialBillingBannerModel | null;
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!banner) {
    return null;
  }

  const onBillingTab =
    pathname.startsWith("/dashboard/social/settings") &&
    searchParams.get("tab") === "billing";

  if (onBillingTab) {
    return null;
  }

  return (
    <div
      role="status"
      className={`mb-4 flex flex-col gap-3 rounded-[12px] border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${TONE_CLASS[banner.tone]} ${className}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">{banner.title}</p>
        <p className="mt-0.5 text-sm opacity-90">{banner.body}</p>
      </div>
      <Link
        href={SOCIAL_BILLING_HREF}
        className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-[#2a1728] px-3 text-sm font-semibold text-white"
      >
        {banner.actionLabel}
      </Link>
    </div>
  );
}
