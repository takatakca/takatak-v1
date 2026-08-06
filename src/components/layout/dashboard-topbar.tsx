"use client";

import {
  Bell,
  ChevronsUpDown,
  Menu,
  Plus,
  Search,
} from "lucide-react";
import { UserProfileMenu } from "@/components/layout/user-profile-menu";
import type { SessionSnapshot } from "@/lib/auth/session-snapshot";

export function DashboardTopbar({
  onOpenSidebar,
  session,
}: {
  onOpenSidebar: () => void;
  session: SessionSnapshot;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open sidebar"
        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        type="button"
        disabled
        title="Workspace switcher — coming soon"
        className="hidden items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200 opacity-70 sm:flex"
      >
        {session.activeClientName ?? "All clients"}

        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Coming soon
        </span>

        <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      <div className="relative ml-auto hidden w-full max-w-xs md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <input
          disabled
          placeholder="Search — coming soon"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-600 placeholder:text-slate-400"
        />
      </div>

      <button
        type="button"
        disabled
        title="Create — coming soon"
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white opacity-70 md:ml-0"
      >
        <Plus className="h-4 w-4" />

        <span className="hidden sm:inline">
          Create New
        </span>
      </button>

      <button
        type="button"
        disabled
        aria-label="Notifications — coming soon"
        className="rounded-md p-2 text-slate-500 opacity-70"
      >
        <Bell className="h-5 w-5" />
      </button>

      <UserProfileMenu session={session} />
    </header>
  );
}