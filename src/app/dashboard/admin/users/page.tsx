import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminUserDeleteButton } from "@/components/admin/admin-user-delete-button";
import { SupportIdentityCheck } from "@/components/admin/support-identity-check";
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
import { adminFr } from "@/lib/admin/admin-fr";
import type { AdminUserSummary } from "@/lib/admin/types";
import { getDashboardLanguage } from "@/lib/dashboard/language";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

function createColumns({
  canDeleteUsers,
  currentProfileId,
  fr,
}: {
  canDeleteUsers: boolean;
  currentProfileId: string | null;
  fr: boolean;
}): AdminColumn<AdminUserSummary>[] {
  const columns: AdminColumn<AdminUserSummary>[] = [
    {
      key: "user",
      header: fr ? "Utilisateur" : "User",
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
      header: fr ? "Rôle sur la plateforme" : "Platform role",
      render: (user) => (
        <Badge tone="accent">
          {adminFr(ADMIN_ROLE_LABELS[user.platformRole] ?? user.platformRole, fr)}
        </Badge>
      ),
    },
    {
      key: "profileStatus",
      header: fr ? "Compte" : "Account",
      render: (user) => (
        <Badge
          tone={adminToneForStatus(
            user.profileStatus,
          )}
        >
          {adminFr(user.profileStatus, fr)}
        </Badge>
      ),
    },
    {
      key: "workspaces",
      header: fr ? "Espaces clients" : "Workspace memberships",
      render: (user) => (
        <div className="min-w-56 space-y-1.5">
          {user.memberships.length === 0 ? (
            <span className="text-xs text-slate-400">
              {fr ? "Aucun espace client" : "No workspace memberships"}
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
                    {adminFr(membership.role, fr)}
                  </span>

                  <span className="text-[11px] capitalize text-slate-400">
                    · {adminFr(membership.status, fr)}
                  </span>
                </div>
              ),
            )
          )}
        </div>
      ),
    },
    {
      key: "identity",
      header: fr ? "Vérification d’identité (appel)" : "Identity check (call)",
      render: (user) => (
        <SupportIdentityCheck
          profileId={user.id}
          disabled={user.id === currentProfileId || user.profileStatus === "disabled"}
        />
      ),
    },
    {
      key: "joined",
      header: fr ? "Compte créé le" : "Account created",
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
          blockedReason = fr
            ? "Vous ne pouvez pas supprimer votre propre compte."
            : "You cannot delete your own account.";
        } else if (
          user.ownerWorkspaceCount > 0
        ) {
          blockedReason = fr
            ? "Transférez la propriété de chaque espace avant de supprimer ce compte."
            : "Transfer ownership of every workspace before deleting this account.";
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

  const fr = (await getDashboardLanguage(adminAccess.profileId)) === "fr";

  const canDeleteUsers =
    adminAccess.enforced &&
    adminAccess.role === "owner";

  const data =
    await getAdminUsersData();

  const columns = createColumns({
    canDeleteUsers,
    currentProfileId,
    fr,
  });

  return (
    <div className="space-y-5">
      <AdminHeader
        title={fr ? "Utilisateurs" : "Users"}
        subtitle={
          fr
            ? "Annuaire de toute la plateforme : comptes connectés et leurs espaces clients."
            : "Platform-wide directory of authenticated accounts and workspace memberships."
        }
        badges={[
          canDeleteUsers
            ? fr ? "Contrôles du propriétaire" : "Owner controls"
            : fr ? "Annuaire en direct" : "Live directory",
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
          caption={fr ? "Comptes de la plateforme et leurs espaces clients" : "Platform accounts and workspace memberships"}
        />
      ) : (
        <AdminEmptyState
          title={fr ? "Aucun utilisateur trouvé" : "No users found"}
          description={
            fr
              ? "Les comptes de la plateforme apparaîtront ici après une inscription ou une invitation acceptée."
              : "Authenticated platform accounts will appear here after registration or invitation acceptance."
          }
        />
      )}
    </div>
  );
}