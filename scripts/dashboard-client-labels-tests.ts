// Owner's order (Nov 2026): no prototype in front of a client. These checks
// keep build-phase labels, dead "Coming soon" buttons and developer notes out
// of the client dashboard.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { clientBadges, isBuildPhaseLabel, LIVE_DATA_LABEL } from "../src/lib/dashboard/client-labels";
import { NAV_SECTIONS, QUICK_ACTIONS, STAFF_ONLY_ROUTES } from "../src/lib/dashboard/dashboard-config";
import { asDashboardLanguage, HOME_FR, homeText, NAV_FR, navLabel } from "../src/lib/dashboard/nav-fr";
import { ACCOUNT_LANGUAGES } from "../src/lib/account/account-settings-validation";

// 1. Build-phase labels are recognised; real statuses are kept.
for (const label of ["Foundation", "Future phase", "Coming soon", "Phase 6/7", "Phase 12", "Internal demo", "Mock data", "No automation"]) {
  assert.ok(isBuildPhaseLabel(label), `${label} must be hidden from clients`);
}
for (const label of ["Connected", "Drafts only", "PDF", "Active", "Generation unavailable", "Managed by MIMT"]) {
  assert.ok(!isBuildPhaseLabel(label), `${label} is a real status`);
}
assert.deepEqual(
  clientBadges([{ label: "Foundation" }, { label: "PDF" }, { label: "Phase 9" }]).map((b) => b.label),
  ["PDF"],
);
assert.deepEqual(clientBadges(["Planned", "Connected"]), ["Connected"]);
assert.ok(!/foundation|mock/i.test(LIVE_DATA_LABEL));

// 2. Every home quick action opens a working screen a client can use.
for (const action of QUICK_ACTIONS) {
  assert.ok(action.href && !action.comingSoon, `${action.label} must link somewhere real`);
  assert.ok(!STAFF_ONLY_ROUTES.has(action.href), `${action.label} must not open a staff-only screen`);
}

// 3. Client screens carry no developer notes or dead buttons.
const ROOT = join(__dirname, "..");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".tsx") ? [path] : [];
  });
}
const FORBIDDEN = [
  /note:\s*"(Coming soon|Future phase|Planned)"/,
  /(subtitle|description)="[^"]*(later phase|future phase|Phase \d|CRUD|foundation placeholder|Foundation counts)/i,
  /Actions activate with CRUD/,
];
const clientPages = files(join(ROOT, "src/app/dashboard")).filter((path) => !relative(ROOT, path).startsWith("src/app/dashboard/admin/"));
const offenders: string[] = [];
for (const path of clientPages) {
  const source = readFileSync(path, "utf8");
  const route = "/" + relative(join(ROOT, "src/app"), path).replace(/\/page\.tsx$/, "");
  // Staff-only screens are replaced by the "done by the TAKATAK team" page for clients.
  if (STAFF_ONLY_ROUTES.has(route)) {
    assert.ok(
      /StaffOnly|ModulePlaceholder|platform_admin|requirePlatformAdmin|requireAdminAccess/.test(source),
      `${route} is staff-only and must hide its screen from clients`,
    );
    continue;
  }
  for (const pattern of FORBIDDEN) {
    if (pattern.test(source)) offenders.push(`${relative(ROOT, path)} ~ ${pattern}`);
  }
}
// Shared components shown on client screens: no build-phase sentences either.
// (Planning panels and FoundationNotice are only used on staff-only screens.)
const COMPONENT_FORBIDDEN = /not connected yet|arrives? in (a )?later phases?|in a future phase|Some actions arrive/i;
const sharedComponents = files(join(ROOT, "src/components")).filter((path) => {
  const rel = relative(ROOT, path);
  return !rel.startsWith("src/components/website/") && !rel.startsWith("src/components/admin/") && !/prep-panel|foundation-notice/.test(rel);
});
for (const path of sharedComponents) {
  if (COMPONENT_FORBIDDEN.test(readFileSync(path, "utf8"))) offenders.push(`${relative(ROOT, path)} ~ ${COMPONENT_FORBIDDEN}`);
}
for (const path of clientPages) {
  const route = "/" + relative(join(ROOT, "src/app"), path).replace(/\/page\.tsx$/, "");
  if (!STAFF_ONLY_ROUTES.has(route) && COMPONENT_FORBIDDEN.test(readFileSync(path, "utf8"))) {
    offenders.push(`${relative(ROOT, path)} ~ ${COMPONENT_FORBIDDEN}`);
  }
}
assert.deepEqual(offenders, [], `developer notes on client screens:\n${offenders.join("\n")}`);

