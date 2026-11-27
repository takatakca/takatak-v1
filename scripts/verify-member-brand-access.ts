// Per-brand access for team members: the rules (who is limited, what a valid
// choice is), the server checks on every route that receives a brand id, the
// team API, the migration (server-only, off the production list) and the
// switches in the member access window.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { DashboardLanguageProvider } from "../src/components/layout/dashboard-language";
import { MemberAccessModal } from "../src/components/team/member-access-modal";
import {
  brandRestrictionFor,
  filterAllowedBrands,
  isBrandAllowed,
  validateBrandAssignment,
} from "../src/lib/security/brand-access-policy";
import type { UserManagementCapabilities, WorkspaceMemberSummary } from "../src/lib/team/team-data";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok ${name}`);
}

const read = (path: string) => readFileSync(path, "utf8");

const A = "aaaaaaaa-1111-4111-8111-111111111111";
const B = "bbbbbbbb-2222-4222-8222-222222222222";
const C = "cccccccc-3333-4333-8333-333333333333";

check("no brand assigned means every brand; owners and admins are never limited", () => {
  assert.equal(brandRestrictionFor({ role: "editor", assignedBrandIds: [] }), null);
  assert.equal(brandRestrictionFor({ role: "owner", assignedBrandIds: [A] }), null);
  assert.equal(brandRestrictionFor({ role: "admin", assignedBrandIds: [A] }), null);
  const limited = brandRestrictionFor({ role: "staff", assignedBrandIds: [A, B] });
  assert.ok(limited && limited.has(A) && limited.has(B) && !limited.has(C));
});

check("a limited member only sees and opens their brands", () => {
  const limited = brandRestrictionFor({ role: "viewer", assignedBrandIds: [B] });
  assert.equal(isBrandAllowed(limited, B), true);
  assert.equal(isBrandAllowed(limited, A), false);
  assert.equal(isBrandAllowed(null, A), true);
  assert.equal(isBrandAllowed(null, null), false, "no brand id is never allowed");
  const brands = [{ id: A }, { id: B }, { id: C }];
  assert.deepEqual(filterAllowedBrands(brands, limited).map((b) => b.id), [B]);
  assert.deepEqual(filterAllowedBrands(brands, null).map((b) => b.id), [A, B, C]);
});

check("a new choice of brands is checked: workspace brands only, at least one, never for owners or admins", () => {
  const workspace = [A, B, C];
  const owner = validateBrandAssignment({ targetRole: "owner", requested: [A], workspaceBrandIds: workspace });
  assert.ok(!owner.ok && owner.status === 400 && owner.messageFr.length > 0);
  const admin = validateBrandAssignment({ targetRole: "admin", requested: [A], workspaceBrandIds: workspace });
  assert.ok(!admin.ok);
  const notList = validateBrandAssignment({ targetRole: "editor", requested: "x", workspaceBrandIds: workspace });
  assert.ok(!notList.ok && notList.status === 400);
  const forged = validateBrandAssignment({ targetRole: "editor", requested: ["../x"], workspaceBrandIds: workspace });
  assert.ok(!forged.ok && forged.status === 400);
  const other = validateBrandAssignment({
    targetRole: "editor",
    requested: ["dddddddd-4444-4444-8444-444444444444"],
    workspaceBrandIds: workspace,
  });
  assert.ok(!other.ok && other.status === 404, "a brand of another workspace is refused");
  const none = validateBrandAssignment({ targetRole: "editor", requested: [], workspaceBrandIds: workspace });
  assert.ok(!none.ok && /au moins une marque/.test(none.messageFr));
  const all = validateBrandAssignment({ targetRole: "editor", requested: [C, A, B, A], workspaceBrandIds: workspace });
  assert.ok(all.ok && all.brandIds.length === 0, "every brand stores nothing (= every brand)");
  const some = validateBrandAssignment({ targetRole: "staff", requested: [C, A, C], workspaceBrandIds: workspace });
  assert.ok(some.ok);
  if (some.ok) assert.deepEqual(some.brandIds, [A, C].sort());
});

check("the brand selector, the brand switch and the brand lists apply the limit", () => {
  const context = read("src/lib/security/brand-context.ts");
  assert.match(context, /loadBrandRestriction\(access\)/);
  assert.match(context, /const brands = filterAllowedBrands\(allBrands, restriction\);/);
  const selector = read("src/app/api/social/brand-selector/route.ts");
  assert.match(selector, /filterAllowedBrands\(allBrands, restriction\)/);
  const action = read("src/app/dashboard/brand-actions.ts");
  assert.match(action, /!brand \|\| !\(await canAccessBrand\(access, brand\.id\)\)/);
  const data = read("src/lib/brands/brand-data.ts");
  assert.equal((data.match(/\.\.\.brandIdFilter\(restriction\)/g) ?? []).length, 2, "brand list and brand options");
  assert.match(data, /isBrandAllowed\(await loadBrandRestriction\(access\), brandId\)/, "brand detail page");
  assert.match(read("src/lib/brands/brand-settings-data.ts"), /\.\.\.brandIdFilter\(restriction\)/);
});

check("every route that receives a brand id checks it before doing anything", () => {
  for (const path of [
    "src/app/api/brands/[brandId]/settings/route.ts",
    "src/app/api/brands/[brandId]/ai-instructions/route.ts",
  ]) {
    assert.match(read(path), /if \(!\(await canAccessBrand\(gate\.access, brandId\)\)\) \{\n\s+return jsonResponse\(\{ ok: false, message: "This brand was not found\." \}, 404\);/, path);
  }
  const connectionRoutes: Array<[string, number]> = [
    ["src/app/api/social/connections/web/route.ts", 2],
    ["src/app/api/social/connections/web/verify/route.ts", 1],
    ["src/app/api/social/connections/blog/route.ts", 2],
    ["src/app/api/social/connections/bluesky/start/route.ts", 1],
  ];
  for (const [path, count] of connectionRoutes) {
    const source = read(path);
    assert.equal((source.match(/canAccessBrand\(gate\.access, businessBrandId\)/g) ?? []).length, count, path);
    assert.equal((source.match(/^ {2}try \{$/gm) ?? []).length, count, `${path}: one check per handler`);
  }
  assert.match(read("src/app/api/social/connections/start/route.ts"), /canAccessBrand\(gate\.access, validation\.data\.businessBrandId\)/);
  for (const [path, count] of [
    ["src/app/api/social/connections/[connectionId]/route.ts", 1],
    ["src/app/api/social/connections/[connectionId]/sync/route.ts", 2],
    ["src/app/api/social/connections/[connectionId]/cancel-pending/route.ts", 1],
    ["src/app/api/social/connections/[connectionId]/capabilities/route.ts", 1],
  ] as const) {
    assert.equal((read(path).match(/canAccessSocialConnection\(gate\.access, connectionId\)/g) ?? []).length, count, path);
  }
  const list = read("src/app/api/social/connections/route.ts");
  assert.match(list, /requestedBrandId && !isBrandAllowed\(restriction, requestedBrandId\)/);
  assert.match(list, /\.filter\(\(connection\) => isBrandAllowed\(restriction, connection\.brandId\)\)/);
  assert.match(read("src/app/dashboard/growth/analytics/actions.ts"), /!\(await canAccessBrand\(access, brand\)\)/);
  assert.match(read("src/app/dashboard/growth/conversations/actions.ts"), /!\(await canAccessBrand\(access, brand\)\)/);
});

check("before the migration nothing changes; when the check itself fails, no brand is allowed", () => {
  const source = read("src/lib/security/member-brand-access.ts");
  assert.match(source, /^import "server-only";/);
  assert.match(source, /code === "P2021"/);
  assert.match(source, /if \(isMissingTable\(error\)\) return \[\];/, "missing table = every brand, as before");
  assert.match(source, /if \(assigned === "error"\) return new Set<string>\(\);/, "fail closed");
  assert.match(source, /if \(UNRESTRICTED_ROLES\.has\(access\.role\)\) return null;/);
  assert.match(source, /where: \{ clientId, membership: \{ profileId, clientId \} \}/, "rows are read for this person in this workspace only");
});

check("the team API needs the permission, the team plan, a checked origin, and a person who sees every brand", () => {
  const route = read("src/app/api/team/members/[membershipId]/brands/route.ts");
  assert.match(route, /requireWorkspaceApiPermission\("manage_permissions"\)/);
  assert.match(route, /assertClientCanInviteTeam\(access\.activeClientId\)/);
  assert.match(route, /readJsonBody\(request\)/, "readJsonBody checks the request origin");
  assert.match(route, /\(await loadBrandRestriction\(access\)\) !== null/);
  assert.match(route, /target\.profileId === access\.profileId/, "nobody changes their own brands");
  assert.match(route, /ROLE_LEVELS\[target\.role\] > ROLE_LEVELS\[access\.role\]/);
  assert.match(route, /where: \{ id: membershipId, clientId: access\.activeClientId \}/);
  assert.match(route, /action: "workspace_member_brands_changed"/, "every change is written to the audit log");
  assert.match(read("src/lib/security/write-request.ts"), /if \(!hasValidWriteOrigin\(request\)\) \{/);
});

check("the migration keeps the table server-only and stays off the production deploy list", () => {
  const sql = read("prisma/migrations/20261127080000_member_brand_access/migration.sql");
  assert.match(sql, /ALTER TABLE "client_membership_brand_access" ENABLE ROW LEVEL SECURITY;/);
  for (const role of ["PUBLIC", "anon", "authenticated"]) {
    assert.match(sql, new RegExp(`REVOKE ALL ON TABLE "client_membership_brand_access" FROM ${role};`), role);
  }
  assert.match(sql, /REFERENCES "client_memberships"\("id"\) ON DELETE CASCADE/);
  assert.match(sql, /REFERENCES "business_brands"\("id"\) ON DELETE CASCADE/);
  assert.match(sql, /CREATE UNIQUE INDEX "client_membership_brand_access_membershipId_businessBrandId_key"/);
  assert.doesNotMatch(read("scripts/reconcile-production-migrations.mjs"), /member_brand_access/);
});

const brands = [
  { id: A, name: "Café Verdun", status: "active", connectedPlatforms: [] },
  { id: B, name: "Pizza Mtl", status: "active", connectedPlatforms: [] },
];
const capabilities: UserManagementCapabilities = {
  currentProfileId: "owner-profile",
  allowedRoles: ["admin", "manager", "editor", "staff", "viewer"],
  assignablePermissions: [],
  canInvite: true,
  canManageRoles: true,
  canManagePermissions: true,
  canSuspendUsers: true,
  canDeleteUsers: true,
};
const member: WorkspaceMemberSummary = {
  membershipId: "11111111-2222-4333-8444-555555555555",
  profileId: "member-profile",
  authUserId: null,
  displayName: "Membre",
  email: "membre@example.com",
  role: "editor",
  customRoleId: null,
  customRoleName: null,
  status: "active",
  customPermissions: [],
  deniedPermissions: [],
  joinedAt: "2026-11-27T00:00:00.000Z",
  brandAccess: [B],
};
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };

function renderModal(language: "fr" | "en", props: Partial<Parameters<typeof MemberAccessModal>[0]>): string {
  const modal = createElement(MemberAccessModal, {
    open: true,
    member,
    brands,
    teamUnlocked: true,
    brandAccessActivated: true,
    capabilities,
    billingHref: "/dashboard/billing",
    onClose() {},
    ...props,
  });
  const tree: ReactNode = createElement(AppRouterContext.Provider, {
    value: router as never,
    children: createElement(DashboardLanguageProvider, { language, children: modal }),
  });
  return renderToStaticMarkup(tree);
}

function switchFor(html: string, label: string): string {
  const match = html.match(new RegExp(`<button[^>]*role="switch"[^>]*aria-label="${label}"[^>]*>`));
  assert.ok(match, `switch ${label}`);
  return match[0];
}

check("the switches show each member's real brands and can be changed, in French first", () => {
  const fr = renderModal("fr", {});
  assert.match(switchFor(fr, "Accès à Pizza Mtl"), /aria-checked="true"/);
  assert.match(switchFor(fr, "Accès à Café Verdun"), /aria-checked="false"/);
  assert.doesNotMatch(switchFor(fr, "Accès à Café Verdun"), / disabled=""/);
  assert.match(fr, /Enregistrer les marques/);
  assert.match(fr, /Choisissez les marques sur lesquelles ce membre peut travailler/);
  const en = renderModal("en", {});
  assert.match(en, /Save brands/);
});

check("the switches stay read-only before activation, for owners and admins, and for yourself", () => {
  const notActivated = renderModal("fr", { brandAccessActivated: false, member: { ...member, brandAccess: null } });
  const sw = switchFor(notActivated, "Accès à Café Verdun");
  assert.match(sw, /aria-checked="true"/, "before activation every brand stays on");
  assert.match(sw, / disabled=""/);
  assert.match(sw, /L’accès par marque sera activé bientôt/);
  assert.doesNotMatch(notActivated, /Enregistrer les marques/);
  const admin = renderModal("fr", { member: { ...member, role: "admin", brandAccess: null } });
  assert.match(switchFor(admin, "Accès à Pizza Mtl"), / disabled=""/);
  assert.match(admin, /voient toujours toutes les marques/);
  const self = renderModal("fr", { member: { ...member, profileId: capabilities.currentProfileId } });
  assert.match(switchFor(self, "Accès à Pizza Mtl"), / disabled=""/);
  const noPermission = renderModal("fr", { capabilities: { ...capabilities, canManagePermissions: false } });
  assert.match(switchFor(noPermission, "Accès à Pizza Mtl"), / disabled=""/);
});

console.log(`\n${passed} member brand access checks passed`);
