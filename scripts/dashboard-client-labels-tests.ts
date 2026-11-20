// Owner's order (Nov 2026): no prototype in front of a client. These checks
// keep build-phase labels, dead "Coming soon" buttons and developer notes out
// of the client dashboard.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { clientBadges, isBuildPhaseLabel, LIVE_DATA_LABEL } from "../src/lib/dashboard/client-labels";
import { QUICK_ACTIONS, STAFF_ONLY_ROUTES } from "../src/lib/dashboard/dashboard-config";

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

console.log(
  `dashboard client labels: ok (${clientPages.length} client screens and ${sharedComponents.length} shared components scanned, ${STAFF_ONLY_ROUTES.size} staff-only)`,
);
