import "server-only";

import { cache } from "react";

import { getPrisma } from "@/lib/db/prisma";
import {
  UNRESTRICTED_ROLES,
  brandRestrictionFor,
  isBrandAllowed,
  type BrandRestriction,
} from "@/lib/security/brand-access-policy";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";

/** Prisma error when a table does not exist yet (migration not applied). */
function isMissingTable(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "P2021");
}

const loadAssignedBrandIds = cache(async (profileId: string, clientId: string): Promise<string[] | "error"> => {
  const prisma = getPrisma();
  if (!prisma) return [];
  try {
    const rows = await prisma.clientMembershipBrandAccess.findMany({
      where: { clientId, membership: { profileId, clientId } },
      select: { businessBrandId: true },
    });
    return rows.map((row) => row.businessBrandId);
  } catch (error) {
    // Not activated yet: everyone keeps every brand, as before.
    if (isMissingTable(error)) return [];
    console.error("[brand-access] Brand access query failed:", error instanceof Error ? error.message : "Unknown error");
    return "error";
  }
});

/**
 * The brands this member may use in the active workspace, or null for every
 * brand. Owners and admins are never restricted. When the check itself fails,
 * no brand is allowed (fail closed).
 */
export async function loadBrandRestriction(access: ClientScopedAccess): Promise<BrandRestriction> {
  if (UNRESTRICTED_ROLES.has(access.role)) return null;
  const assigned = await loadAssignedBrandIds(access.profileId, access.activeClientId);
  if (assigned === "error") return new Set<string>();
  return brandRestrictionFor({ role: access.role, assignedBrandIds: assigned });
}

/** True when this member may open or change the given brand. */
export async function canAccessBrand(access: ClientScopedAccess, brandId: string | null | undefined): Promise<boolean> {
  if (!brandId) return false;
  return isBrandAllowed(await loadBrandRestriction(access), brandId);
}

/**
 * True when this member may act on a social connection: the connection's brand
 * must be one of theirs. An unknown connection is left to the route, which is
 * already scoped to the workspace.
 */
export async function canAccessSocialConnection(access: ClientScopedAccess, connectionId: string): Promise<boolean> {
  const restriction = await loadBrandRestriction(access);
  if (restriction === null) return true;
  const prisma = getPrisma();
  if (!prisma) return false;
  const row = await prisma.socialProviderConnection.findFirst({
    where: { id: connectionId, clientId: access.activeClientId },
    select: { businessBrandId: true },
  });
  if (!row) return true;
  return isBrandAllowed(restriction, row.businessBrandId);
}

/** Prisma filter on brand ids for lists: `{}` when every brand is allowed. */
export function brandIdFilter(restriction: BrandRestriction): { id?: { in: string[] } } {
  return restriction === null ? {} : { id: { in: [...restriction] } };
}

/** Same filter for tables that point to a brand through `businessBrandId`. */
export function businessBrandIdFilter(restriction: BrandRestriction): { businessBrandId?: { in: string[] } } {
  return restriction === null ? {} : { businessBrandId: { in: [...restriction] } };
}

export type MemberBrandAssignments = Map<string, string[]>;

/** Brands assigned to each membership of a workspace (team screen). */
export async function listMemberBrandAssignments(clientId: string): Promise<{ activated: boolean; byMembership: MemberBrandAssignments }> {
  const prisma = getPrisma();
  const byMembership: MemberBrandAssignments = new Map();
  if (!prisma) return { activated: false, byMembership };
  try {
    const rows = await prisma.clientMembershipBrandAccess.findMany({
      where: { clientId },
      select: { membershipId: true, businessBrandId: true },
    });
    for (const row of rows) {
      const list = byMembership.get(row.membershipId) ?? [];
      list.push(row.businessBrandId);
      byMembership.set(row.membershipId, list);
    }
    return { activated: true, byMembership };
  } catch (error) {
    if (isMissingTable(error)) return { activated: false, byMembership };
    throw error;
  }
}

export class BrandAccessNotActivatedError extends Error {
  constructor() {
    super("Per-brand member access is not activated yet.");
    this.name = "BrandAccessNotActivatedError";
  }
}

/**
 * Replaces the brands of one membership. An empty list means every brand.
 * The caller checks permissions and validates the list first.
 */
export async function setMemberBrandAssignments(input: {
  clientId: string;
  membershipId: string;
  brandIds: string[];
  actorProfileId: string;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) throw new BrandAccessNotActivatedError();
  try {
    await prisma.$transaction([
      prisma.clientMembershipBrandAccess.deleteMany({
        where: { clientId: input.clientId, membershipId: input.membershipId },
      }),
      ...(input.brandIds.length > 0
        ? [
            prisma.clientMembershipBrandAccess.createMany({
              data: input.brandIds.map((businessBrandId) => ({
                clientId: input.clientId,
                membershipId: input.membershipId,
                businessBrandId,
                createdByProfileId: input.actorProfileId,
              })),
            }),
          ]
        : []),
    ]);
  } catch (error) {
    if (isMissingTable(error)) throw new BrandAccessNotActivatedError();
    throw error;
  }
}
