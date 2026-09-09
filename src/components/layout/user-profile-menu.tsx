"use client";

import Link from "next/link";
import {
  Building2,
  ChevronDown,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import type { SessionSnapshot } from "@/lib/auth/session-snapshot";
import { ROLE_LABELS } from "@/lib/security/roles";

function getInitials(session: SessionSnapshot): string {
  const firstInitial =
    session.firstName?.trim().charAt(0) ?? "";

  const lastInitial =
    session.lastName?.trim().charAt(0) ?? "";

  const nameInitials =
    `${firstInitial}${lastInitial}`.toUpperCase();

  if (nameInitials) {
    return nameInitials;
  }

  if (session.displayName) {
    const parts = session.displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();
  }

  return session.email
    ? session.email.slice(0, 2).toUpperCase()
    : "—";
}

export function UserProfileMenu({
  session,
}: {
  session: SessionSnapshot;
}) {
  const menuReference = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        menuReference.current &&
        !menuReference.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    );

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open]);

  const composedName = [session.firstName, session.lastName]
    .filter(Boolean)
    .join(" ");
  const displayName =
    session.displayName ||
    composedName ||
    session.activeClientName ||
    session.email ||
    "User";

  const roleLabel = session.role
    ? ROLE_LABELS[session.role]
    : session.platformRole === "owner"
      ? "Owner"
      : session.platformRole === "admin"
        ? "Admin"
        : null;

  const initials = getInitials(session);

  return (
    <div
      ref={menuReference}
      className="relative"
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg p-1 pr-2 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
          {initials}
        </span>

        <span className="hidden min-w-0 text-left leading-tight sm:block">
          <span className="block max-w-[160px] truncate text-sm font-semibold text-slate-900">
            {displayName}
          </span>
          {roleLabel ? (
            <span className="block text-[11px] text-slate-500">{roleLabel}</span>
          ) : null}
        </span>

        <ChevronDown
          aria-hidden="true"
          className={`hidden h-4 w-4 text-slate-400 transition sm:block ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="border-b border-slate-200 px-4 py-4">
            <p className="truncate text-sm font-semibold text-slate-950">
              {displayName}
            </p>

            <p className="mt-1 truncate text-xs text-slate-500">
              {session.email ?? "No email available"}
            </p>

            {session.activeClientName ? (
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                <p className="truncate text-xs font-medium text-slate-700">
                  {session.activeClientName}
                </p>

                <p className="mt-0.5 text-[11px] text-slate-500">
                  {session.role
                    ? ROLE_LABELS[session.role]
                    : "Role unavailable"}
                </p>
              </div>
            ) : null}
          </div>

          <div className="p-2">
            <Link
              href="/dashboard/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              <UserRound
                aria-hidden="true"
                className="h-4 w-4 text-slate-400"
              />

              View and edit profile
            </Link>

            <Link
              href="/dashboard/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              <Settings
                aria-hidden="true"
                className="h-4 w-4 text-slate-400"
              />

              Account settings
            </Link>

            <Link
              href="/dashboard/select-client"
              prefetch={false}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              <Building2
                aria-hidden="true"
                className="h-4 w-4 text-slate-400"
              />

              Switch workspace
            </Link>
          </div>

          <div className="border-t border-slate-200 p-2">
            <form
              action="/auth/signout"
              method="post"
            >
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50"
              >
                <LogOut
                  aria-hidden="true"
                  className="h-4 w-4"
                />

                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}