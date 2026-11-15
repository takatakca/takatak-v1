import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import type { Permission } from "@/lib/security/roles";
import { membershipGrantsPermission } from "@/lib/experiences/sc4nner-inventory-permissions";

// SC4NNER ↔ Inventory link (owner's order, 2026-11-14): the deployed label
// studio may START a label from a product of the TAKATAK Inventory, so the
// printed SKU/GTIN is the one the inventory and the registers recognise.
// Read-only and one-way: V1 serves catalog data to SC4NNER for the signed-in
// identity; no label data is ever received or stored by V1 (see
// docs/SC4NNER_BRIDGE.md, "Hard boundary").
const MAX_WORKSPACES = 25;
const MAX_PRODUCTS_PER_WORKSPACE = 200;

export interface Sc4nnerInventoryProduct {
  id: string;
  businessBrandId: string;
  name: string;
  sku: string;
  category: string;
  size: string;
  ingredients: string;
  gtin: string | null;
  priceCents: number;
  quantity: number;
  threshold: number;
}

export interface Sc4nnerInventoryWorkspace {
  clientId: string;
  clientName: string;
  brands: { id: string; name: string }[];
  products: Sc4nnerInventoryProduct[];
}

export interface Sc4nnerInventoryCatalogs {
  linked: boolean;
  reason?: "no_profile";
  workspaces: Sc4nnerInventoryWorkspace[];
}

/**
 * Resolves the inventory catalogs a TAKATAK master identity may read through
 * SC4NNER. The identity maps to its V1 profile; every active workspace
 * membership of that profile is then checked with the same effective
 * `view_inventory` rule the dashboard API gate applies. Tenant scope always
 * comes from the membership — never from a client-supplied workspace id.
 */
export async function listSc4nnerInventoryCatalogs(
  masterIdentityId: string,
): Promise<Sc4nnerInventoryCatalogs> {
  const prisma = getPrisma();
  if (!prisma)
    throw new ServiceError("unavailable", "TAKATAK identity is unavailable.");
  const identity = await prisma.masterIdentity.findUnique({
    where: { id: masterIdentityId },
    select: { id: true, accountStatus: true, profileId: true },
  });
  if (
    !identity ||
    (identity.accountStatus && identity.accountStatus !== "active")
  ) {
    throw new ServiceError(
      "forbidden",
      "SC4NNER inventory is not available for this account.",
    );
  }
  if (!identity.profileId) {
    // A TAKATAK identity without a V1 workspace profile has no inventory to
    // link yet; SC4NNER keeps working standalone for that account.
    return { linked: false, reason: "no_profile", workspaces: [] };
  }
  const profile = await prisma.profile.findUnique({
    where: { id: identity.profileId },
    select: { id: true, status: true },
  });
  if (!profile || profile.status === "disabled") {
    throw new ServiceError(
      "forbidden",
      "SC4NNER inventory is not available for this account.",
    );
  }
  const memberships = await prisma.clientMembership.findMany({
    where: { profileId: profile.id, status: "active" },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          status: true,
          rolePermissionOverrides: {
            select: { role: true, permissions: true },
          },
        },
      },
      customRole: { select: { permissions: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const workspaces: Sc4nnerInventoryWorkspace[] = [];
  for (const membership of memberships) {
    if (
      membership.client.status === "paused" ||
      membership.client.status === "archived"
    )
      continue;
    const override =
      membership.client.rolePermissionOverrides.find(
        (entry) => entry.role === membership.role,
      ) ?? null;
    const canView = membershipGrantsPermission({
      role: membership.role,
      customRolePermissions: membership.customRole
        ? (membership.customRole.permissions as Permission[])
        : null,
      roleOverridePermissions: override
        ? (override.permissions as Permission[])
        : null,
      customPermissions: membership.customPermissions as string[],
      deniedPermissions: membership.deniedPermissions as string[],
      permission: "view_inventory",
    });
    if (!canView) continue;
    const [brands, products] = await Promise.all([
      prisma.businessBrand.findMany({
        where: { clientId: membership.clientId, status: { not: "archived" } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.inventoryProduct.findMany({
        where: { clientId: membership.clientId },
        select: {
          id: true,
          businessBrandId: true,
          name: true,
          sku: true,
          category: true,
          size: true,
          ingredients: true,
          gtin: true,
          priceCents: true,
          quantity: true,
          threshold: true,
        },
        orderBy: { createdAt: "asc" },
        take: MAX_PRODUCTS_PER_WORKSPACE,
      }),
    ]);
    // Workspaces without products add noise to the studio picker; the label
    // flow only needs catalogs that actually hold something to print.
    if (!products.length) continue;
    workspaces.push({
      clientId: membership.clientId,
      clientName: membership.client.name,
      brands,
      products,
    });
    if (workspaces.length >= MAX_WORKSPACES) break;
  }
  return { linked: true, workspaces };
}
