"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Lock, X } from "lucide-react";
import { APP_NAME, APP_NAME_BADGE, NAV_SECTIONS } from "@/lib/dashboard/dashboard-config";
import type { NavItem } from "@/lib/dashboard/types";
import type { SessionSnapshot } from "@/lib/auth/session-snapshot";
import { MODULE_ACCESS } from "@/lib/security/roles";

function collectHrefs(items: NavItem[]): string[] {
  return items.flatMap((item) => [item.href, ...(item.children ? collectHrefs(item.children) : [])]);
}

function itemIsActive(pathname: string, href: string, allHrefs: string[]): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  const moreSpecific = allHrefs.some(
    (other) => other !== href && other.startsWith(`${href}/`) && pathname.startsWith(other),
  );
  if (moreSpecific) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavRow({
  item,
  session,
  pathname,
  allHrefs,
  onNavigate,
  nested = false,
}: {
  item: NavItem;
  session: SessionSnapshot;
  pathname: string;
  allHrefs: string[];
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const Icon = item.icon;
  const children = item.children ?? [];
  const hasChildren = children.length > 0 || item.hasDropdown;
  const childActive = children.some((child) => itemIsActive(pathname, child.href, allHrefs));
  const active = itemIsActive(pathname, item.href, allHrefs);
  const [open, setOpen] = useState(childActive || (hasChildren && active));

  useEffect(() => {
    if (childActive || (hasChildren && active)) setOpen(true);
  }, [childActive, hasChildren, active]);

  const isPlatformAdminItem =
    item.href === "/dashboard/admin" || item.href.startsWith("/dashboard/admin/");
  const hasPlatformAdminAccess =
    session.platformRole === "owner" || session.platformRole === "admin";
  const requiredPermission = isPlatformAdminItem ? undefined : MODULE_ACCESS[item.href];
  const allowed =
    !session.configured ||
    (isPlatformAdminItem
      ? hasPlatformAdminAccess
      : !requiredPermission || session.effectivePermissions.includes(requiredPermission));

  if (!allowed) {
    return (
      <div className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-white/35">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
        <Lock className="ml-auto h-3 w-3" />
      </div>
    );
  }

  if (nested) {
    return (
      <Link
        href={item.href}
        prefetch={false}
        onClick={onNavigate}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition hover:text-white"
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-orange-400" : "bg-transparent"}`}
        />
        <span className={active ? "font-medium text-white" : "text-white/60"}>{item.label}</span>
      </Link>
    );
  }

  const hostingModuleActive =
    item.href === "/dashboard/hosting" &&
    (pathname === "/dashboard/hosting" || pathname.startsWith("/dashboard/hosting/"));

  return (
    <div>
      <div
        className={`flex items-center rounded-lg ${
          hostingModuleActive
            ? "border-l-2 border-orange-400 bg-blue-600/90"
            : (active || childActive) && hasChildren
              ? "bg-white/10"
              : ""
        } ${!hostingModuleActive && active && !hasChildren ? "bg-white/10" : ""}`}
      >
        <Link
          href={item.href}
          prefetch={false}
          onClick={onNavigate}
          className={`group flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-[13px] font-medium transition ${
            active || childActive ? "text-white" : "text-white/70 hover:text-white"
          }`}
        >
          <Icon className={`h-4 w-4 shrink-0 ${active || childActive ? "text-white" : "text-white/55"}`} />
          <span className="truncate">{item.label}</span>
        </Link>
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
            onClick={() => setOpen((current) => !current)}
            className="px-2 py-2 text-white/45 hover:text-white"
          >
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </div>
      {hasChildren && open ? (
        <div className="ml-8 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
          {children.map((child) => (
            <NavRow
              key={`${child.label}-${child.href}`}
              item={child}
              session={session}
              pathname={pathname}
              allHrefs={allHrefs}
              onNavigate={onNavigate}
              nested
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NavLinks({ session, onNavigate }: { session: SessionSnapshot; onNavigate?: () => void }) {
  const pathname = usePathname();
  const allHrefs = collectHrefs(NAV_SECTIONS.flatMap((section) => section.items));

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section, si) => (
        <div key={section.title ?? si}>
          {section.title ? (
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
              {section.title}
            </p>
          ) : null}
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavRow
                key={`${item.label}-${item.href}`}
                item={item}
                session={session}
                pathname={pathname}
                allHrefs={allHrefs}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function BrandMark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-sm">
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path fill="currentColor" d="M9.2 16.6 5.8 13.2l1.4-1.4 2 2 7.6-7.6 1.4 1.4z" />
      </svg>
    </span>
  );
}

function SidebarFrame({ session, onNavigate }: { session: SessionSnapshot; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-[#1f2125] text-white">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <BrandMark />
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-tight text-white">{APP_NAME}</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
            {APP_NAME_BADGE}
          </p>
        </div>
      </div>
      <NavLinks session={session} onNavigate={onNavigate} />
    </div>
  );
}

export function DesktopSidebar({ session }: { session: SessionSnapshot }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] lg:block">
      <SidebarFrame session={session} />
    </aside>
  );
}

export function MobileSidebar({
  open,
  onClose,
  session,
}: {
  open: boolean;
  onClose: () => void;
  session: SessionSnapshot;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
      <button type="button" data-no-pending aria-label="Close menu" className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-xl">
        <SidebarFrame session={session} onNavigate={onClose} />
        <button
          type="button"
          data-no-pending
          onClick={onClose}
          aria-label="Close sidebar"
          className="absolute right-3 top-4 rounded-md p-1.5 text-white/70 hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
