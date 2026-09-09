"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  Database,
  FileText,
  Gauge,
  Globe,
  Layers,
  LayoutDashboard,
  Link2,
  Lock,
  Newspaper,
  Server,
  Shield,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { APP_NAME, APP_NAME_BADGE } from "@/lib/dashboard/dashboard-config";

export const WEB_DOMAIN_NAV: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Overview", href: "/dashboard/web-hosting", icon: LayoutDashboard },
  { label: "Websites", href: "/dashboard/web-hosting/websites", icon: Globe },
  { label: "Domains", href: "/dashboard/web-hosting/domains", icon: Link2 },
  { label: "SSL Certificates", href: "/dashboard/web-hosting/ssl", icon: Lock },
  { label: "Hosting", href: "/dashboard/web-hosting/environments", icon: Server },
  { label: "Pages", href: "/dashboard/web-hosting/pages", icon: FileText },
  { label: "Blog & Content", href: "/dashboard/web-hosting/blog", icon: Newspaper },
  { label: "Website Analytics", href: "/dashboard/web-hosting/analytics", icon: BarChart3 },
  { label: "Redirects", href: "/dashboard/web-hosting/redirects", icon: ArrowLeftRight },
  { label: "DNS Advanced", href: "/dashboard/web-hosting/dns", icon: Workflow },
  { label: "Backups & Restore", href: "/dashboard/web-hosting/backups", icon: Database },
  { label: "Staging", href: "/dashboard/web-hosting/staging", icon: Layers },
  { label: "Performance", href: "/dashboard/web-hosting/performance", icon: Gauge },
  { label: "Security", href: "/dashboard/web-hosting/security", icon: Shield },
];

const WEB_WORKSPACE_PREFIXES = [
  "/dashboard/web-hosting/environments",
  "/dashboard/web-hosting/pages",
  "/dashboard/web-hosting/blog",
  "/dashboard/web-hosting/analytics",
  "/dashboard/web-hosting/redirects",
  "/dashboard/web-hosting/dns",
  "/dashboard/web-hosting/backups",
  "/dashboard/web-hosting/staging",
  "/dashboard/web-hosting/performance",
  "/dashboard/web-hosting/security",
];

export function isWebDomainWorkspace(pathname: string): boolean {
  return WEB_WORKSPACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function BrandMark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 text-white">
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path fill="currentColor" d="M9.2 16.6 5.8 13.2l1.4-1.4 2 2 7.6-7.6 1.4 1.4z" />
      </svg>
    </span>
  );
}

export function WebDomainShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col bg-[#1f2125] text-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 pb-3 pt-6">
          <BrandMark />
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-tight">{APP_NAME}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
              {APP_NAME_BADGE}
            </p>
          </div>
        </div>
        <div className="px-3 pb-3">
          <Link
            href="/dashboard/web-hosting"
            className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2.5 text-[13px] font-medium text-white/80 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Web Integration
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Web & Domain
          </p>
          <div className="space-y-0.5">
            {WEB_DOMAIN_NAV.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/dashboard/web-hosting"
                  ? pathname === "/dashboard/web-hosting"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                    active ? "bg-violet-600 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>
      <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Link
          href="/dashboard/web-hosting"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Web Integration
        </Link>
        <p className="mt-2 text-sm font-semibold text-slate-900">Web & Domain</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 text-sm">
          {WEB_DOMAIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-slate-600"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="lg:pl-[260px]">
        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
