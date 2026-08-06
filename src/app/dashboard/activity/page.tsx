import {
  Activity,
  Clock3,
  Database,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { getWorkspaceActivityData } from "@/lib/activity/activity-data";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const ACTION_LABELS: Record<string, string> = {
  account_profile_updated: "Account profile updated",
  personal_workspace_created: "Personal workspace created",
  user_invitation_sent: "Invitation sent",
  user_invitation_failed: "Invitation delivery failed",
  user_invitation_revoked: "Invitation revoked",
  user_invitation_deleted: "Invitation deleted",
  user_invitation_accepted: "Invitation accepted",
  workspace_member_role_changed: "Member role changed",
  workspace_member_permissions_changed:
    "Member permissions changed",
  workspace_member_suspended: "Member suspended",
  workspace_member_reactivated: "Member reactivated",
  workspace_member_removed: "Member removed",
};

function formatAction(action: string): string {
  const predefinedLabel = ACTION_LABELS[action];

  if (predefinedLabel) {
    return predefinedLabel;
  }

  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function formatEntityType(
  entityType: string | null,
): string {
  if (!entityType) {
    return "System";
  }

  return entityType
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function getActionClasses(action: string): string {
  if (
    action.includes("deleted") ||
    action.includes("removed") ||
    action.includes("revoked") ||
    action.includes("failed")
  ) {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }

  if (
    action.includes("created") ||
    action.includes("accepted") ||
    action.includes("reactivated")
  ) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (
    action.includes("permissions") ||
    action.includes("role") ||
    action.includes("suspended")
  ) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-indigo-50 text-indigo-700 ring-indigo-200";
}

export default async function ActivityPage() {
  const access =
  await requireWorkspacePermission(
    "view_activity_log",
    "/dashboard/activity",
  );

  const data =
    await getWorkspaceActivityData(access);

  if (data.source === "unavailable") {
    return (
      <main className="space-y-6">
        <header>
          <p className="text-sm font-medium text-indigo-600">
            Workspace administration
          </p>

          <h1 className="mt-1 text-2xl font-semibold text-slate-950">
            Activity
          </h1>
        </header>

        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <h2 className="font-semibold text-rose-900">
            Activity unavailable
          </h2>

          <p className="mt-2 text-sm text-rose-700">
            {data.message}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">
            Workspace administration
          </p>

          <h1 className="mt-1 text-2xl font-semibold text-slate-950">
            Activity
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Security and administrative history for{" "}
            <span className="font-medium text-slate-800">
              {data.clientName}
            </span>
            .
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <Database
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />

          Live database records
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Activity
                aria-hidden="true"
                className="h-5 w-5"
              />
            </span>

            <div>
              <p className="text-sm text-slate-500">
                Recorded events
              </p>

              <p className="text-2xl font-semibold text-slate-950">
                {data.entries.length}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck
                aria-hidden="true"
                className="h-5 w-5"
              />
            </span>

            <div>
              <p className="text-sm text-slate-500">
                Data protection
              </p>

              <p className="text-sm font-semibold text-slate-950">
                Workspace-scoped
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">
            Recent activity
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            The latest 100 security and administrative events.
          </p>
        </div>

        {data.entries.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Activity
                aria-hidden="true"
                className="h-5 w-5"
              />
            </span>

            <h3 className="mt-4 font-semibold text-slate-900">
              No activity recorded
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Workspace actions will appear here after they occur.
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {data.entries.map((entry) => (
              <li
                key={entry.id}
                className="px-5 py-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <UserRound
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-950">
                          {formatAction(entry.action)}
                        </h3>

                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${getActionClasses(
                            entry.action,
                          )}`}
                        >
                          {formatEntityType(
                            entry.entityType,
                          )}
                        </span>
                      </div>

                      <time
                        dateTime={entry.createdAt}
                        className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-500"
                      >
                        <Clock3
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                        />

                        {dateFormatter.format(
                          new Date(entry.createdAt),
                        )}
                      </time>
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      Performed by{" "}
                      <span className="font-medium text-slate-700">
                        {entry.actorName}
                      </span>
                    </p>

                    {entry.note ? (
                      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-700">
                        {entry.note}
                      </p>
                    ) : (
                      <p className="mt-3 text-xs text-slate-400">
                        No additional event note was recorded.
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}