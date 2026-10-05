import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { sendAlkaoEvents } from "../src/lib/integrations/alkao/client";
import { brandStatus, clientStatus, planAlkaoSync, type AlkaoState, type TakatakClient } from "../src/lib/integrations/alkao/plan";
import { loadAlkaoSyncConfig } from "../src/lib/integrations/alkao/sync";

// Run: npx tsx --require ./scripts/register-server-only.cjs scripts/alkao-sync-tests.ts
type Row = { name: string; detail: string };
const rows: Row[] = [];
function check(name: string, ok: boolean, detail: string) {
  rows.push({ name, detail });
  if (!ok) throw new Error(`${name}: ${detail}`);
}
const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

const C = "11111111-1111-4111-8111-111111111111";
const B_SELL = "22222222-2222-4222-8222-222222222222";
const B_SPA = "33333333-3333-4333-8333-333333333333";
const U_OWNER = "44444444-4444-4444-8444-444444444444";
const U_STAFF = "55555555-5555-4555-8555-555555555555";
const U_GONE = "66666666-6666-4666-8666-666666666666";
const OTHER = "77777777-7777-4777-8777-777777777777";
const NOW = 1_800_000_000_000;

const master = (): TakatakClient[] => [
  {
    id: C,
    name: "Havana Resort",
    status: "active",
    timezone: "America/Toronto",
    brands: [
      { id: B_SELL, name: "Havana Resort", status: "active" },
      { id: B_SPA, name: "Havana Spa", status: "active" },
    ],
    members: [
      { authUserId: U_OWNER, role: "owner", status: "active", profileStatus: "active" },
      { authUserId: U_STAFF, role: "staff", status: "active", profileStatus: "invited" },
    ],
  },
];
const settings = {
  clientIds: new Set([C]),
  ticketingBrandIds: new Set([B_SELL]),
  defaultCommission: { rateBps: 300, fixedCentsPerPaidAdmission: 50 },
};
const inSync = (): AlkaoState[] => [
  {
    clientId: C, name: "Havana Resort", status: "active", timezone: "America/Toronto",
    commission: { rateBps: 250, fixedCentsPerPaidAdmission: 75 }, version: 10,
    brands: [{ brandId: B_SELL, name: "Havana Resort", status: "active", version: 11, entitlement: { status: "active", validFrom: null, validUntil: null, version: 12 } }],
    members: [{ userId: U_OWNER, role: "owner", status: "active", version: 13 }],
  },
];

