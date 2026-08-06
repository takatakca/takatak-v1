"use client";

// Client component: usePathname for active highlight; renders permission-aware
// navigation and an honest session-aware account block.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Lock, X } from "lucide-react";
// import { Lock, LogIn, LogOut, TriangleAlert, X } from "lucide-react";
import { APP_NAME, NAV_SECTIONS } from "@/lib/dashboard/dashboard-config";
import type { SessionSnapshot } from "@/lib/auth/session-snapshot";
import { ROLE_LABELS, MODULE_ACCESS } from "@/lib/security/roles";

function NavLinks({ session, onNavigate }: { session: SessionSnapshot; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section, si) => (
        <div key={section.title ?? si}>
          {section.title ? (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {section.title}
            </p>
          ) : null}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              // Permission-aware nav: only enforced when auth is configured
              // and a role exists. Foundation mode (no auth) shows everything.
              const isPlatformAdminItem =
                item.href === "/dashboard/admin" ||
                item.href.startsWith(
                  "/dashboard/admin/",
                );

              const hasPlatformAdminAccess =
                session.platformRole === "owner" ||
                session.platformRole === "admin";

              const requiredPermission =
                isPlatformAdminItem
                  ? undefined
                  : MODULE_ACCESS[item.href];

              const allowed =
                !session.configured ||
                (isPlatformAdminItem
                  ? hasPlatformAdminAccess
                  : !requiredPermission ||
                    session.effectivePermissions.includes(
                      requiredPermission,
                    ));
              if (!allowed) {
                return (
                  <div
                    key={item.href}
                    title={
                      isPlatformAdminItem
                        ? "Requires Platform Admin or Platform Owner access"
                        : requiredPermission
                          ? `Requires permission: ${requiredPermission.replace(
                              /_/g,
                              " ",
                            )}`
                          : "Access unavailable"
                    }
                    className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500/70"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-600" />
                    <span className="truncate">{item.label}</span>
                    <Lock className="ml-auto h-3 w-3 text-slate-600" />
                  </div>
                );
              }
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-indigo-600/90 text-white"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

// function AccountBlock({ session }: { session: SessionSnapshot }) {
//   if (!session.configured) {
//     return (
//       <div className="flex items-start gap-3">
//         <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
//           <TriangleAlert className="h-4 w-4" />
//         </span>
//         <div className="min-w-0 leading-tight">
//           <p className="text-sm font-medium text-white">Auth not configured</p>
//           <p className="text-[11px] text-slate-400">Add Supabase env vars to enable login</p>
//         </div>
//       </div>
//     );
//   }
//   if (!session.email) {
//     return (
//       <Link href="/login" className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-white/5">
//         <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-slate-300">
//           <LogIn className="h-4 w-4" />
//         </span>
//         <span className="text-sm font-medium text-white">Sign in</span>
//       </Link>
//     );
//   }
//   const initials = session.email.slice(0, 2).toUpperCase();
//   return (
//     <div className="flex items-center gap-3">
//       <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
//         {initials}
//       </span>
//       <div className="min-w-0 flex-1 leading-tight">
//         <p className="truncate text-sm font-medium text-white" title={session.email}>
//           {session.email}
//         </p>
//         <p className="text-[11px] text-slate-400">
//           {session.role ? `${ROLE_LABELS[session.role]} · foundation mode` : "Role pending"}
//         </p>
//       </div>
//       <form action="/auth/signout" method="post">
//         <button
//           type="submit"
//           title="Sign out"
//           className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
//         >
//           <LogOut className="h-4 w-4" />
//         </button>
//       </form>
//     </div>
//   );
// }

function SidebarFrame({ session, onNavigate }: { session: SessionSnapshot; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-[#0b1220] text-slate-200">
      <div className="flex items-center gap-2 px-5 pb-4 pt-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          T
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-wide text-white">{APP_NAME}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Dashboard V1</p>
        </div>
      </div>
      <NavLinks session={session} onNavigate={onNavigate} />

      <div className="border-t border-white/10 px-4 py-4">
        {session.activeClientName ? (
          <Link
            href="/dashboard/select-client"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-300">
              <Building2
                aria-hidden="true"
                className="h-4 w-4"
              />
            </span>

            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Current workspace
              </p>

              <p className="truncate text-sm font-medium text-white">
                {session.activeClientName}
              </p>

              <p className="mt-0.5 text-[11px] text-slate-400">
                {session.role
                  ? ROLE_LABELS[session.role]
                  : "Role unavailable"}
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-400">
              <Building2
                aria-hidden="true"
                className="h-4 w-4"
              />
            </span>

            <p className="text-xs text-slate-400">
              No workspace selected
            </p>
          </div>
        )}
      </div>
      {/* <div className="border-t border-white/10 px-4 py-4">
        <AccountBlock session={session} />
      </div> */}
    </div>
  );
}

export function DesktopSidebar({ session }: { session: SessionSnapshot }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
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
      <button aria-label="Close menu" className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-xl">
        <SidebarFrame session={session} onNavigate={onClose} />
        <button
          onClick={onClose}
          aria-label="Close sidebar"
          className="absolute right-3 top-4 rounded-md p-1.5 text-slate-300 hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
