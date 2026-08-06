import { redirect } from "next/navigation";
import {
  Building2,
  ShieldCheck,
} from "lucide-react";
import { InvitationCompletionForm } from "@/components/auth/invitation-completion-form";
import { getSessionUser } from "@/lib/auth/supabase-server";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Complete account setup — TAKATAK",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CompleteInvitationPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(
      "/login?next=%2Fcomplete-invitation",
    );
  }

  const wasCreatedByInvitation =
    typeof user.invited_at === "string" &&
    user.invited_at.length > 0;

  const invitationAlreadyCompleted =
    user.user_metadata
      ?.invitation_completed === true;

  if (
    !wasCreatedByInvitation ||
    invitationAlreadyCompleted
  ) {
    redirect("/dashboard");
  }

  const prisma = getPrisma();

  if (!prisma) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
        <section className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-950">
            Account setup unavailable
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            The database is temporarily unavailable. Please try again shortly.
          </p>

          <form
            action="/auth/signout"
            method="post"
            className="mt-6"
          >
            <button
              type="submit"
              className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            >
              Sign out
            </button>
          </form>
        </section>
      </main>
    );
  }

  const profile =
    await prisma.profile.findUnique({
      where: {
        authUserId: user.id,
      },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        memberships: {
          where: {
            status: "active",
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            client: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

  if (
    !profile ||
    profile.status === "disabled" ||
    profile.memberships.length === 0
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
        <section className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-950">
            Invitation access unavailable
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your active workspace invitation could not be verified. Contact the workspace administrator.
          </p>

          <form
            action="/auth/signout"
            method="post"
            className="mt-6"
          >
            <button
              type="submit"
              className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            >
              Sign out
            </button>
          </form>
        </section>
      </main>
    );
  }

  const workspaceName =
    profile.memberships[0].client.name;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <header className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
            T
          </span>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
            Complete your account
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Create your password and confirm your personal information before entering the workspace.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
                <Building2
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </span>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  Workspace invitation
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {workspaceName}
                </p>

                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                  <ShieldCheck
                    aria-hidden="true"
                    className="h-3.5 w-3.5 text-emerald-600"
                  />

                  Your email and invitation have been verified.
                </p>
              </div>
            </div>
          </div>

          <InvitationCompletionForm
            email={profile.email}
            initialFirstName={
              profile.firstName ?? ""
            }
            initialLastName={
              profile.lastName ?? ""
            }
          />
        </section>

        <form
          action="/auth/signout"
          method="post"
          className="text-center"
        >
          <button
            type="submit"
            className="text-xs font-medium text-slate-500 transition hover:text-slate-800"
          >
            Sign out and complete this later
          </button>
        </form>
      </div>
    </main>
  );
}