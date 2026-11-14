import "server-only";

import { cache } from "react";

import { getServerAccessContext } from "@/lib/security/access-context";
import { getPrisma } from "@/lib/db/prisma";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import type { RoleKey } from "@/lib/security/roles";
import type { AuthUser } from "./auth";
import { getRepo } from "./repo";
import { WORKSPACE_ROLE_TO_FOOD_HUB } from "./session";
import type { Role } from "./types";

export { WORKSPACE_ROLE_TO_FOOD_HUB };

// Food Hub runs inside the TAKATAK Dashboard: sign-in, sign-up, invitations,
// workspaces and roles are TAKATAK's. Food Hub only decides:
//  1. which workspace owns the restaurants (one workspace — the data is not
//     split per tenant), and
//  2. what each TAKATAK workspace role may do in Food Hub.

export type FoodHubTenant = { clientId: string; activatedBy?: string; activatedAt?: string; source: "env" | "database" };

export type FoodHubAccess =
  | { state: "signed_out" }
  | { state: "unavailable"; message: string }
  | { state: "no_workspace"; message: string }
  | { state: "not_enabled"; message: string; canActivate: boolean; clientId: string; workspaceName: string | null }
  | { state: "other_workspace"; message: string }
  | { state: "forbidden"; message: string }
  | { state: "ok"; actor: AuthUser; clientId: string; workspaceName: string | null; workspaceRole: RoleKey };

const TENANT_KEY = "tenant";

export async function getFoodHubTenant(): Promise<FoodHubTenant | null> {
  const fromEnv = process.env.FOOD_HUB_CLIENT_ID?.trim();
  if (fromEnv) return { clientId: fromEnv, source: "env" };
  const stored = await getRepo().getKv<Omit<FoodHubTenant, "source">>(TENANT_KEY);
  return stored?.clientId ? { ...stored, source: "database" } : null;
}

function ownerEmails(): string[] {
  return (process.env.FOOD_HUB_OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const getFoodHubAccess = cache(async (): Promise<FoodHubAccess> => {
  const { access, profileDetails, activeClientName } = await getServerAccessContext();

  if (access.mode === "denied") {
    if (access.reason === "not_authenticated") return { state: "signed_out" };
    if (access.reason === "database_unavailable" || access.reason === "production_foundation_blocked") {
      return { state: "unavailable", message: "TAKATAK workspace access is temporarily unavailable." };
    }
    return { state: "forbidden", message: "You do not have access to this workspace." };
  }
  if (access.mode === "foundation_demo") {
    return { state: "unavailable", message: "Food Hub needs the TAKATAK database (DATABASE_URL) to know who you are." };
  }
  if (access.mode !== "client_scoped") {
    return { state: "no_workspace", message: "Select the workspace that runs your restaurants first." };
  }
  if (!hasEffectivePermission(access, "view_dashboard")) {
    return { state: "forbidden", message: "Your workspace role cannot open Food Hub." };
  }

  const tenant = await getFoodHubTenant();
  if (!tenant) {
    const platformAdmin = profileDetails?.role === "owner" || profileDetails?.role === "admin";
    const listedOwner = !!profileDetails?.email && ownerEmails().includes(profileDetails.email.toLowerCase());
    const workspaceOwner = access.role === "owner" || access.role === "admin";
    return {
      state: "not_enabled",
      message: "Food Hub is not activated yet.",
      canActivate: workspaceOwner && (platformAdmin || listedOwner),
      clientId: access.activeClientId,
      workspaceName: activeClientName,
    };
  }
  if (tenant.clientId !== access.activeClientId) {
    return { state: "other_workspace", message: "Food Hub belongs to another TAKATAK workspace. Switch workspace to open it." };
  }

  const role = WORKSPACE_ROLE_TO_FOOD_HUB[access.role] ?? "analyst";
  const name =
    profileDetails?.displayName?.trim() ||
    [profileDetails?.firstName, profileDetails?.lastName].filter(Boolean).join(" ").trim() ||
    profileDetails?.email ||
    "TAKATAK user";
  return {
    state: "ok",
    clientId: access.activeClientId,
    workspaceName: activeClientName,
    workspaceRole: access.role,
    actor: {
      username: profileDetails?.email ?? access.profileId,
      name,
      role,
      // [] = every location. Location-limited Food Hub access can be added later
      // from TAKATAK location assignments; today every member sees all locations.
      locations: [],
      source: "dashboard",
    },
  };
});

/** One-time activation: the restaurants' workspace becomes the Food Hub workspace. */
export async function activateFoodHub(): Promise<{ ok: true; clientId: string } | { ok: false; message: string; status: number }> {
  const access = await getFoodHubAccess();
  if (access.state === "signed_out") return { ok: false, message: "Please sign in.", status: 401 };
  if (access.state === "ok") return { ok: true, clientId: access.clientId };
  if (access.state !== "not_enabled") return { ok: false, message: access.message, status: 403 };
  if (!access.canActivate) {
    return { ok: false, message: "Only the workspace owner who is also a TAKATAK platform owner (or listed in FOOD_HUB_OWNER_EMAILS) can activate Food Hub.", status: 403 };
  }
  const { profileDetails } = await getServerAccessContext();
  await getRepo().setKv(TENANT_KEY, { clientId: access.clientId, activatedBy: profileDetails?.email ?? null, activatedAt: new Date().toISOString() });
  return { ok: true, clientId: access.clientId };
}

export type FoodHubTeamMember = { name: string; email: string; workspaceRole: RoleKey; foodHubRole: Role; status: string };

/** Members of the Food Hub workspace and what they can do in Food Hub (read-only view of TAKATAK Team). */
export async function listFoodHubTeam(clientId: string): Promise<FoodHubTeamMember[]> {
  const prisma = getPrisma();
  if (!prisma) return [];
  const rows = await prisma.clientMembership.findMany({
    where: { clientId },
    include: { profile: { select: { email: true, firstName: true, lastName: true, displayName: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((m) => ({
    name: m.profile.displayName?.trim() || [m.profile.firstName, m.profile.lastName].filter(Boolean).join(" ").trim() || m.profile.email,
    email: m.profile.email,
    workspaceRole: m.role as RoleKey,
    foodHubRole: WORKSPACE_ROLE_TO_FOOD_HUB[m.role as RoleKey] ?? "analyst",
    status: m.status,
  }));
}
