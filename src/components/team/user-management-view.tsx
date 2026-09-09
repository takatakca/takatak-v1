"use client";

import {
  Check,
  ChevronDown,
  Gem,
  LayoutGrid,
  List,
  Plus,
  Search,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { withSocialPreview } from "@/components/social/preview/social-preview-query";
import { InvitationForm } from "@/components/team/invitation-form";
import { InvitationRevokeButton } from "@/components/team/invitation-revoke-button";
import { MemberAccessModal } from "@/components/team/member-access-modal";
import { MemberPermissionsForm } from "@/components/team/member-permissions-form";
import { MemberRemoveButton } from "@/components/team/member-remove-button";
import { MemberRoleForm } from "@/components/team/member-role-form";
import { MemberStatusButton } from "@/components/team/member-status-button";
import { RolesPremiumModal } from "@/components/team/roles-premium-modal";
import { UserManagementPremiumModal } from "@/components/team/user-management-premium-modal";
import {
  ALL_PERMISSIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type Permission,
  type RoleKey,
} from "@/lib/security/roles";
import type {
  UserManagementCapabilities,
  UserManagementTab,
  WorkspaceInvitationSummary,
  WorkspaceMemberSummary,
  WorkspaceTeamData,
} from "@/lib/team/team-data";

const ROLE_ORDER: RoleKey[] = [
  "owner",
  "admin",
  "manager",
  "editor",
  "staff",
  "viewer",
];

function PremiumMark() {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#dfff32] text-[#1d1d1f]">
      <Gem className="h-2.5 w-2.5" />
    </span>
  );
}

function SystemRoleShield({ className }: { className: string }) {
  return (
    <span className="peer/shield group/shield relative inline-flex shrink-0">
      <span
        tabIndex={0}
        aria-label="System role"
        className="inline-flex outline-none"
      >
        <Shield className={className} />
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-50 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-3 py-1.5 text-[13px] font-medium text-[#1d1d1f] shadow-[0_4px_16px_rgba(15,23,42,0.16)] group-hover/shield:block group-focus-within/shield:block"
      >
        System role
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-white"
        />
      </span>
    </span>
  );
}

const VIEW_PERMISSION_LABELS: Partial<Record<Permission, string>> = {
  view_dashboard: "Analytics view",
  view_social: "Social view",
  view_reports: "Reports view",
  view_team: "Team view",
  view_activity_log: "Activity log view",
  view_admin: "Admin view",
};

const EDIT_PERMISSION_LABELS: Partial<Record<Permission, string>> = {
  manage_clients: "Clients",
  manage_brands: "Brands",
  manage_services: "Services",
  manage_integrations: "Integrations",
  manage_jobs: "Jobs",
  invite_users: "Invite users",
  manage_users: "Users",
  suspend_users: "Suspend users",
  delete_users: "Remove users",
  manage_roles: "Roles",
  manage_permissions: "Permissions",
  manage_settings: "Settings",
  create_content: "Schedule and publish posts",
  edit_content: "Edit content",
  approve_content: "Review posts",
  manage_social_accounts: "Social accounts",
};

function RoleIdentity({
  role,
  shieldClassName,
}: {
  role: RoleKey;
  shieldClassName: string;
}) {
  const granted = ROLE_PERMISSIONS[role];
  const viewOnly = granted.filter((permission) =>
    permission.startsWith("view_"),
  );
  const editing = granted.filter(
    (permission) => !permission.startsWith("view_"),
  );

  return (
    <span className="group/role relative inline-flex min-w-0 items-center gap-2">
      <span
        tabIndex={0}
        className="truncate text-sm font-medium text-[#1d1d1f] outline-none"
      >
        {ROLE_LABELS[role]}
      </span>
      <SystemRoleShield className={shieldClassName} />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+12px)] left-0 z-40 hidden w-[260px] rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-left shadow-[0_8px_28px_rgba(15,23,42,0.16)] group-hover/role:block group-focus-within/role:block peer-hover/shield:!hidden peer-focus-within/shield:!hidden"
      >
        {viewOnly.length > 0 ? (
          <div>
            <p className="text-[13px] font-medium text-[#6b7280]">
              View only permissions
            </p>
            <ul className="mt-2 space-y-1.5">
              {viewOnly.map((permission) => (
                <PermissionHoverRow
                  key={permission}
                  label={
                    VIEW_PERMISSION_LABELS[permission] ??
                    permissionLabel(permission)
                  }
                />
              ))}
            </ul>
          </div>
        ) : null}
        {editing.length > 0 ? (
          <div className={viewOnly.length > 0 ? "mt-3.5" : undefined}>
            <p className="text-[13px] font-medium text-[#6b7280]">
              Editing permissions
            </p>
            <ul className="mt-2 space-y-1.5">
              {editing.map((permission) => (
                <PermissionHoverRow
                  key={permission}
                  label={
                    EDIT_PERMISSION_LABELS[permission] ??
                    permissionLabel(permission)
                  }
                />
              ))}
            </ul>
          </div>
        ) : null}
        <span
          aria-hidden="true"
          className="absolute left-8 top-full h-0 w-0 border-x-[6px] border-t-[6px] border-x-transparent border-t-white"
        />
      </span>
    </span>
  );
}

