import { redirect } from "next/navigation";
import {
  Building2,
  Check,
  ShieldCheck,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth/supabase-server";
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import { sanitizeNextPath } from "@/lib/security/safe-redirect";
import {
  enterPlatformAdministration,
  setActiveClient,
} from "./actions";

export const dynamic = "force-dynamic";

type SelectClientPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function SelectClientPage({
  searchParams,
}: SelectClientPageProps) {
  const parameters = await searchParams;

  const nextPath = sanitizeNextPath(
    parameters.next ?? "/dashboard",
  );

  const { access } =
    await getServerAccessContext();

  if (access.mode === "foundation_demo") {
    redirect("/dashboard");
  }

  if (access.mode === "denied") {
    if (access.reason === "not_authenticated") {
      redirect(
        `/login?next=${encodeURIComponent(
          "/dashboard/select-client",
        )}`,
      );
    }

    // A stale/tampered workspace cookie must stay on this page so the
    // user can pick a valid workspace. Sending them to /dashboard makes
    // the dashboard layout bounce back here forever.
    if (access.reason !== "client_not_allowed") {
      redirect("/dashboard");
    }
  }

  const prisma = getPrisma();
  let profileId =
    access.mode === "denied" ? null : access.profileId;

  if (!profileId) {
    const user = await getSessionUser();
    if (user && prisma) {
      const sessionProfile = await prisma.profile.findUnique({
        where: { authUserId: user.id },
        select: { id: true },
      });
      profileId = sessionProfile?.id ?? null;
    }
  }

  if (!prisma) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <section className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-950">
            Workspaces unavailable
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            The database is temporarily unavailable.
          </p>
        </section>
      </main>
    );
  }

  if (!profileId) {
    redirect("/dashboard");
  }

  const [profile, memberships] =
    await Promise.all([
      prisma.profile.findUnique({
        where: {
          id: profileId,
        },
        select: {
          role: true,
        },
      }),

      prisma.clientMembership.findMany({
        where: {
          profileId,
          status: "active",
        },
        select: {
          clientId: true,
          role: true,
          client: {
            select: {
              name: true,
              status: true,
            },
          },
        },
        orderBy: {
          client: {
            name: "asc",
          },
        },
      }),
    ]);

  if (!profile) {
    redirect("/dashboard");
  }

  const canUsePlatformAdministration =
    profile.role === "owner" ||
    profile.role === "admin";

  const activeClientId =
    access.mode === "client_scoped"
      ? access.activeClientId
      : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-950">
          Choose your working mode
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Select Platform Administration or enter one of your workspaces.
        </p>

        {canUsePlatformAdministration ? (
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Platform
            </p>

            <form
              action={
                enterPlatformAdministration
              }
            >
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-left transition hover:border-indigo-300 hover:bg-indigo-100"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
                  <ShieldCheck className="h-5 w-5" />
                </span>

                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Platform Administration
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Manage platform-wide users, clients, jobs, and audit records.
                  </p>
                </div>
              </button>
            </form>
          </div>
        ) : null}

        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Workspaces
          </p>

          <div className="space-y-2">
            {memberships.map(
              (membership) => {
                const selected =
                  membership.clientId ===
                  activeClientId;

                return (
                  <form
                    key={
                      membership.clientId
                    }
                    action={setActiveClient}
                  >
                    <input
                      type="hidden"
                      name="clientId"
                      value={
                        membership.clientId
                      }
                    />

                    <input
                      type="hidden"
                      name="next"
                      value={nextPath}
                    />

                    <button
                      type="submit"
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <Building2 className="h-5 w-5" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {
                            membership
                              .client.name
                          }
                        </p>

                        <p className="mt-0.5 text-xs capitalize text-slate-500">
                          {
                            membership.role
                          }{" "}
                          workspace access
                        </p>
                      </div>

                      {selected ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </button>
                  </form>
                );
              },
            )}

            {memberships.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                No active workspace memberships were found.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}