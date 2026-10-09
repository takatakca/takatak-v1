import fs from "node:fs";
import path from "node:path";
import type { TenantAccess } from "../src/lib/security/tenant-access";
import {
  DASHBOARD_SERVICE_MODULES,
  isDashboardServiceModule,
} from "../src/lib/services/service-modules";
import { hasAlkaoTicketing, parseAlkaoClientIds } from "../src/lib/ticketing/alkao-access";
import { parseAlkaoOpsOrigin } from "../src/lib/ticketing/alkao-config";

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
  const havana = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  const scoped = (activeClientId: string): TenantAccess => ({
    mode: "client_scoped",
    profileId: "p",
    role: "owner",
    allowedClientIds: [activeClientId],
    activeClientId,
    customPermissions: [],
    deniedPermissions: [],
  });

  check(
    "Existing ServiceInstance modules are unchanged",
    JSON.stringify(DASHBOARD_SERVICE_MODULES) === JSON.stringify(["rentauto"]) &&
      !isDashboardServiceModule("ticketing"),
    "ticketing never enters the Rentauto/ServiceInstance query",
  );

  const schema = read("prisma/schema.prisma");
  const alkaoMigrations = fs
    .readdirSync(path.join(process.cwd(), "prisma/migrations"))
    .filter((dir) => /alkao|ticketing/i.test(dir));
  check(
    "ALKAO needs no TAKATAK database change",
    !/\bticketing\b/.test(schema) && alkaoMigrations.length === 0,
    "no Prisma schema change and no migration: nothing to apply, nothing to roll back",
  );

  const allowed = parseAlkaoClientIds(` ${havana.toUpperCase()}, not-a-uuid,,`);
  check(
    "Menu is off unless the Client is listed in ALKAO_TICKETING_CLIENT_IDS",
    !hasAlkaoTicketing(scoped(havana), parseAlkaoClientIds(undefined)) &&
      !hasAlkaoTicketing(scoped(havana), parseAlkaoClientIds("")) &&
      hasAlkaoTicketing(scoped(havana), allowed) &&
      !hasAlkaoTicketing(scoped(other), allowed) &&
      allowed.size === 1,
    "default off; only listed Clients, ids validated",
  );
  check(
    "Non client-scoped sessions never get the menu",
    !hasAlkaoTicketing({ mode: "foundation_demo", role: "owner", warning: "" }, allowed) &&
      !hasAlkaoTicketing({ mode: "denied", reason: "not_authenticated" }, allowed),
    "foundation demo and denied sessions see nothing",
  );

  const layout = read("src/app/dashboard/layout.tsx");
  check(
    "Dashboard layout only appends the ALKAO module",
    /\.\.\.\(await getEnabledServiceModules\(access\)\),\s*\.\.\.getAlkaoServiceModules\(access\),/.test(layout),
    "existing modules are computed exactly as before",
  );

  const config = read("src/lib/dashboard/dashboard-config.ts");
  check(
    "ALKAO navigation declares its service entitlement",
    /href:\s*"\/dashboard\/ticketing"[\s\S]{0,160}serviceModule:\s*"ticketing"/.test(config),
    "the sidebar hides the menu from Clients without the service",
  );

  const page = read("src/app/dashboard/ticketing/page.tsx");
  check(
    "Direct ticketing route checks access before rendering ALKAO",
    page.indexOf("hasAlkaoTicketing(access)") >= 0 &&
      page.indexOf("hasAlkaoTicketing(access)") < page.indexOf("getAlkaoOpsOrigin()") &&
      /if \(!enabled\) \{\s*redirect\("\/dashboard"\);/.test(page),
    "direct URL access must be gated before the frame is rendered",
  );

  check(
    "ALKAO_OPS_URL must be HTTPS (localhost only outside production)",
    parseAlkaoOpsOrigin("https://ops.alkao.ca/ignored/path?x=1", true) === "https://ops.alkao.ca" &&
      parseAlkaoOpsOrigin("http://ops.alkao.ca", true) === null &&
      parseAlkaoOpsOrigin("http://ops.alkao.ca", false) === null &&
      parseAlkaoOpsOrigin("http://localhost:8787", false) === "http://localhost:8787" &&
      parseAlkaoOpsOrigin("http://localhost:8787", true) === null &&
      parseAlkaoOpsOrigin("https://user:pw@ops.alkao.ca", true) === null &&
      parseAlkaoOpsOrigin("javascript:alert(1)", false) === null &&
      parseAlkaoOpsOrigin("", true) === null &&
      parseAlkaoOpsOrigin(undefined, true) === null,
    "the access token is only ever posted to a trusted origin",
  );

  const frame = read("src/components/ticketing/alkao-frame.tsx");
  check(
    "Frame answers only its own ALKAO iframe",
    /event\.origin !== opsOrigin/.test(frame) &&
      /event\.source !== frame\.current\?\.contentWindow/.test(frame),
    "a message from any other window or origin must not receive a token",
  );
  check(
    "Session is posted to the ALKAO origin only, never to any origin",
    /postMessage\([\s\S]*?,\s*opsOrigin,?\s*\)/.test(frame) && !/postMessage\([^)]*["']\*["']/.test(frame),
    "targetOrigin must pin the ALKAO origin",
  );
  check(
    "The refresh token never leaves TAKATAK",
    !/refresh_token|refreshToken/.test(frame),
    "refreshing inside ALKAO would rotate the token and sign the user out of TAKATAK",
  );
  check(
    "The frame cannot navigate the dashboard",
    /sandbox="[^"]*"/.test(frame) && !/allow-top-navigation/.test(frame),
    "ALKAO runs sandboxed without top navigation",
  );

  console.log("ALKAO Ticketing service verification");
  console.log("====================================");
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
