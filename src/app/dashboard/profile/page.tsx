import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/account/profile-form";
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import { ROLE_LABELS } from "@/lib/security/roles";

export const dynamic = "force-dynamic";

function getInitials(
  firstName: string | null,
  lastName: string | null,
  displayName: string | null,
  email: string,
): string {
  const firstInitial =
    firstName?.trim().charAt(0) ?? "";

  const lastInitial =
    lastName?.trim().charAt(0) ?? "";

  const nameInitials =
    `${firstInitial}${lastInitial}`.toUpperCase();

  if (nameInitials) {
    return nameInitials;
  }

  if (displayName) {
    return displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();
  }

  return email.slice(0, 2).toUpperCase();
}

export default async function ProfilePage() {
  const { access } = await getServerAccessContext();

  if (
    access.mode === "denied" &&
    access.reason === "not_authenticated"
  ) {
    redirect("/login?next=%2Fdashboard%2Fprofile");
  }

  if (
    access.mode !== "client_scoped" &&
    access.mode !== "platform_admin"
  ) {
    redirect("/dashboard");
  }

  const prisma = getPrisma();

  if (!prisma) {
    return (
      <main className="space-y-6">
        <header>
          <p className="text-sm font-medium text-indigo-600">
            Account
          </p>

          <h1 className="mt-1 text-2xl font-semibold text-slate-950">
            Profile
          </h1>
        </header>

        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <h2 className="font-semibold text-rose-900">
            Profile unavailable
          </h2>

          <p className="mt-2 text-sm text-rose-700">
            The database is temporarily unavailable.
          </p>
        </section>
      </main>
    );
  }

  const profile = await prisma.profile.findUnique({
    where: {
      id: access.profileId,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      displayName: true,
      status: true,
      createdAt: true,
    },
  });

  if (!profile) {
    return (
      <main className="space-y-6">
        <header>
          <p className="text-sm font-medium text-indigo-600">
            Account
          </p>

          <h1 className="mt-1 text-2xl font-semibold text-slate-950">
            Profile
          </h1>
        </header>

        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <h2 className="font-semibold text-rose-900">
            Profile not found
          </h2>

          <p className="mt-2 text-sm text-rose-700">
            Your account profile could not be loaded.
          </p>
        </section>
      </main>
    );
  }

  const initials = getInitials(
    profile.firstName,
    profile.lastName,
    profile.displayName,
    profile.email,
  );

  return (
    <main className="space-y-6">
      <header>
        <p className="text-sm font-medium text-indigo-600">
          Account
        </p>

        <h1 className="mt-1 text-2xl font-semibold text-slate-950">
          Profile
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          View and update your personal account information.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-600 text-xl font-semibold text-white">
            {initials}
          </div>

          <h2 className="mt-5 text-lg font-semibold text-slate-950">
            {profile.displayName ??
              [profile.firstName, profile.lastName]
                .filter(Boolean)
                .join(" ") ??
              profile.email}
          </h2>

          <p className="mt-1 break-all text-sm text-slate-500">
            {profile.email}
          </p>

          <dl className="mt-6 space-y-4 border-t border-slate-200 pt-5">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Current role
              </dt>

              <dd className="mt-1 text-sm font-medium text-slate-700">
                {ROLE_LABELS[access.role]}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Account status
              </dt>

              <dd className="mt-1">
                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium capitalize text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  {profile.status}
                </span>
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Member since
              </dt>

              <dd className="mt-1 text-sm text-slate-700">
                {profile.createdAt.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </dd>
            </div>
          </dl>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 border-b border-slate-200 pb-5">
            <h2 className="font-semibold text-slate-950">
              Personal information
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              These details are used throughout your TAKATAK account.
            </p>
          </div>

          <ProfileForm
            email={profile.email}
            initialFirstName={profile.firstName ?? ""}
            initialLastName={profile.lastName ?? ""}
          />
        </section>
      </section>
    </main>
  );
}