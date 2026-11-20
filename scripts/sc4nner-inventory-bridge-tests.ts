import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { membershipGrantsPermission } from "../src/lib/experiences/sc4nner-inventory-permissions";
import type { Permission } from "../src/lib/security/roles";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

// --- The permission rule mirrors the dashboard gate -------------------------
// Every standard role may view inventory (docs/TAKATAK_INVENTORY.md); only
// owner/admin/manager may manage it. The bridge serves reads, so it must
// grant exactly the memberships the /api/inventory gate would let through.
for (const role of ["owner", "admin", "manager", "editor", "staff", "viewer"] as const) {
  assert.equal(
    membershipGrantsPermission({ role, permission: "view_inventory" }),
    true,
    `${role} keeps view_inventory`,
  );
}
for (const role of ["editor", "staff", "viewer"] as const) {
  assert.equal(
    membershipGrantsPermission({ role, permission: "manage_inventory" }),
    false,
    `${role} has no manage_inventory`,
  );
}
assert.equal(
  membershipGrantsPermission({ role: "manager", permission: "manage_inventory" }),
  true,
  "manager keeps manage_inventory",
);
// A custom role replaces the stock role set entirely.
assert.equal(
  membershipGrantsPermission({
    role: "viewer",
    customRolePermissions: ["view_dashboard"] as Permission[],
    permission: "view_inventory",
  }),
  false,
  "custom role without view_inventory is refused",
);
assert.equal(
  membershipGrantsPermission({
    role: "viewer",
    customRolePermissions: ["view_inventory"] as Permission[],
    permission: "view_inventory",
  }),
  true,
  "custom role with view_inventory is granted",
);
// A per-role override also replaces the stock set for that role.
assert.equal(
  membershipGrantsPermission({
    role: "manager",
    roleOverridePermissions: ["view_dashboard"] as Permission[],
    permission: "manage_inventory",
  }),
  false,
  "role override replaces the manager set",
);
// Membership grants add, denials subtract — denials win.
assert.equal(
  membershipGrantsPermission({
    role: "viewer",
    customRolePermissions: [] as Permission[],
    customPermissions: ["view_inventory"],
    permission: "view_inventory",
  }),
  true,
  "membership grant adds view_inventory",
);
assert.equal(
  membershipGrantsPermission({
    role: "owner",
    deniedPermissions: ["view_inventory"],
    permission: "view_inventory",
  }),
  false,
  "membership denial removes view_inventory even for an owner",
);
console.log("PASS: membership permission rule matches the workspace gate");

// --- The route and resolver keep the bridge contract ------------------------
const route = read("src/app/api/experiences/sc4nner/inventory/route.ts");
const access = read("src/lib/experiences/sc4nner-inventory-access.ts");
assert.ok(
  route.includes("authorizeSc4nnerExchange"),
  "inventory route is protected by the SC4NNER service token",
);
assert.ok(
  route.includes("listSc4nnerInventoryCatalogs"),
  "inventory route delegates to the catalog resolver",
);
assert.ok(
  access.includes('permission: "view_inventory"'),
  "resolver requires effective view_inventory per membership",
);
assert.ok(
  access.includes("clientId: membership.clientId"),
  "catalog queries are scoped by the membership tenant",
);
assert.ok(
  !/inventoryProduct\.(create|update|updateMany|delete|deleteMany)/.test(access),
  "resolver never writes inventory products",
);
assert.ok(
  !/inventoryMovement\.(create|update|delete)/.test(access),
  "resolver never writes stock movements",
);
assert.ok(
  !access.includes("labelConfig"),
  "resolver never reads or returns label artwork",
);
console.log("PASS: SC4NNER inventory bridge contract holds");

console.log("SC4NNER inventory bridge verification passed.");
