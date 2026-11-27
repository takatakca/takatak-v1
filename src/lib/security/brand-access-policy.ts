// Per-brand access for team members: pure rules, shared by the server checks,
// the team API and the tests.
//
// - No brand assigned to a membership = every brand of the workspace (the
//   default, so nothing changes until an owner restricts someone).
// - Owners and admins always see every brand; they cannot be restricted.
// - A restricted member keeps at least one brand.

export type BrandRestriction = ReadonlySet<string> | null;

export const UNRESTRICTED_ROLES: ReadonlySet<string> = new Set(["owner", "admin"]);

/** The brands a member may use, or null for every brand. */
export function brandRestrictionFor(input: { role: string; assignedBrandIds: readonly string[] }): BrandRestriction {
  if (UNRESTRICTED_ROLES.has(input.role)) return null;
  if (input.assignedBrandIds.length === 0) return null;
  return new Set(input.assignedBrandIds);
}

export function isBrandAllowed(restriction: BrandRestriction, brandId: string | null | undefined): boolean {
  if (!brandId) return false;
  return restriction === null || restriction.has(brandId);
}

export function filterAllowedBrands<T extends { id: string }>(brands: readonly T[], restriction: BrandRestriction): T[] {
  return restriction === null ? [...brands] : brands.filter((brand) => restriction.has(brand.id));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BrandAssignment =
  | { ok: true; brandIds: string[] }
  | { ok: false; status: number; message: string; messageFr: string };

/**
 * Checks a new set of brands for a member. Every brand must belong to the
 * workspace. Choosing every brand stores nothing (= unrestricted). Owners and
 * admins cannot be restricted, and a restricted member keeps at least one brand.
 */
export function validateBrandAssignment(input: {
  targetRole: string;
  requested: unknown;
  workspaceBrandIds: readonly string[];
}): BrandAssignment {
  if (UNRESTRICTED_ROLES.has(input.targetRole)) {
    return {
      ok: false,
      status: 400,
      message: "Owners and admins always see every brand.",
      messageFr: "Les propriétaires et les administrateurs voient toujours toutes les marques.",
    };
  }
  if (!Array.isArray(input.requested) || input.requested.some((id) => typeof id !== "string" || !UUID.test(id))) {
    return { ok: false, status: 400, message: "The brand list is invalid.", messageFr: "La liste des marques est invalide." };
  }
  const workspace = new Set(input.workspaceBrandIds);
  const requested = [...new Set(input.requested as string[])];
  if (requested.some((id) => !workspace.has(id))) {
    return {
      ok: false,
      status: 404,
      message: "A brand was not found in this workspace.",
      messageFr: "Une marque est introuvable dans cet espace.",
    };
  }
  if (requested.length === 0) {
    return {
      ok: false,
      status: 400,
      message: "A member needs at least one brand.",
      messageFr: "Un membre doit garder au moins une marque.",
    };
  }
  // Every brand selected: no restriction stored.
  if (workspace.size > 0 && requested.length === workspace.size) return { ok: true, brandIds: [] };
  return { ok: true, brandIds: requested.sort() };
}
