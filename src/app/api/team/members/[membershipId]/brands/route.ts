import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { assertClientCanInviteTeam } from "@/lib/billing/social/entitlement-gates";
import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse } from "@/lib/security/api-response";
import {
  BrandAccessNotActivatedError,
  loadBrandRestriction,
  setMemberBrandAssignments,
} from "@/lib/security/member-brand-access";
import { validateBrandAssignment } from "@/lib/security/brand-access-policy";
import type { RoleKey } from "@/lib/security/roles";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { isServiceError } from "@/lib/services/service-error";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLE_LEVELS: Record<RoleKey, number> = {
  owner: 6,
  admin: 5,
  manager: 4,
  editor: 3,
  staff: 2,
  viewer: 1,
};

function refuse(status: number, messageFr: string, message: string): NextResponse {
  return jsonResponse({ ok: false, message: `${messageFr} · ${message}` }, status);
}

/**
 * Sets the brands one team member may use. `brandIds` lists the brands to keep;
 * choosing every brand stores nothing (= every brand, the default).
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ membershipId: string }> },
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("manage_permissions");
  if (!gate.ok) return gate.response;
  const access = gate.access;

  const { membershipId } = await context.params;
  if (!isUuid(membershipId)) {
    return refuse(400, "Ce membre est invalide.", "The selected member is invalid.");
  }

  try {
    await assertClientCanInviteTeam(access.activeClientId);
  } catch (error) {
    if (isServiceError(error)) return jsonResponse({ ok: false, message: error.message }, error.status);
    throw error;
  }

  // Only someone who sees every brand can hand out brands; a member limited
  // to some brands could otherwise remove brands they cannot see.
  if ((await loadBrandRestriction(access)) !== null) {
    return refuse(
      403,
      "Seule une personne qui voit toutes les marques peut choisir les marques d’un membre.",
      "Only someone who sees every brand can choose a member's brands.",
    );
  }

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return jsonResponse({ ok: false, message: bodyResult.message }, bodyResult.status);
  const body = bodyResult.body && typeof bodyResult.body === "object" ? (bodyResult.body as Record<string, unknown>) : {};

  const prisma = getPrisma();
  if (!prisma) return refuse(503, "La base de données est indisponible.", "The database is unavailable.");

  const [target, workspaceBrands] = await Promise.all([
    prisma.clientMembership.findFirst({
      where: { id: membershipId, clientId: access.activeClientId },
      select: { id: true, profileId: true, role: true, profile: { select: { displayName: true, email: true } } },
    }),
    prisma.businessBrand.findMany({
      where: { clientId: access.activeClientId, status: { notIn: ["archived", "frozen"] } },
      select: { id: true },
    }),
  ]);

  if (!target) return refuse(404, "Ce membre est introuvable dans cet espace.", "The workspace member could not be found.");
  if (target.profileId === access.profileId) {
    return refuse(409, "Vous ne pouvez pas changer vos propres marques.", "You cannot change your own brands.");
  }
  if (ROLE_LEVELS[target.role] > ROLE_LEVELS[access.role]) {
    return refuse(403, "Vous ne pouvez pas modifier un membre d’un rôle plus élevé.", "You cannot modify a member with a higher role.");
  }

  const decision = validateBrandAssignment({
    targetRole: target.role,
    requested: body.brandIds,
    workspaceBrandIds: workspaceBrands.map((brand) => brand.id),
  });
  if (!decision.ok) return refuse(decision.status, decision.messageFr, decision.message);

  try {
    await setMemberBrandAssignments({
      clientId: access.activeClientId,
      membershipId: target.id,
      brandIds: decision.brandIds,
      actorProfileId: access.profileId,
    });
    await prisma.auditLog.create({
      data: {
        profileId: access.profileId,
        clientId: access.activeClientId,
        action: "workspace_member_brands_changed",
        entityType: "ClientMembership",
        entityId: target.id,
        metadata: {
          note: `Brand access was updated for ${target.profile.displayName ?? target.profile.email ?? "a workspace member"}.`,
          brandIds: decision.brandIds,
          everyBrand: decision.brandIds.length === 0,
        },
      },
    });
  } catch (error) {
    if (error instanceof BrandAccessNotActivatedError) {
      return refuse(
        503,
        "L’accès par marque n’est pas encore activé pour cet espace.",
        "Per-brand access is not activated for this workspace yet.",
      );
    }
    console.error("[team-brands] Brand access update failed:", error instanceof Error ? error.message : "Unknown error");
    return refuse(500, "Les marques de ce membre n’ont pas pu être enregistrées.", "The member's brands could not be saved.");
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/social/users");

  return jsonResponse(
    { ok: true, brandAccess: decision.brandIds.length === 0 ? null : decision.brandIds },
    200,
  );
}
