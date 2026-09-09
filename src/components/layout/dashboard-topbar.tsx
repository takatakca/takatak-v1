"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, CalendarRange, Menu } from "lucide-react";
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { UserProfileMenu } from "@/components/layout/user-profile-menu";
import type { SessionSnapshot } from "@/lib/auth/session-snapshot";
import { pageSubtitleForPath, pageTitleForPath } from "@/lib/dashboard/dashboard-config";

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 30);
  return { from: isoDate(from), to: isoDate(to) };
}

function formatRangeLabel(from: string, to: string): string {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  const sameYear = fromDate.getFullYear() === toDate.getFullYear();
  const fromLabel = fromDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const toLabel = toDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${fromLabel} - ${toLabel}`;
}

function DateRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fallback = useMemo(() => defaultRange(), []);
  const from = searchParams.get("from") ?? fallback.from;
  const to = searchParams.get("to") ?? fallback.to;
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
  }, [from, to]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function applyRange() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", draftFrom);
    params.set("to", draftTo);
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <CalendarRange className="h-4 w-4 text-slate-400" aria-hidden="true" />
        <span className="hidden sm:inline">{formatRangeLabel(from, to)}</span>
        <span className="sm:hidden">Dates</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date range</p>
          <div className="mt-3 grid gap-3">
            <label className="block text-xs font-medium text-slate-600">
              From
              <input
                type="date"
                value={draftFrom}
                max={draftTo}
                onChange={(event) => setDraftFrom(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              To
              <input
                type="date"
                value={draftTo}
                min={draftFrom}
                onChange={(event) => setDraftTo(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={applyRange}
            className="mt-3 w-full rounded-lg bg-[#1f2125] px-3 py-2 text-sm font-medium text-white"
          >
            Apply
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function DashboardTopbar({
  onOpenSidebar,
  session,
  unreadNotificationCount = 0,
}: {
  onOpenSidebar: () => void;
  session: SessionSnapshot;
  unreadNotificationCount?: number;
}) {
  const pathname = usePathname();
  const subtitle = pageSubtitleForPath(pathname);
  const showDateRange =
    pathname === "/dashboard" ||
    pathname === "/dashboard/web-hosting" ||
    pathname.startsWith("/dashboard/web-hosting/websites") ||
    pathname.startsWith("/dashboard/web-hosting/domains") ||
    pathname.startsWith("/dashboard/web-hosting/ssl") ||
    pathname.startsWith("/dashboard/web-hosting/hosting") ||
    pathname === "/dashboard/hosting" ||
    pathname.startsWith("/dashboard/hosting/");
  const badgeCount = unreadNotificationCount > 99 ? "99+" : String(unreadNotificationCount);

  return (
    <header className="sticky top-0 z-20 flex min-h-[72px] items-center gap-3 border-b border-slate-200/80 bg-white px-4 py-3 sm:px-6">
      <button
        type="button"
        data-no-pending
        onClick={onOpenSidebar}
        aria-label="Open sidebar"
        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 items-start gap-2">
        <Menu className="mt-0.5 hidden h-5 w-5 shrink-0 text-slate-500 lg:block" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            {pageTitleForPath(pathname)}
          </h1>
          {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {showDateRange ? (
          <Suspense
            fallback={
              <div className="h-10 w-44 rounded-lg border border-slate-200 bg-white" />
            }
          >
            <DateRangePicker />
          </Suspense>
        ) : null}

        <Link
          href="/dashboard/notifications"
          aria-label={
            unreadNotificationCount
              ? `${unreadNotificationCount} unread notifications`
              : "Notifications"
          }
          className="relative rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <Bell className="h-5 w-5" />
          {unreadNotificationCount > 0 ? (
            <span className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {badgeCount}
            </span>
          ) : null}
        </Link>

        <UserProfileMenu session={session} />

        {pathname === "/dashboard/hosting" || pathname.startsWith("/dashboard/hosting/") ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
          >
            + Add Hosting
          </button>
        ) : null}
      </div>
    </header>
  );
}
