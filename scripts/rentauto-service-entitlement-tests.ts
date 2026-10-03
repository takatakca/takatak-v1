import fs from "node:fs";
import path from "node:path";
import {
  isDashboardServiceModule,
  isEnabledServiceStatus,
} from "../src/lib/services/service-modules";

type Row = { name: string; ok: boolean; detail: string };
const rows: Row[] = [];

function check(name: string, ok: boolean, detail: string) {
  rows.push({ name, ok, detail });
  if (!ok) throw new Error(`${name}: ${detail}`);
}

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

function main() {
  check(
    "Rentauto is a recognized commercial module",
    isDashboardServiceModule("rentauto"),
    "rentauto must remain a supported dashboard service",
  );

  check(
    "Unrelated products do not inherit Rentauto entitlement",
    !isDashboardServiceModule("social") && !isDashboardServiceModule("hosting"),
    "service entitlements must stay explicit per module",
  );

  check(
    "Active and pending setup services are accessible",
    isEnabledServiceStatus("active") &&
      isEnabledServiceStatus("pending_setup"),
    "provisioned customers must see the module during setup and while active",
  );

  check(
    "Paused, planned and cancelled services are not accessible",
    !isEnabledServiceStatus("paused") &&
      !isEnabledServiceStatus("planned") &&
      !isEnabledServiceStatus("cancelled"),
    "non-usable service states must not expose Rentauto",
  );

  const config = read("src/lib/dashboard/dashboard-config.ts");
  check(
    "Rentauto navigation declares its service entitlement",
    /href:\s*"\/dashboard\/rentauto"[\s\S]{0,160}serviceModule:\s*"rentauto"/.test(config),
    "sidebar config must require the Rentauto service",
  );

  const sidebar = read("src/components/layout/dashboard-sidebar.tsx");
  check(
    "Sidebar hides modules that are not provisioned",
    /item\.serviceModule[\s\S]{0,180}!session\.enabledServiceModules\.includes/.test(sidebar),
    "navigation must not merely show a locked Rentauto link",
  );

  const page = read("src/app/dashboard/rentauto/page.tsx");
  check(
    "Direct Rentauto route checks entitlement before loading data",
    page.indexOf('hasEnabledServiceModule(access, "rentauto")') >= 0 &&
      page.indexOf('hasEnabledServiceModule(access, "rentauto")') <
        page.indexOf("getRentautoClientData()"),
    "direct URL access must be gated before Rentauto bootstrap/data reads",
  );

  console.log("Rentauto service entitlement verification");
  console.log("========================================");
  for (const row of rows) {
    console.log(`PASS  ${row.name}`);
    console.log(`      ${row.detail}`);
  }
  console.log("");
  console.log(`Result: ALL PASS (${rows.length} checks)`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
