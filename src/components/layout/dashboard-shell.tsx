"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import type { SessionSnapshot } from "@/lib/auth/session-snapshot";

import {
  DesktopSidebar,
  MobileSidebar,
} from "./dashboard-sidebar";
import { DashboardTopbar } from "./dashboard-topbar";

export function DashboardShell({
  children,
  session,
}: {
  children: ReactNode;
  session: SessionSnapshot;
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

  return (
    <div className="min-h-screen bg-slate-50">
      <DesktopSidebar session={session} />

      <MobileSidebar
        open={mobileOpen}
        onClose={() =>
          setMobileOpen(false)
        }
        session={session}
      />

      <div className="lg:pl-64">
        <DashboardTopbar
          onOpenSidebar={() =>
            setMobileOpen(true)
          }
          session={session}
        />

        {!session.configured ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">
            Authentication is not configured.
            Add the required Supabase
            environment variables.
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
