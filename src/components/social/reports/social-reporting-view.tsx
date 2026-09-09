"use client";

import {
  BarChart3,
  FileText,
  Gem,
  Shield,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

function GemCircle({ size = "sm" }: { size?: "sm" | "md" }) {
  const wrap = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  const icon = size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#dfff32] text-[#1d1d1f] ${wrap}`}
    >
      <Gem className={icon} />
    </span>
  );
}

function UpgradeButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#2a1728] px-4 text-[13px] font-semibold text-[#dfff32] transition hover:bg-[#3b2438]"
    >
      <GemCircle />
      {label}
    </Link>
  );
}

export function SocialReportingView({
  reportsUnlocked,
  advancedUnlocked,
  billingHref,
}: {
  reportsUnlocked: boolean;
  advancedUnlocked: boolean;
  billingHref: string;
}) {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="bg-[#f5fafd] pb-16">
      <div className="px-5 pt-5 sm:px-6">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-[#1d1d1f]">
          Reporting
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-6 text-slate-500">
          Turn your data into reports or dashboards ready to analyze, share, or
          present to your clients.
        </p>
      </div>

      <div className="px-5 pt-5 sm:px-6">
        {!advancedUnlocked ? (
          <aside className="flex flex-col gap-4 rounded-2xl bg-[#eee8fb] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-3xl text-[14px] leading-6 text-[#3b3358]">
              Unlock advanced dashboards and cross-brand analytics. Create
              advanced dashboards and compare performance across multiple brands
              in a single view (includes Campaign Dashboards and TAKATAK
              Studio).
            </p>
            <UpgradeButton
              href={billingHref}
              label="Unlock advanced features"
            />
          </aside>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FeatureCard
            title="Reports"
            description="Generate pre-designed reports with your social network data. Export to PDF or PPT when the builder is ready."
            icon={FileText}
            iconClass="bg-[#e0f2fe] text-[#0284c7]"
            imageSrc="/img/reports.png"
            imageAlt=""
          >
            {reportsUnlocked ? (
              <button
                type="button"
                onClick={() =>
                  setNotice(
                    "The social report builder is not available yet. Your plan already includes reports.",
                  )
                }
                className="inline-flex h-10 items-center justify-center rounded-md bg-[#2a1728] px-4 text-[13px] font-semibold text-white transition hover:bg-[#3b2438]"
              >
                Create report
              </button>
            ) : (
              <UpgradeButton href={billingHref} label="Upgrade your plan" />
            )}
          </FeatureCard>

          <FeatureCard
            title="Campaign dashboards"
            description="Group content by campaign and measure impact across the brands in this workspace."
            icon={Shield}
            iconClass="bg-[#dcfce7] text-[#16a34a]"
            imageSrc="/img/campaign-dashboards.png"
            imageAlt=""
          >
            {advancedUnlocked ? (
              <button
                type="button"
                onClick={() =>
                  setNotice(
                    "Campaign dashboards are on this plan. The dashboard builder is not available yet.",
                  )
                }
                className="inline-flex h-10 items-center justify-center rounded-md bg-[#2a1728] px-4 text-[13px] font-semibold text-white transition hover:bg-[#3b2438]"
              >
                Open dashboards
              </button>
            ) : (
              <UpgradeButton href={billingHref} label="Upgrade your plan" />
            )}
          </FeatureCard>

          <FeatureCard
            title="TAKATAK Studio"
            description="Build custom views of your analytics without technical skills, when Studio ships."
            icon={Sparkles}
            iconClass="bg-[#ede9fe] text-[#7c3aed]"
            imageSrc="/img/studiotak.png"
            imageAlt=""
          >
            {advancedUnlocked ? (
              <button
                type="button"
                onClick={() =>
                  setNotice(
                    "TAKATAK Studio is included on this plan. The editor is not available yet.",
                  )
                }
                className="inline-flex h-10 items-center justify-center rounded-md bg-[#2a1728] px-4 text-[13px] font-semibold text-white transition hover:bg-[#3b2438]"
              >
                Open Studio
              </button>
            ) : (
              <UpgradeButton href={billingHref} label="Upgrade your plan" />
            )}
          </FeatureCard>

          <FeatureCard
            title="Looker Studio"
            description="Connect TAKATAK data to Looker Studio for custom dashboards. That connection is not wired yet."
            icon={BarChart3}
            iconClass="bg-[#fee2e2] text-[#dc2626]"
            imageSrc="/img/looker-studio.png"
            imageAlt=""
          >
            <UpgradeButton
              href={billingHref}
              label="Connect Looker Studio"
            />
          </FeatureCard>
        </div>

        <article className="relative mt-5 min-h-[148px] overflow-hidden rounded-xl border border-[#e8eaed] bg-white">
          <div className="relative z-10 flex min-h-[148px] max-w-[36rem] flex-col justify-center px-8 py-6">
            <h2 className="text-[18px] font-semibold leading-snug text-[#2a2a2a]">
              Hashtag Tracker
            </h2>
            <p className="mt-1.5 max-w-[26rem] text-[13px] leading-5 text-[#8b919a]">
              Monitor and analyze the use of a hashtag on X or Instagram and
              get data on its performance.
            </p>
            <p className="mt-3 text-[16px] font-semibold text-[#2a2a2a]">
              25€/day
            </p>
            <button
              type="button"
              onClick={() =>
                setNotice(
                  "Hashtag Tracker is not available yet. It will list real X and Instagram hashtag performance once that sync is live.",
                )
              }
              className="mt-4 inline-flex h-8 w-fit items-center justify-center rounded-md border border-[#d8dee4] bg-white px-3.5 text-[13px] font-medium text-[#6b7280] transition hover:bg-slate-50"
            >
              More information
            </button>
          </div>
          <HashtagTrackerGraphic />
        </article>
      </div>

      {notice ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default"
            onClick={() => setNotice(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setNotice(null)}
              className="absolute right-3 top-3 rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="pr-8 text-sm leading-6 text-slate-700">{notice}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="inline-flex h-9 items-center justify-center rounded-md bg-[#2a1728] px-4 text-sm font-semibold text-white"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HashtagTrackerGraphic() {
  const width = 380;
  const height = 148;
  const count = 14;
  const barWidth = 8;
  const barLength = 40;

  function pointAt(t: number) {
    const clamped = Math.min(1, Math.max(0, t));
    const rest = 1 - clamped;
    const x =
      rest ** 3 * 12 +
      3 * rest ** 2 * clamped * 70 +
      3 * rest * clamped ** 2 * 230 +
      clamped ** 3 * 368;
    const y =
      rest ** 3 * 28 +
      3 * rest ** 2 * clamped * 12 +
      3 * rest * clamped ** 2 * 88 +
      clamped ** 3 * 64;
    return { x, y };
  }

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[40%] min-w-[200px] sm:block"
      preserveAspectRatio="xMaxYMid meet"
    >
      {Array.from({ length: count }, (_, index) => {
        const t = index / (count - 1);
        const point = pointAt(t);
        return (
          <rect
            key={index}
            x={point.x - barWidth / 2}
            y={point.y - barLength / 2}
            width={barWidth}
            height={barLength}
            rx={1.5}
            fill="#c5e4f7"
          />
        );
      })}
    </svg>
  );
}

function FeatureCard({
  title,
  description,
  icon: Icon,
  iconClass,
  imageSrc,
  imageAlt,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
  imageSrc: string;
  imageAlt: string;
  children: ReactNode;
}) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-[#1d1d1f]">{title}</h2>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconClass}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 min-h-[64px] text-[13px] leading-5 text-slate-500">
        {description}
      </p>
      <div className="mt-4">{children}</div>
      <div className="mt-6 flex flex-1 items-end justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={imageAlt}
          className="h-auto w-full max-w-[280px] object-contain"
        />
      </div>
    </article>
  );
}
