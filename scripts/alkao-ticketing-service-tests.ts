import fs from "node:fs";
import path from "node:path";
import { parseAlkaoOpsOrigin } from "../src/lib/ticketing/alkao-config";
import { isDashboardServiceModule } from "../src/lib/services/service-modules";

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
    "Ticketing is a recognized commercial module",
    isDashboardServiceModule("ticketing"),
    "ALKAO Ticketing is provisioned per Client through ServiceInstance",
  );

  const schema = read("prisma/schema.prisma");
  const migrations = fs
    .readdirSync(path.join(process.cwd(), "prisma/migrations"))
    .filter((dir) => dir.endsWith("_alkao_ticketing_service_module"));
  check(
    "ServiceType has a migrated ticketing value",
    /enum ServiceType \{[^}]*\bticketing\b[^}]*\}/.test(schema) &&
      migrations.length === 1 &&
      /ALTER TYPE "ServiceType" ADD VALUE IF NOT EXISTS 'ticketing'/.test(
        read(`prisma/migrations/${migrations[0]}/migration.sql`),
      ),
    "the Prisma enum and the database enum must both know ticketing",
  );

  const config = read("src/lib/dashboard/dashboard-config.ts");
  check(
    "ALKAO navigation declares its service entitlement",
    /href:\s*"\/dashboard\/ticketing"[\s\S]{0,160}serviceModule:\s*"ticketing"/.test(config),
    "the sidebar hides the menu from Clients without the service",
  );

  const page = read("src/app/dashboard/ticketing/page.tsx");
  check(
    "Direct ticketing route checks entitlement before rendering ALKAO",
    page.indexOf('hasEnabledServiceModule(access, "ticketing")') >= 0 &&
      page.indexOf('hasEnabledServiceModule(access, "ticketing")') <
        page.indexOf("getAlkaoOpsOrigin()") &&
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
