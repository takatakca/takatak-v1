// Phase 3/14/15A — Dashboard layout.
// Phase 15A: access resolution is Profile + ClientMembership based via
// getServerAccessContext. Denied states render safe screens — never demo
// data, never another client's data, never owner defaults.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AccessDenied } from "@/components/security/access-denied";
import { MembershipRequired } from "@/components/security/membership-required";
import { CheckNetworkScreen } from "@/components/network/check-network-screen";
import type { SessionSnapshot } from "@/lib/auth/session-snapshot";
import { AUTH_STATUS_HEADER } from "@/lib/auth/session-user";
import { getServerAccessContext } from "@/lib/security/access-context";
import { ensureProfileForAuthenticatedUser } from "@/lib/auth/profile-sync";
import { Building2 } from "lucide-react";
import { getPrisma } from "@/lib/db/prisma";
import { setActiveClient } from "@/app/dashboard/select-client/actions";
import { getEffectivePermissions } from "@/lib/security/effective-permissions";

export const metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const authStatus = (await headers()).get(AUTH_STATUS_HEADER);
  if (authStatus === "network") {
    return <CheckNetworkScreen />;
  }

  // Profile create/update already runs on login, register, and callback.
  // Doing it on every dashboard render adds a remote Postgres round-trip.
  if (authStatus !== "authenticated") {
    await ensureProfileForAuthenticatedUser();
  }

  const { runtime, access, displayEmail, profileDetails, activeClientName } =
    await getServerAccessContext();

  // Production runtime without auth env: safe setup-required state (Phase 14).
  if (access.mode === "denied" && access.reason === "production_foundation_blocked") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-500">Setup required</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">Dashboard unavailable</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Authentication is not configured for this deployment, so the dashboard is disabled.
            An administrator must set the Supabase environment variables before access is possible.
          </p>
        </div>
      </main>
    );
  }

  if (access.mode === "denied") {
    switch (access.reason) {
      case "not_authenticated":
        redirect("/login");
        break;
      case "membership_suspended":
        return (
          <AccessDenied
            title="Workspace access suspended"
            message="Your access to this workspace has been suspended. Contact a workspace administrator if you believe this is a mistake."
          />
        );

      case "client_inactive":
        return (
          <AccessDenied
            title="Workspace unavailable"
            message="This workspace is paused or archived. Contact a Platform Admin if access should be restored."
          />
        );
      
      case "client_not_allowed":
      case "membership_missing":
        return <MembershipRequired email={displayEmail} />;
      case "profile_disabled":
        return <AccessDenied title="Account disabled" message="This account is disabled. Contact your TAKATAK administrator." />;
      case "profile_missing":
        return <AccessDenied title="Profile not found" message="Your account profile could not be resolved. Contact your TAKATAK administrator." />;
      default:
        return <AccessDenied title="Temporarily unavailable" message="Data access could not be resolved safely. Try again shortly." />;
    }
  }

  if (access.mode === "selection_required") {
    const prisma = getPrisma();

    const clients = prisma
      ? await prisma.client.findMany({
          where: {
            id: {
              in: access.allowedClientIds,
            },
          },
          select: {
            id: true,
            name: true,
            status: true,
          },
          orderBy: {
            name: "asc",
          },
        })
      : [];

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">
            Select a workspace
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Choose the workspace you want to access.
          </p>

          <div className="mt-5 space-y-2">
            {clients.map((client) => (
              <form key={client.id} action={setActiveClient}>
                <input
                  type="hidden"
                  name="clientId"
                  value={client.id}
                />

                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:border-indigo-300 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <Building2
                    className="h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />

                  <span>{client.name}</span>
                </button>
              </form>
            ))}

            {clients.length === 0 ? (
              <p className="text-sm text-slate-500">
                No accessible workspace could be loaded.
              </p>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  let unreadNotificationCount = 0;
  
  if (
    access.mode === "platform_admin" ||
    access.mode === "client_scoped"
  ) {
    const prisma = getPrisma();
  
    if (prisma) {
      unreadNotificationCount = await prisma.notification
        .count({
          where: {
            status: "unread",
            ...(access.mode === "client_scoped"
              ? { clientId: access.activeClientId }
              : {}),
          },
        })
        .catch(() => 0);
    }
  }

  const session: SessionSnapshot = {
    configured:
      runtime.mode !== "development_foundation" ||
      !runtime.foundationAllowed,
  
    profileId: profileDetails?.id ?? null,
  
    email:
      profileDetails?.email ??
      displayEmail,
  
    firstName:
      profileDetails?.firstName ?? null,
  
    lastName:
      profileDetails?.lastName ?? null,
  
    displayName:
      profileDetails?.displayName ?? null,
  
    role:
      access.mode === "foundation_demo"
        ? "owner"
        : access.mode === "client_scoped"
          ? access.role
          : null,
    
    effectivePermissions:
      getEffectivePermissions(access),
    
    platformRole:
      profileDetails?.role ?? null,
    
    accessMode:
      access.mode === "foundation_demo"
        ? "foundation_demo"
        : access.mode === "platform_admin"
          ? "platform_admin"
          : "client_scoped",

    activeClientId:
      access.mode === "client_scoped"
        ? access.activeClientId
        : null,
  
    activeClientName,
  };
  // Foundation mode keeps configured=false so the existing warning renders.
  if (access.mode === "foundation_demo") session.configured = false;

  return (
    <DashboardShell
      session={session}
      unreadNotificationCount={unreadNotificationCount}
    >
      {children}
    </DashboardShell>
  );
}
