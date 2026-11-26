"use client";

import {
  BarChart3,
  FileText,
  Gem,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { useDashboardLanguage } from "@/components/layout/dashboard-language";

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

/**
 * Social reporting: only tools that work today. The monthly report builder
 * (real workspace numbers, PDF, scheduled delivery), the Social statistics and
 * the Looker Studio link. Builders that do not exist yet are not offered, and
 * nothing is sold that the account cannot use.
 */
export function SocialReportingView({
  reportsUnlocked,
  billingHref,
}: {
  reportsUnlocked: boolean;
  billingHref: string;
}) {
  const fr = useDashboardLanguage() === "fr";
  const action =
    "inline-flex h-10 items-center justify-center rounded-md bg-[#2a1728] px-4 text-[13px] font-semibold text-white transition hover:bg-[#3b2438]";

  return (
    <div className="bg-[#f5fafd] pb-16">
      <div className="px-5 pt-5 sm:px-6">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-[#1d1d1f]">
          {fr ? "Rapports" : "Reporting"}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-6 text-slate-500">
          {fr
            ? "Transformez vos données en rapports prêts à analyser, à partager ou à présenter à vos clients."
            : "Turn your data into reports ready to analyze, share, or present to your clients."}
        </p>
      </div>

      <div className="px-5 pt-5 sm:px-6">
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FeatureCard
            title={fr ? "Rapport mensuel" : "Monthly report"}
            description={
              fr
                ? "Le rapport du mois tiré de vos vrais chiffres (site, prospects, avis, publications), en PDF, et envoyé chaque mois si vous le voulez."
                : "The month's report from your real numbers (website, leads, reviews, posts), as a PDF, and sent every month if you want."
            }
            icon={FileText}
            iconClass="bg-[#e0f2fe] text-[#0284c7]"
            imageSrc="/img/reports.png"
            imageAlt=""
          >
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/reports/builder" className={action}>
                {fr ? "Créer le rapport" : "Create report"}
              </Link>
              <Link
                href="/dashboard/reports/schedules"
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                {fr ? "Envois programmés" : "Scheduled sends"}
              </Link>
            </div>
          </FeatureCard>

          <FeatureCard
            title={fr ? "Statistiques sociales" : "Social statistics"}
            description={
              fr
                ? "Portée, impressions, engagement, clics et abonnés de vos comptes branchés, avec les vrais chiffres de vos comptes."
                : "Reach, impressions, engagement, clicks and followers of your connected accounts, with your accounts' real numbers."
            }
            icon={Sparkles}
            iconClass="bg-[#ede9fe] text-[#7c3aed]"
            imageSrc="/img/studiotak.png"
            imageAlt=""
          >
            <Link href="/dashboard/social/analytics" className={action}>
              {fr ? "Voir les statistiques" : "Open statistics"}
            </Link>
          </FeatureCard>

          <FeatureCard
            title="Looker Studio"
            description={
              fr
                ? "Branchez un rapport Looker Studio pour cette marque et ouvrez-le depuis TAKATAK."
                : "Connect a Looker Studio report for this brand and open it from TAKATAK."
            }
            icon={BarChart3}
            iconClass="bg-[#fee2e2] text-[#dc2626]"
            imageSrc="/img/looker-studio.png"
            imageAlt=""
          >
            {reportsUnlocked ? (
              <Link href="/dashboard/social/looker_studio" className={action}>
                {fr ? "Brancher Looker Studio" : "Connect Looker Studio"}
              </Link>
            ) : (
              <UpgradeButton href={billingHref} label={fr ? "Brancher Looker Studio" : "Connect Looker Studio"} />
            )}
          </FeatureCard>
        </div>
      </div>
    </div>
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