async function main() {
  // ── Plan ─────────────────────────────────────────────────────────────────
  const fresh = planAlkaoSync(master(), [], settings, NOW);
  check(
    "A new Client is created in dependency order, Ticketing only for the listed Brand",
    JSON.stringify(fresh.events.map((e) => e.type)) === JSON.stringify(["client.upserted", "brand.upserted", "membership.upserted", "entitlement.updated"]) &&
      fresh.events[0]!.data.commission !== undefined &&
      JSON.stringify(fresh.events[0]!.data.commission) === JSON.stringify(settings.defaultCommission) &&
      fresh.events[1]!.data.brandId === B_SELL && fresh.events[3]!.data.status === "active",
    "client → selling brand → active members → entitlement; the spa brand and an invited (inactive) profile are not sent",
  );

  check(
    "Nothing changes: nothing is sent",
    planAlkaoSync(master(), inSync(), settings, NOW).events.length === 0,
    "the reconciliation is quiet when TAKATAK and ALKAO agree; an existing commission is kept",
  );

  const changed = master();
  changed[0]!.name = "Havana Resort & Spa";
  changed[0]!.brands[0]!.status = "paused";
  changed[0]!.members[0]!.role = "admin";
  const state = inSync();
  state[0]!.members.push({ userId: U_GONE, role: "manager", status: "active", version: 14 });
  const diff = planAlkaoSync(changed, state, { ...settings, ticketingBrandIds: new Set() }, NOW);
  const types = diff.events.map((e) => `${e.type}:${String(e.data.status ?? e.data.role ?? "")}`);
  check(
    "Only differences are sent: rename, paused brand, new role, removed member, Ticketing turned off",
    JSON.stringify(types) === JSON.stringify([
      "client.upserted:active", "brand.upserted:suspended", "membership.upserted:active", "membership.removed:", "entitlement.updated:inactive",
    ]) && diff.events.every((e) => Number(e.data.version) >= NOW),
    "each event carries a version at least the sync time",
  );
  check(
    "The existing commission is never overwritten by the default",
    JSON.stringify(diff.events[0]!.data.commission) === JSON.stringify({ rateBps: 250, fixedCentsPerPaidAdmission: 75 }),
    "commission terms set in ALKAO stay as they are",
  );

  const ahead = inSync();
  ahead[0]!.version = NOW + 5_000;
  const renamed = master();
  renamed[0]!.name = "Havana";
  check(
    "Versions always move forward",
    Number(planAlkaoSync(renamed, ahead, settings, NOW).events[0]!.data.version) === NOW + 5_001,
    "a version ALKAO holds from a clock ahead of ours is still superseded",
  );

  const delisted = planAlkaoSync(master(), inSync(), { ...settings, clientIds: new Set([OTHER]) }, NOW);
  check(
    "A Client taken off the list stops selling",
    delisted.events.length === 1 && delisted.events[0]!.type === "entitlement.updated" && delisted.events[0]!.data.status === "inactive",
    "its history stays in ALKAO; only Ticketing is turned off",
  );

  const noCommission = planAlkaoSync(master(), [], { ...settings, defaultCommission: null }, NOW);
  check(
    "No default commission: a new Client is not created",
    noCommission.events.length === 0 && noCommission.warnings.length === 1,
    "commission terms must be explicit",
  );

  check(
    "Status mapping keeps ALKAO closed unless TAKATAK is active",
    clientStatus("prospect") === "suspended" && clientStatus("paused") === "suspended" && clientStatus("active") === "active" &&
      clientStatus("archived") === "archived" && brandStatus("draft") === "suspended" && brandStatus("frozen") === "suspended",
    "prospect, paused, draft and frozen never sell",
  );

  // ── Configuration ───────────────────────────────────────────────────────────
  const base = { ALKAO_SYNC_URL: "https://billets.example.ca", ALKAO_CONTROL_KEY_ID: "takatak", ALKAO_CONTROL_SECRET: "s".repeat(40), ALKAO_TICKETING_CLIENT_IDS: C, NODE_ENV: "production" } as NodeJS.ProcessEnv;
  check(
    "The sync is off unless fully configured",
    loadAlkaoSyncConfig({} as NodeJS.ProcessEnv) === null &&
      loadAlkaoSyncConfig({ ...base, ALKAO_TICKETING_CLIENT_IDS: "" }) === null &&
      loadAlkaoSyncConfig({ ...base, ALKAO_CONTROL_SECRET: "short" }) === null &&
      loadAlkaoSyncConfig({ ...base, ALKAO_SYNC_URL: "http://billets.example.ca" }) === null &&
      loadAlkaoSyncConfig({ ...base, ALKAO_SYNC_URL: "http://localhost:8787" }) === null &&
      loadAlkaoSyncConfig({ ...base, NODE_ENV: "development", ALKAO_SYNC_URL: "http://localhost:8787" }) !== null &&
      loadAlkaoSyncConfig(base)?.settings.defaultCommission === null &&
      loadAlkaoSyncConfig({ ...base, ALKAO_COMMISSION_RATE_BPS: "300", ALKAO_COMMISSION_FIXED_CENTS: "50" })?.settings.defaultCommission?.rateBps === 300,
    "HTTPS only (localhost in development), a real secret, and an explicit Client list",
  );

  // ── Signed delivery ─────────────────────────────────────────────────────────
  const seen: { headers: Headers; body: string }[] = [];
  const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    seen.push({ headers, body: String(init?.body) });
    const refused = seen.length === 2;
    return new Response(JSON.stringify(refused ? { error: { code: "unknown_client" } } : { outcome: "applied" }), { status: refused ? 409 : 200 });
  }) as typeof fetch;
  const target = { url: "https://billets.example.ca", keyId: "takatak", secret: "s".repeat(40) };
  const outcomes = await sendAlkaoEvents(target, fresh.events, fakeFetch);
  const first = seen[0]!;
  const expected = `v1=${createHmac("sha256", target.secret).update(`${first.headers.get("x-alkao-timestamp")}.${first.body}`).digest("hex")}`;
  check(
    "Events are signed as ALKAO expects and stop at the first refusal",
    first.headers.get("x-alkao-signature") === expected && first.headers.get("x-alkao-key-id") === "takatak" &&
      JSON.parse(first.body).contract === "alkao.control.v1" && outcomes.length === 2 && seen.length === 2,
    "HMAC-SHA256 over <timestamp>.<body>; nothing is sent after a refusal",
  );

  // ── Static safeguards ───────────────────────────────────────────────────────
  const sync = read("src/lib/integrations/alkao/sync.ts");
  check(
    "The sync never writes to the TAKATAK database",
    !/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw|\$queryRaw|\$transaction/.test(sync) && /\.findMany\(/.test(sync),
    "read-only Prisma access (findMany only)",
  );
  const route = read("src/lib/integrations/alkao/route.ts");
  check(
    "The sync route requires the cron secret and does nothing unconfigured",
    /CRON_SECRET/.test(route) && /status: 401/.test(route) && /status: 503/.test(route),
    "same protection as the existing cron routes",
  );

  console.log("ALKAO sync verification");
  console.log("=======================");
  for (const row of rows) console.log(`PASS  ${row.name}\n      ${row.detail}`);
  console.log(`\nResult: ALL PASS (${rows.length} checks)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