// 4. Screens that duplicate a working one lead to it instead of a placeholder.
for (const [page, target] of [
  ["src/app/dashboard/web-hosting/analytics/page.tsx", "/dashboard/growth/analytics"],
  ["src/app/dashboard/web-hosting/performance/page.tsx", "/dashboard/seo"],
  ["src/app/dashboard/settings/page.tsx", "/dashboard/profile"],
]) {
  const source = readFileSync(join(ROOT, page), "utf8");
  assert.ok(source.includes(`redirect("${target}")`), `${page} must lead to ${target}`);
  assert.ok(!/ModulePlaceholder/.test(source), `${page} must not show a placeholder`);
}

// 5. French first: every menu section and item has a French name; French can be chosen in Account settings.
type MenuItem = { label: string; children?: MenuItem[] };
const menuLabels = (items: MenuItem[]): string[] => items.flatMap((item) => [item.label, ...menuLabels(item.children ?? [])]);
for (const section of NAV_SECTIONS) {
  if (section.title) assert.ok(NAV_FR[section.title], `French name missing for the section "${section.title}"`);
  for (const label of menuLabels(section.items as MenuItem[])) assert.ok(NAV_FR[label], `French name missing for the menu item "${label}"`);
}
assert.equal(navLabel("Monthly Reports", "fr"), "Rapports mensuels");
assert.equal(navLabel("Monthly Reports", "en"), "Monthly Reports");
assert.equal(asDashboardLanguage("fr"), "fr");
assert.equal(asDashboardLanguage("de"), "en");
assert.ok((ACCOUNT_LANGUAGES as readonly string[]).includes("fr"), "French is offered in Account settings");
assert.match(readFileSync(join(ROOT, "src/components/account/account-settings-view.tsx"), "utf8"), /<option value="fr">Français<\/option>/);
// The dashboard home and its quick actions follow the account language too.
for (const action of QUICK_ACTIONS) assert.ok(HOME_FR[action.label], `French text missing for the quick action "${action.label}"`);
const homeData = readFileSync(join(ROOT, "src/lib/dashboard/home-data.ts"), "utf8");
for (const match of homeData.matchAll(/(?:label|detail): "([^"]+)"/g)) {
  assert.ok(HOME_FR[match[1]], `French text missing for the dashboard home text "${match[1]}"`);
}
assert.equal(homeText("Total Reach", "fr"), "Portée totale");
// Real workspaces never see sample (internal_mock) social analytics rows.
assert.match(readFileSync(join(ROOT, "src/lib/social/social-data.ts"), "utf8"), /scope\.allowMockFallback \? \{\} : \{ source: \{ not: "internal_mock" as const \} \}/);
// Seed report templates ("… Foundation") stay in the local demo.
assert.match(readFileSync(join(ROOT, "src/lib/reports/reporting-data.ts"), "utf8"), /scope\.allowMockFallback \? all : all\.filter\(\(t\) => !isSeedTemplate\(t\)\)/);
// One-click FR / EN switch: only "en" or "fr", only the caller's own profile.
const switchAction = readFileSync(join(ROOT, "src/app/dashboard/language-actions.ts"), "utf8");
assert.match(switchAction, /if \(raw !== "en" && raw !== "fr"\) return;/);
assert.match(switchAction, /where: \{ id: profileDetails\.id \}/, "the switch changes the caller's own profile only");
assert.match(readFileSync(join(ROOT, "src/components/layout/dashboard-topbar.tsx"), "utf8"), /<LanguageSwitch \/>/);
assert.equal(homeText("Total Reach", "en"), "Total Reach");

console.log(
  `dashboard client labels: ok (${clientPages.length} client screens and ${sharedComponents.length} shared components scanned, ${STAFF_ONLY_ROUTES.size} staff-only)`,
);