function PermissionHoverRow({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2 text-[13px] leading-5 text-[#374151]">
      <Check
        className="h-3.5 w-3.5 shrink-0 text-[#22c55e]"
        strokeWidth={2.75}
      />
      {label}
    </li>
  );
}

function FilterSelect({
  label,
  displayValue,
  value,
  disabled,
  onChange,
  widthClass = "lg:w-40",
  children,
}: {
  label: string;
  displayValue: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  widthClass?: string;
  children: ReactNode;
}) {
  return (
    <label className={`relative w-full shrink-0 ${widthClass}`}>
      <span className="sr-only">{label}</span>
      {disabled ? (
        <span
          aria-disabled="true"
          title={`${label} unlocks after you subscribe`}
          className="flex h-11 w-full cursor-not-allowed items-center justify-between rounded-full border border-slate-200 bg-[#f4f5f6] px-4 text-sm text-slate-400"
        >
          {displayValue}
          <ChevronDown className="h-4 w-4 text-slate-300" />
        </span>
      ) : (
        <>
          <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-11 w-full appearance-none rounded-full border border-slate-300 bg-white py-2 pl-4 pr-10 text-sm text-slate-800 outline-none focus:border-[#4b8bf5] focus:ring-2 focus:ring-[#4b8bf5]/20"
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </>
      )}
    </label>
  );
}

function permissionLabel(permission: Permission): string {
  return permission
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function memberLabel(member: WorkspaceMemberSummary): string {
  return member.displayName?.trim() || member.email?.trim() || "Unknown user";
}

function brandsLabel(names: string[]): string {
  if (names.length === 0) {
    return "No brands in this workspace";
  }

  return names.join(", ");
}

export function UserManagementView({
  data,
  tab,
  basePath,
  capabilities,
}: {
  data: WorkspaceTeamData;
  tab: UserManagementTab;
  basePath: string;
  capabilities: UserManagementCapabilities;
}) {
  const searchParams = useSearchParams();

  function tabHref(next: UserManagementTab) {
    const path =
      next === "users" ? basePath : `${basePath}?tab=${next}`;
    return withSocialPreview(path, searchParams);
  }

  if (data.source === "unavailable") {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">
          User management
        </h1>
        <p className="mt-2 text-sm text-slate-500">{data.message}</p>
      </section>
    );
  }

  return (
    <div className="bg-white pb-16">
      <div className="bg-[#f5fafd] px-5 pt-5 sm:px-6">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-[#1d1d1f]">
          User management
        </h1>
      </div>

      <div className="px-5 sm:px-6">

      <div className="mt-6 flex items-end justify-between border-b border-slate-300">
        <nav className="-mb-px flex gap-8" aria-label="User management">
          {(
            [
              ["users", "Users"],
              ["roles", "Roles and permissions"],
            ] as const
          ).map(([id, label]) => {
            const active = tab === id;
            return (
              <Link
                key={id}
                href={tabHref(id)}
                className={`inline-flex items-center gap-2 border-b-2 pb-3 text-[15px] font-medium transition ${
                  active
                    ? "border-[#1d1d1f] text-[#1d1d1f]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {!data.teamManagement ? <PremiumMark /> : null}
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {tab === "roles" ? (
        <RolesPanel data={data} />
      ) : (
        <UsersPanel data={data} capabilities={capabilities} />
      )}
      </div>
    </div>
  );
}

function UsersPanel({
  data,
  capabilities,
}: {
  data: Extract<WorkspaceTeamData, { source: "database" }>;
  capabilities: UserManagementCapabilities;
}) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [brandId, setBrandId] = useState("any");
  const [stateFilter, setStateFilter] = useState("any");
  const [roleFilter, setRoleFilter] = useState("any");
  const [addOpen, setAddOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [rolesUpgradeOpen, setRolesUpgradeOpen] = useState(false);
  const [accessMemberId, setAccessMemberId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(
    null,
  );
  const [selectedInvitationId, setSelectedInvitationId] = useState<
    string | null
  >(null);

  const billingHref = withSocialPreview(
    "/dashboard/social/settings?tab=billing",
    searchParams,
  );
  const teamUnlocked = data.teamManagement;

  const brandNames = data.brands.map((brand) => brand.name);

  const selectedMember =
    data.members.find(
      (member) => member.membershipId === selectedMemberId,
    ) ?? null;
  const selectedInvitation =
    data.invitations.find(
      (invitation) =>
        invitation.invitationId === selectedInvitationId &&
        invitation.status === "pending",
    ) ?? null;

  const accessMember =
    data.members.find((member) => member.membershipId === accessMemberId) ??
    null;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const hasBrands = data.brands.length > 0;
    const pending = data.invitations.filter(
      (invitation) => invitation.status === "pending",
    );

    const members = data.members.filter((member) => {
      if (brandId !== "any" && !hasBrands) {
        return false;
      }

      if (stateFilter !== "any" && member.status !== stateFilter) {
        return false;
      }

      if (roleFilter !== "any" && member.role !== roleFilter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      const haystack = [
        member.displayName ?? "",
        member.email ?? "",
        ROLE_LABELS[member.role],
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });

    const invitations = pending.filter((invitation) => {
      if (brandId !== "any" && !hasBrands) {
        return false;
      }

      if (stateFilter === "suspended") {
        return false;
      }

      if (roleFilter !== "any" && invitation.role !== roleFilter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return (
        invitation.email.toLowerCase().includes(needle) ||
        ROLE_LABELS[invitation.role].toLowerCase().includes(needle)
      );
    });

    return { members, invitations };
  }, [
    brandId,
    data.brands.length,
    data.invitations,
    data.members,
    query,
    roleFilter,
    stateFilter,
  ]);

  const canShowMemberActions =
    capabilities.canManageRoles ||
    capabilities.canManagePermissions ||
    capabilities.canSuspendUsers ||
    capabilities.canDeleteUsers;

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">Search users</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="h-11 w-full rounded-full border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#4b8bf5] focus:ring-2 focus:ring-[#4b8bf5]/20"
          />
        </label>

        <FilterSelect
          label="Filter by state"
          displayValue="States"
          value={stateFilter}
          disabled={!teamUnlocked}
          onChange={setStateFilter}
        >
          <option value="any">States</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </FilterSelect>

        <FilterSelect
          label="Filter by brand"
          displayValue="Any brand"
          value={brandId}
          disabled={!teamUnlocked}
          onChange={setBrandId}
          widthClass="lg:w-56"
        >
          <option value="any">Any brand</option>
          {data.brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Filter by role"
          displayValue="Any role"
          value={roleFilter}
          disabled={!teamUnlocked}
          onChange={setRoleFilter}
        >
          <option value="any">Any role</option>
          {ROLE_ORDER.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </FilterSelect>

        <button
          type="button"
          onClick={() => {
            if (!teamUnlocked) {
              setUpgradeOpen(true);
              return;
            }
            if (!capabilities.canInvite) {
              return;
            }
            setAddOpen(true);
          }}
          disabled={teamUnlocked && !capabilities.canInvite}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-[#1d1d1f] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {!data.teamManagement ? <PremiumMark /> : null}
          <Plus className="h-4 w-4" />
          Add user
        </button>
      </div>

      {teamUnlocked && !capabilities.canInvite ? (
        <p className="mt-3 text-sm text-slate-500">
          You can view this workspace team, but you need permission to invite
          people.
        </p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-4 border-b border-slate-100 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <p>Users</p>
          <p>Brands</p>
          <p className="w-10" />
        </div>

        {rows.members.length === 0 && rows.invitations.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">
            {query.trim()
              ? "No users match that search."
              : "No team members in this workspace yet."}
          </p>
        ) : (
          <ul>
            {rows.members.map((member) => (
              <li key={member.membershipId}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedInvitationId(null);
                    setSelectedMemberId(null);
                    setAccessMemberId(member.membershipId);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setAccessMemberId(member.membershipId);
                    }
                  }}
                  className="grid cursor-pointer grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-4 border-b border-slate-100 px-5 py-3.5 transition hover:bg-[#f0f7ff]"
                >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {member.email ?? memberLabel(member)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!teamUnlocked) {
                            setRolesUpgradeOpen(true);
                            return;
                          }
                          setAccessMemberId(member.membershipId);
                        }}
                        className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800 transition hover:bg-sky-100"
                      >
                        {ROLE_LABELS[member.role]}
                      </button>
                      {member.profileId === capabilities.currentProfileId ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          You
                        </span>
                      ) : null}
                      {member.status === "suspended" ? (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                          Suspended
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <p className="truncate text-sm text-slate-600">
                  {brandsLabel(brandNames)}
                </p>
                <button
                  type="button"
                  aria-label={`Manage ${memberLabel(member)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!teamUnlocked) {
                      setUpgradeOpen(true);
                      return;
                    }
                    setSelectedInvitationId(null);
                    setSelectedMemberId(member.membershipId);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#dfff32] text-[#1d1d1f]">
                    <Gem className="h-3 w-3" />
                  </span>
                </button>
                </div>
              </li>
            ))}

            {rows.invitations.map((invitation) => (
              <li key={invitation.invitationId}>
                <div
                  role={teamUnlocked ? "button" : undefined}
                  tabIndex={teamUnlocked ? 0 : undefined}
                  onClick={() => {
                    if (!teamUnlocked) {
                      return;
                    }
                    setSelectedMemberId(null);
                    setSelectedInvitationId(invitation.invitationId);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      if (!teamUnlocked) {
                        return;
                      }
                      setSelectedInvitationId(invitation.invitationId);
                    }
                  }}
                  className={`grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-4 border-b border-slate-100 px-5 py-3.5 transition hover:bg-[#f0f7ff] ${
                    teamUnlocked ? "cursor-pointer" : ""
                  }`}
                >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {invitation.email}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        Pending
                      </span>
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                        {ROLE_LABELS[invitation.role]}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="truncate text-sm text-slate-500">
                  Invitation pending
                </p>
                <button
                  type="button"
                  aria-label={`Manage invitation for ${invitation.email}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!teamUnlocked) {
                      setUpgradeOpen(true);
                      return;
                    }
                    setSelectedMemberId(null);
                    setSelectedInvitationId(invitation.invitationId);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#dfff32] text-[#1d1d1f]">
                    <Gem className="h-3 w-3" />
                  </span>
                </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {addOpen ? (
        <SidePanel
          title="Add user"
          onClose={() => setAddOpen(false)}
        >
          <p className="text-sm text-slate-500">
            Send a workspace invitation by email. They will join{" "}
            {data.clientName} with the role you choose.
          </p>
          <div className="mt-5">
            <InvitationForm allowedRoles={capabilities.allowedRoles} />
          </div>
        </SidePanel>
      ) : null}

      {selectedMember ? (
        <SidePanel
          title={memberLabel(selectedMember)}
          onClose={() => setSelectedMemberId(null)}
        >
          <MemberDetail
            member={selectedMember}
            brandNames={brandNames}
            capabilities={capabilities}
            isSelf={
              selectedMember.profileId === capabilities.currentProfileId
            }
            canShowMemberActions={canShowMemberActions}
          />
        </SidePanel>
      ) : null}

      {selectedInvitation ? (
        <SidePanel
          title={selectedInvitation.email}
          onClose={() => setSelectedInvitationId(null)}
        >
          <InvitationDetail
            invitation={selectedInvitation}
            canInvite={capabilities.canInvite}
          />
        </SidePanel>
      ) : null}

      <UserManagementPremiumModal
        open={upgradeOpen}
        billingHref={billingHref}
        onClose={() => setUpgradeOpen(false)}
      />
      <RolesPremiumModal
        open={rolesUpgradeOpen}
        billingHref={billingHref}
        onClose={() => setRolesUpgradeOpen(false)}
      />
      <MemberAccessModal
        open={Boolean(accessMember)}
        member={accessMember}
        brands={data.brands}
        teamUnlocked={teamUnlocked}
        capabilities={capabilities}
        billingHref={billingHref}
        onClose={() => setAccessMemberId(null)}
      />
    </>
  );
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function RolesPanel({
  data,
}: {
  data: Extract<WorkspaceTeamData, { source: "database" }>;
}) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [addNoticeOpen, setAddNoticeOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null);
  const [detailRole, setDetailRole] = useState<RoleKey | null>(null);

  const billingHref = withSocialPreview(
    "/dashboard/social/settings?tab=billing",
    searchParams,
  );
  const rolesUnlocked = data.teamManagement;
  const canAddRole = data.customRoles;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return ROLE_ORDER.filter((role) => {
      if (!needle) {
        return true;
      }
      return ROLE_LABELS[role].toLowerCase().includes(needle);
    }).map((role) => {
      const enabled = ROLE_PERMISSIONS[role].length;
      const users = data.members.filter(
        (member) => member.role === role,
      ).length;

      return {
        role,
        enabled,
        disabled: ALL_PERMISSIONS.length - enabled,
        users,
      };
    });
  }, [data.members, query]);

  function openRole(role: RoleKey) {
    if (!rolesUnlocked) {
      return;
    }
    setSelectedRole(role);
    setDetailRole(role);
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">Search roles</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="h-11 w-full rounded-full border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#4b8bf5] focus:ring-2 focus:ring-[#4b8bf5]/20"
          />
        </label>

        <div className="flex overflow-hidden rounded-md border border-slate-200">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
            className={`flex h-9 w-9 items-center justify-center transition ${
              view === "grid"
                ? "bg-[#1d1d1f] text-white"
                : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={`flex h-9 w-9 items-center justify-center transition ${
              view === "list"
                ? "bg-[#1d1d1f] text-white"
                : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!canAddRole) {
              setUpgradeOpen(true);
              return;
            }
            setAddNoticeOpen(true);
          }}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-[#1d1d1f] transition hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          Add role
          {!canAddRole ? <PremiumMark /> : null}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 text-center text-sm text-slate-500">
          No roles match that search.
        </p>
      ) : view === "grid" ? (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const selected = selectedRole === row.role;
            return (
              <li key={row.role}>
                <div
                  role={rolesUnlocked ? "button" : undefined}
                  tabIndex={rolesUnlocked ? 0 : undefined}
                  onClick={() => openRole(row.role)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openRole(row.role);
                    }
                  }}
                  className={`flex w-full flex-col rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:bg-[#f0f7ff] ${
                    rolesUnlocked ? "cursor-pointer" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RoleRadio selected={selected && rolesUnlocked} />
                    <RoleIdentity
                      role={row.role}
                      shieldClassName="h-4 w-4 text-[#1d1d1f]"
                    />
                    {!rolesUnlocked ? (
                      <button
                        type="button"
                        aria-label={`Upgrade to manage ${ROLE_LABELS[row.role]}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setUpgradeOpen(true);
                        }}
                        className="ml-auto flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white"
                      >
                        <PremiumMark />
                      </button>
                    ) : null}
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-500">
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Enabled
                      </dt>
                      <dd className="mt-1">
                        {countLabel(row.enabled, "assignment", "assignments")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Disabled
                      </dt>
                      <dd className="mt-1">
                        {countLabel(row.disabled, "assignment", "assignments")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Users
                      </dt>
                      <dd className="mt-1">
                        {countLabel(row.users, "user", "users")}
                      </dd>
                    </div>
                  </dl>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-4 overflow-visible rounded-xl border border-slate-200 bg-white">
          <div className="grid min-w-[720px] grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto] items-center gap-3 border-b border-slate-100 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span className="w-5" />
            <p>Role</p>
            <p>Enabled assignments</p>
            <p>Disabled assignments</p>
            <p>Users</p>
            <span className="w-6" />
          </div>
          <ul>
            {rows.map((row) => {
              const selected = selectedRole === row.role;
              return (
                <li key={row.role}>
                  <div
                    role={rolesUnlocked ? "button" : undefined}
                    tabIndex={rolesUnlocked ? 0 : undefined}
                    onClick={() => openRole(row.role)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openRole(row.role);
                      }
                    }}
                    className={`grid min-w-[720px] w-full grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto] items-center gap-3 border-b border-slate-100 px-5 py-3.5 text-left transition hover:bg-[#f0f7ff] ${
                      rolesUnlocked ? "cursor-pointer" : ""
                    }`}
                  >
                    <RoleRadio selected={selected && rolesUnlocked} />
                    <RoleIdentity
                      role={row.role}
                      shieldClassName="h-3.5 w-3.5 text-[#1d1d1f]"
                    />
                    <span className="text-sm text-slate-600">
                      {countLabel(row.enabled, "assignment", "assignments")}
                    </span>
                    <span className="text-sm text-slate-600">
                      {countLabel(row.disabled, "assignment", "assignments")}
                    </span>
                    <span className="text-sm text-slate-600">
                      {countLabel(row.users, "user", "users")}
                    </span>
                    {!rolesUnlocked ? (
                      <button
                        type="button"
                        aria-label={`Upgrade to manage ${ROLE_LABELS[row.role]}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setUpgradeOpen(true);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white"
                      >
                        <PremiumMark />
                      </button>
                    ) : (
                      <span className="h-8 w-8" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {detailRole && rolesUnlocked ? (
        <SidePanel
          title={ROLE_LABELS[detailRole]}
          onClose={() => setDetailRole(null)}
        >
          <p className="text-sm text-slate-500">
            Built-in workspace role. Custom role editing is not available yet.
          </p>
          <ul className="mt-4 space-y-1.5">
            {ROLE_PERMISSIONS[detailRole].map((permission) => (
              <li key={permission} className="text-sm text-slate-700">
                {permissionLabel(permission)}
              </li>
            ))}
          </ul>
        </SidePanel>
      ) : null}

      {addNoticeOpen ? (
        <SidePanel
          title="Add role"
          onClose={() => setAddNoticeOpen(false)}
        >
          <p className="text-sm leading-6 text-slate-600">
            This plan includes custom roles. A custom-role editor is not
            available yet, so the built-in roles still apply.
          </p>
        </SidePanel>
      ) : null}

      <RolesPremiumModal
        open={upgradeOpen}
        billingHref={billingHref}
        onClose={() => setUpgradeOpen(false)}
      />
    </>
  );
}

function RoleRadio({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
        selected ? "border-[#1d1d1f] bg-white" : "border-slate-300 bg-white"
      }`}
    >
      {selected ? (
        <span className="h-2.5 w-2.5 rounded-full bg-[#1d1d1f]" />
      ) : null}
    </span>
  );
}

function SidePanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/20"
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-[0_12px_36px_rgba(15,23,42,0.18)]">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="truncate text-lg font-semibold text-[#1d1d1f]">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {children}
        </div>
      </aside>
    </div>
  );
}

function MemberDetail({
  member,
  brandNames,
  capabilities,
  isSelf,
  canShowMemberActions,
}: {
  member: WorkspaceMemberSummary;
  brandNames: string[];
  capabilities: UserManagementCapabilities;
  isSelf: boolean;
  canShowMemberActions: boolean;
}) {
  return (
    <div className="space-y-5">
      {member.email ? (
        <p className="text-sm text-slate-500">{member.email}</p>
      ) : null}

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Role
          </dt>
          <dd className="mt-1 text-slate-800">{ROLE_LABELS[member.role]}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Status
          </dt>
          <dd className="mt-1 capitalize text-slate-800">{member.status}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Brands
          </dt>
          <dd className="mt-1 text-slate-800">{brandsLabel(brandNames)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Access
          </dt>
          <dd className="mt-1 text-slate-800">
            {member.role === "owner"
              ? "All access, granted by the Owner role."
              : `${member.customPermissions.length} extra grants, ${member.deniedPermissions.length} denials.`}
          </dd>
        </div>
      </dl>

      {isSelf ? (
        <p className="text-sm text-slate-500">
          Your own access cannot be changed here.
        </p>
      ) : canShowMemberActions ? (
        <div className="space-y-4 border-t border-slate-100 pt-5">
          {capabilities.canManageRoles ? (
            <MemberRoleForm
              membershipId={member.membershipId}
              currentRole={member.role}
              allowedRoles={capabilities.allowedRoles}
            />
          ) : null}

          {capabilities.canManagePermissions && member.role !== "owner" ? (
            <MemberPermissionsForm
              membershipId={member.membershipId}
              customPermissions={member.customPermissions}
              deniedPermissions={member.deniedPermissions}
              assignablePermissions={capabilities.assignablePermissions}
            />
          ) : null}

          {capabilities.canManagePermissions && member.role === "owner" ? (
            <p className="text-xs text-slate-400">
              Owner permissions are fixed.
            </p>
          ) : null}

          {capabilities.canSuspendUsers ? (
            <MemberStatusButton
              membershipId={member.membershipId}
              currentStatus={member.status}
              memberName={memberLabel(member)}
            />
          ) : null}

          {capabilities.canDeleteUsers ? (
            <MemberRemoveButton
              membershipId={member.membershipId}
              memberName={memberLabel(member)}
            />
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          You can view this member, but you need permission to change their
          access.
        </p>
      )}
    </div>
  );
}

function InvitationDetail({
  invitation,
  canInvite,
}: {
  invitation: WorkspaceInvitationSummary;
  canInvite: boolean;
}) {
  return (
    <div className="space-y-5">
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Role
          </dt>
          <dd className="mt-1 text-slate-800">
            {ROLE_LABELS[invitation.role]}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Invited by
          </dt>
          <dd className="mt-1 text-slate-800">
            {invitation.invitedBy ?? "Unknown"}
          </dd>
        </div>
      </dl>

      {canInvite ? (
        <InvitationRevokeButton
          invitationId={invitation.invitationId}
          email={invitation.email}
        />
      ) : (
        <p className="text-sm text-slate-500">
          This invitation is waiting to be accepted.
        </p>
      )}
    </div>
  );
}
