import { InvitationDeleteButton } from "@/components/team/invitation-delete-button";
import { InvitationForm } from "@/components/team/invitation-form";
import { InvitationRevokeButton } from "@/components/team/invitation-revoke-button";
import { MemberPermissionsForm } from "@/components/team/member-permissions-form";
import { MemberRemoveButton } from "@/components/team/member-remove-button";
import { MemberRoleForm } from "@/components/team/member-role-form";
import { MemberStatusButton } from "@/components/team/member-status-button";
import {
  getEffectivePermissions,
  hasEffectivePermission,
} from "@/lib/security/effective-permissions";
import { ROLE_LABELS, type RoleKey } from "@/lib/security/roles";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
import { getWorkspaceTeamData } from "@/lib/team/team-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Team & Permissions",
  robots: { index: false, follow: false },
};

const ROLE_LEVELS: Record<RoleKey, number> = {
  owner: 6,
  admin: 5,
  manager: 4,
  editor: 3,
  staff: 2,
  viewer: 1,
};

const ROLE_OPTIONS: RoleKey[] = [
  "owner",
  "admin",
  "manager",
  "editor",
  "staff",
  "viewer",
];

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

function statusClasses(status: string): string {
  if (status === "active" || status === "accepted") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "suspended" || status === "revoked") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (status === "expired") {
    return "bg-slate-100 text-slate-600 ring-slate-200";
  }

  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function memberRoleLabel(member: {
  role: RoleKey;
  customRoleName: string | null;
}) {
  return member.customRoleName ?? ROLE_LABELS[member.role];
}

