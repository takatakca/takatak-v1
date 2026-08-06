import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminUserDeleteButton } from "@/components/admin/admin-user-delete-button";
import { AdminSourceBanner } from "@/components/admin/source-banner";
import {
  AdminTable,
  type AdminColumn,
} from "@/components/admin/admin-table";
import { Badge } from "@/components/ui/badge";
import { getAdminUsersData } from "@/lib/admin/admin-users-data";
import {
  ADMIN_ROLE_LABELS,
  adminToneForStatus,
} from "@/lib/admin/status";
import type { AdminUserSummary } from "@/lib/admin/types";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

function createColumns({
  canDeleteUsers,
  currentProfileId,
}: {
  canDeleteUsers: boolean;
  currentProfileId: string | null;
}): AdminColumn<AdminUserSummary>[] {
  const columns: AdminColumn<AdminUserSummary>[] = [
    {
      key: "user",
      header: "User",
      render: (user) => (
        <div className="min-w-44">
          <p className="text-xs font-medium text-slate-800">
            {user.displayName ??
              user.email}
          </p>

          <p className="mt-1 text-[11px] text-slate-500">
            {user.email}
          </p>
        </div>
      ),
    },
    {
      key: "platformRole",
      header: "Platform role",
      render: (user) => (
        <Badge tone="accent">
          {ADMIN_ROLE_LABELS[
            user.platformRole
          ] ?? user.platformRole}
        </Badge>
      ),
    },
    {
      key: "profileStatus",
      header: "Account",
      render: (user) => (
        <Badge
          tone={adminToneForStatus(
            user.profileStatus,
          )}
        >
          {user.profileStatus}
        </Badge>
      ),
    },
    {
      key: "workspaces",
      header: "Workspace memberships",
      render: (user) => (
        <div className="min-w-56 space-y-1.5">
          {user.memberships.length === 0 ? (
            <span className="text-xs text-slate-400">
              No workspace memberships
            </span>
          ) : (
            user.memberships.map(
              (membership) => (
                <div
                  key={membership.id}
                  className="flex flex-wrap items-center gap-1.5"
                >
                  <span className="text-xs font-medium text-slate-700">
                    {membership.clientName}
                  </span>

                  <span className="text-[11px] capitalize text-slate-400">
                    {membership.role}
                  </span>

                  <span className="text-[11px] capitalize text-slate-400">
                    · {membership.status}
                  </span>
                </div>
              ),
            )
          )}
        </div>
      ),
    },
    {
      key: "joined",
      header: "Account created",
      render: (user) => (
        <span className="text-xs text-slate-400">
          {user.createdAt}
        </span>
      ),
    },
  ];

  if (canDeleteUsers) {
    columns.push({
      key: "actions",
      header: "Actions",
      render: (user) => {
        let blockedReason:
          | string
          | null = null;

        if (
          user.id === currentProfileId
        ) {
          blockedReason =
            "You cannot delete your own account.";
        } else if (
          user.ownerWorkspaceCount > 0
        ) {
          blockedReason =
            "Transfer ownership of every workspace before deleting this account.";
        }

        return (
          <AdminUserDeleteButton
            profileId={user.id}
            displayName={
              user.displayName ??
              user.email
            }
            email={user.email}
            blockedReason={
              blockedReason
            }
          />
        );
      },
    });
  }

  return columns;
}

export default async function AdminUsersPage() {
  const adminAccess =
    await requireAdminAccess();

  const currentProfileId =
    adminAccess.profileId;

  const canDeleteUsers =
    adminAccess.enforced &&
    adminAccess.role === "owner";

  const data =
    await getAdminUsersData();

  const columns = createColumns({
    canDeleteUsers,
    currentProfileId,
  });

  return (
    <div className="space-y-5">
      <AdminHeader
        title="Users"
        subtitle="Platform-wide directory of authenticated accounts and workspace memberships."
        badges={[
          canDeleteUsers
            ? "Owner controls"
            : "Live directory",
        ]}
      />

      <AdminAccessBanner
        enforced={adminAccess.enforced}
        role={adminAccess.role}
      />

      <AdminSourceBanner
        source={data.source}
        label={data.sourceLabel}
      />

      {data.users.length > 0 ? (
        <AdminTable
          columns={columns}
          rows={data.users}
          rowKey={(user) => user.id}
          caption="Platform accounts and workspace memberships"
        />
      ) : (
        <AdminEmptyState
          title="No users found"
          description="Authenticated platform accounts will appear here after registration or invitation acceptance."
        />
      )}
    </div>
  );
}