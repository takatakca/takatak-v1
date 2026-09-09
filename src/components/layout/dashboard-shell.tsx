"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import type { SessionSnapshot } from "@/lib/auth/session-snapshot";

import {
  DesktopSidebar,
  MobileSidebar,
} from "./dashboard-sidebar";
import { DashboardTopbar } from "./dashboard-topbar";
import { isWebDomainWorkspace, WebDomainShell } from "@/components/web-hosting/web-domain-shell";

export function DashboardShell({
  children,
  session,
  unreadNotificationCount = 0,
}: {
  children: ReactNode;
  session: SessionSnapshot;
  unreadNotificationCount?: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] =
    useState(false);

  const isSocialWorkspace =
    pathname === "/dashboard/social" ||
    pathname.startsWith(
      "/dashboard/social/",
    );

  /*
   * Social Media has its own application shell.
   * Authentication and workspace resolution remain
   * inside dashboard/layout.tsx.
   */
  if (isSocialWorkspace) {
    return <>{children}</>;
  }

  if (isWebDomainWorkspace(pathname)) {
    return <WebDomainShell>{children}</WebDomainShell>;
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      <DesktopSidebar session={session} />

      <MobileSidebar
        open={mobileOpen}
        onClose={() =>
          setMobileOpen(false)
        }
        session={session}
      />

      <div className="lg:pl-[260px]">
        <DashboardTopbar
          onOpenSidebar={() =>
            setMobileOpen(true)
          }
          session={session}
          unreadNotificationCount={unreadNotificationCount}
        />

        {!session.configured ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">
            Authentication is not configured.
            Add the required Supabase
            environment variables.
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