export default async function TeamPermissionsPage() {
  const access = await requireWorkspacePermission(
    "view_team",
    "/dashboard/team",
  );
  const data = await getWorkspaceTeamData(access);

  if (data.source === "unavailable") {
    return (
      <main className="space-y-6">
        <header>
          <p className="text-sm font-medium text-indigo-600">
            Workspace administration
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">
            Team & Permissions
          </h1>
        </header>

        <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h2 className="font-semibold text-red-900">Team data unavailable</h2>
          <p className="mt-2 text-sm text-red-700">{data.message}</p>
        </section>
      </main>
    );
  }

  const activeMembers = data.members.filter(
    (member) => member.status === "active",
  ).length;
  const suspendedMembers = data.members.filter(
    (member) => member.status === "suspended",
  ).length;
  const pendingInvitations = data.invitations.filter(
    (invitation) => invitation.status === "pending",
  );

  const canInvite = hasEffectivePermission(access, "invite_users");
  const canManageUsers = hasEffectivePermission(access, "manage_users");
  const canManageRoles = hasEffectivePermission(access, "manage_roles");
  const canManagePermissions = hasEffectivePermission(
    access,
    "manage_permissions",
  );
  const canSuspendUsers = hasEffectivePermission(access, "suspend_users");
  const canDeleteUsers = hasEffectivePermission(access, "delete_users");
  const assignablePermissions = getEffectivePermissions(access);
  const canShowMemberActions =
    canManageRoles ||
    canManagePermissions ||
    canSuspendUsers ||
    canDeleteUsers;

  const allowedInvitationRoles = ROLE_OPTIONS.filter((candidateRole) => {
    if (candidateRole === "owner") {
      return access.role === "owner";
    }

    return ROLE_LEVELS[candidateRole] <= ROLE_LEVELS[access.role];
  });

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">
            Workspace administration
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">
            Team & Permissions
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Invite people, edit roles and permissions, and remove access for{" "}
            {data.clientName}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canInvite ? (
            <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
              Invitation access
            </span>
          ) : null}
          {canManageUsers ? (
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
              User management access
            </span>
          ) : null}
        </div>
      </header>

      {canInvite ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-950">Invite a team member</h2>
            <p className="mt-1 text-sm text-slate-500">
              Send secure workspace access by email.
            </p>
          </div>
          <InvitationForm allowedRoles={allowedInvitationRoles} />
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Active members</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {activeMembers}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Suspended members</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {suspendedMembers}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pending invitations</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {pendingInvitations.length}
          </p>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">Workspace members</h2>
          <p className="mt-1 text-sm text-slate-500">
            Roles and permissions are enforced for this workspace.
          </p>
        </div>

        {data.members.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-medium text-slate-800">No team members found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    User
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Role
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Custom access
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Joined
                  </th>
                  {canShowMemberActions ? (
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.members.map((member) => (
                  <tr key={member.membershipId}>
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-slate-900">
                        {member.displayName ?? member.email ?? "Unknown user"}
                        {member.profileId === access.profileId ? (
                          <span className="ml-2 text-xs font-medium text-indigo-600">
                            You
                          </span>
                        ) : null}
                      </p>
                      {member.displayName && member.email ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {member.email}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-700">
                        {memberRoleLabel(member)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${statusClasses(
                          member.status,
                        )}`}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {member.role === "owner" && !member.customRoleId ? (
                        <>
                          <div className="font-medium text-emerald-700">
                            All access
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            Granted automatically by Owner role
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            {member.customPermissions.length} granted
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {member.deniedPermissions.length} denied
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {formatDate(member.joinedAt)}
                    </td>
                    {canShowMemberActions ? (
                      <td className="px-5 py-4 align-top">
                        {member.profileId === access.profileId ? (
                          <span className="text-xs text-slate-400">
                            Your access cannot be changed here.
                          </span>
                        ) : (
                          <div className="space-y-3">
                            {canManageRoles ? (
                              <MemberRoleForm
                                membershipId={member.membershipId}
                                currentRole={member.role}
                                allowedRoles={allowedInvitationRoles}
                              />
                            ) : null}

                            {canManagePermissions && member.role !== "owner" ? (
                              <MemberPermissionsForm
                                membershipId={member.membershipId}
                                customPermissions={member.customPermissions}
                                deniedPermissions={member.deniedPermissions}
                                assignablePermissions={assignablePermissions}
                              />
                            ) : null}

                            {canManagePermissions && member.role === "owner" ? (
                              <p className="text-xs text-slate-400">
                                Owner permissions are fixed.
                              </p>
                            ) : null}

                            {canSuspendUsers ? (
                              <MemberStatusButton
                                membershipId={member.membershipId}
                                currentStatus={member.status}
                                memberName={
                                  member.displayName ??
                                  member.email ??
                                  "this member"
                                }
                              />
                            ) : null}

                            {canDeleteUsers ? (
                              <MemberRemoveButton
                                membershipId={member.membershipId}
                                memberName={
                                  member.displayName ??
                                  member.email ??
                                  "this member"
                                }
                              />
                            ) : null}
                          </div>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">Invitations</h2>
          <p className="mt-1 text-sm text-slate-500">
            Invitations created for this workspace.
          </p>
        </div>

        {data.invitations.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-medium text-slate-800">No invitations yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Invitations will appear here after they are sent.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Email
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Role
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Invited by
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Expires
                  </th>
                  {canInvite ? (
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.invitations.map((invitation) => (
                  <tr key={invitation.invitationId}>
                    <td className="px-5 py-4 text-sm font-medium text-slate-900">
                      {invitation.email}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {invitation.customRoleName ??
                        ROLE_LABELS[invitation.role]}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${statusClasses(
                          invitation.status,
                        )}`}
                      >
                        {invitation.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {invitation.invitedBy ?? "Unknown"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {formatDate(invitation.expiresAt)}
                    </td>
                    {canInvite ? (
                      <td className="px-5 py-4">
                        {invitation.status === "pending" ? (
                          <InvitationRevokeButton
                            invitationId={invitation.invitationId}
                            email={invitation.email}
                          />
                        ) : invitation.status === "revoked" ||
                          invitation.status === "expired" ? (
                          <InvitationDeleteButton
                            invitationId={invitation.invitationId}
                            email={invitation.email}
                            status={invitation.status}
                          />
                        ) : (
                          <span className="text-xs text-slate-400">
                            Accepted invitation retained
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
