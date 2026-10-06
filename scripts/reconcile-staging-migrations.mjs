import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { canonicalSql } from "./production-migration-normalization.mjs";

const { Client } = pg;

const EXPECTED_PROJECT_REF = "utuvzrqvivqyziibobvu";
const APPROVED_DEPLOY_MIGRATIONS = [
  "20261003062000_hockey_membership_foundation",
  "20261003063500_hockey_parent_team_preferences",
  "20261003064000_hockey_membership_rls_lockdown",
  "20261003065000_hockey_supporter_thankyou_grants",
  "20261003071000_hockey_parent_event_engine",
  "20261003073000_hockey_google_calendar",
  "20261003080000_hockey_smart_departure",
  "20261003081500_hockey_family_team_isolation",
  "20261003083500_hockey_family_guardian_invites",
  "20261003085000_hockey_family_game_logistics",
  "20261003090000_hockey_family_event_rsvp",
  "20261003152000_ahmv_product_catalog",
  "20261003194500_ahmv_schedule_snapshot",
  "20261003194500_takatak_ads_foundation",
  "20261004190000_community_content_moderation",
  "20261005043500_ahmv_smart_departure_entitlement",
  "20261006160000_ai_provider_anthropic",
];

function fail(message) {
  console.error("[staging-migrations] " + message);
  process.exit(1);
}

function runPrisma(args, databaseUrl) {
  const result = spawnSync("npx", ["prisma", "migrate", ...args], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
    },
  });
  if (result.status !== 0) {
    fail("Prisma command failed: prisma migrate " + args.join(" "));
  }
}

const mode = process.env.RECONCILE_MODE === "apply" ? "apply" : "audit";
const confirmedProjectRef = process.env.CONFIRM_PROJECT_REF?.trim() ?? "";
const databaseUrl = process.env.TAKATAK_STAGING_DATABASE_URL?.trim() ?? "";

if (confirmedProjectRef !== EXPECTED_PROJECT_REF) {
  fail(
    "Project confirmation mismatch. Expected " +
      EXPECTED_PROJECT_REF +
      ", received " +
      (confirmedProjectRef || "(empty)") +
      ".",
  );
}
if (!databaseUrl) fail("TAKATAK_STAGING_DATABASE_URL is missing.");
if (!databaseUrl.includes(EXPECTED_PROJECT_REF)) {
  fail("Staging database URL does not contain the expected staging project ref.");
}

const migrationsRoot = join(process.cwd(), "prisma", "migrations");
if (!existsSync(migrationsRoot)) fail("prisma/migrations is missing.");

const repoMigrations = readdirSync(migrationsRoot)
  .filter((name) => /^\d+_/.test(name) && statSync(join(migrationsRoot, name)).isDirectory())
  .sort();

const missingApprovedFiles = APPROVED_DEPLOY_MIGRATIONS.filter(
  (name) => !repoMigrations.includes(name),
);
if (missingApprovedFiles.length > 0) {
  fail(
    "Approved staging migration files are missing from this checkout: " +
      missingApprovedFiles.join(", "),
  );
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  const incomplete = await client.query(
    `select migration_name
       from public._prisma_migrations
       where finished_at is null and rolled_back_at is null`,
  );
  if (incomplete.rowCount !== 0) {
    fail(
      "Staging has incomplete Prisma migrations: " +
        incomplete.rows.map((row) => row.migration_name).join(", "),
    );
  }

  const rows = await client.query(
    `select migration_name
       from public._prisma_migrations
       where finished_at is not null and rolled_back_at is null`,
  );
  let applied = new Set(rows.rows.map((row) => String(row.migration_name)));

  const appliedMissingFromRepo = [...applied].filter(
    (name) => !repoMigrations.includes(name),
  );
  if (appliedMissingFromRepo.length > 0) {
    fail(
      "Staging has applied Prisma migrations missing from this checkout: " +
        appliedMissingFromRepo.join(", "),
    );
  }

  const approved = new Set(APPROVED_DEPLOY_MIGRATIONS);

  const supabaseRows = await client.query(
    `select version, name, statements
       from supabase_migrations.schema_migrations`,
  );
  const supabaseByName = new Map(
    supabaseRows.rows.map((row) => [String(row.name), row]),
  );

  const externallyApplied = [];
  for (const migration of APPROVED_DEPLOY_MIGRATIONS) {
    if (applied.has(migration)) continue;

    const slug = migration.replace(/^\\d+_/, "");
    const history = supabaseByName.get(slug);
    if (!history) continue;

    const sqlPath = join(migrationsRoot, migration, "migration.sql");
    if (!existsSync(sqlPath)) {
      fail("Migration SQL is missing for Supabase history verification: " + migration);
    }

    const repoSql = readFileSync(sqlPath, "utf8");
    const historySql = Array.isArray(history.statements)
      ? history.statements.join("\\n")
      : "";

    if (canonicalSql(historySql) !== canonicalSql(repoSql)) {
      fail(
        "Supabase staging migration history does not match repository SQL: " +
          slug +
          "@" +
          String(history.version),
      );
    }

    externallyApplied.push(migration);
  }

  const pending = repoMigrations.filter(
    (name) => !applied.has(name) && !externallyApplied.includes(name),
  );
  const unexpectedPending = pending.filter((name) => !approved.has(name));
  if (unexpectedPending.length > 0) {
    fail(
      "Unexpected staging migrations are pending: " +
        unexpectedPending.join(", "),
    );
  }

  if (pending.length > 0) {
    const firstPendingIndex = repoMigrations.indexOf(pending[0]);
    const expectedSuffix = repoMigrations.slice(firstPendingIndex);
    if (
      pending.length !== expectedSuffix.length ||
      pending.some((name, index) => name !== expectedSuffix[index])
    ) {
      fail(
        "Staging pending migrations are not a contiguous repository suffix. Refusing out-of-order deploy.",
      );
    }
  }

  console.log("[staging-migrations] Project verified:", EXPECTED_PROJECT_REF);
  console.log(
    "[staging-migrations] Verified externally-applied Supabase migrations:",
    externallyApplied.length,
  );
  console.log(
    "[staging-migrations] Externally-applied list:",
    externallyApplied,
  );
  console.log("[staging-migrations] Pending approved migrations:", pending.length);
  console.log("[staging-migrations] Pending list:", pending);

  if (mode === "audit") {
    console.log("[staging-migrations] AUDIT PASS. No staging mutation performed.");
    process.exit(0);
  }

  for (const migration of externallyApplied) {
    console.log(
      "[staging-migrations] Recording verified Supabase-applied migration in Prisma:",
      migration,
    );
    runPrisma(["resolve", "--applied", migration], databaseUrl);
  }

  const refreshedRows = await client.query(
    `select migration_name
       from public._prisma_migrations
       where finished_at is not null and rolled_back_at is null`,
  );
  applied = new Set(
    refreshedRows.rows.map((row) => String(row.migration_name)),
  );

  const pendingAfterResolve = repoMigrations.filter(
    (name) => !applied.has(name),
  );
  const unexpectedAfterResolve = pendingAfterResolve.filter(
    (name) => !approved.has(name),
  );
  if (unexpectedAfterResolve.length > 0) {
    fail(
      "Unexpected staging migrations remain pending after history reconciliation: " +
        unexpectedAfterResolve.join(", "),
    );
  }

  if (pendingAfterResolve.length > 0) {
    runPrisma(["deploy"], databaseUrl);
  } else {
    console.log("[staging-migrations] No staging migrations remain to apply.");
  }

  const finalRows = await client.query(
    `select migration_name
       from public._prisma_migrations
       where finished_at is not null and rolled_back_at is null`,
  );
  applied = new Set(finalRows.rows.map((row) => String(row.migration_name)));
  const finalPending = repoMigrations.filter((name) => !applied.has(name));
  if (finalPending.length !== 0) {
    fail(
      "Staging still has pending repository migrations after deploy: " +
        finalPending.join(", "),
    );
  }

  const schema = await client.query(
    `select
       to_regclass('public.product_catalog') is not null as product_catalog,
       to_regclass('public.product_plans') is not null as product_plans,
       to_regclass('public.product_entitlements') is not null as product_entitlements,
       to_regclass('public.hockey_memberships') is not null as hockey_memberships,
       to_regclass('public.hockey_families') is not null as hockey_families,
       to_regclass('public.hockey_family_members') is not null as hockey_family_members,
       to_regclass('public.ahmv_schedule_snapshots') is not null as ahmv_schedule_snapshots,
       to_regclass('public.ad_publishers') is not null as ad_publishers,
       to_regclass('public.ad_campaigns') is not null as ad_campaigns,
       to_regclass('public.managed_content_items') is not null as managed_content_items,
       to_regclass('public.content_contributions') is not null as content_contributions`,
  );
  const state = schema.rows[0];
  if (Object.values(state ?? {}).some((value) => value !== true)) {
    fail("Staging AHMV/ADS critical schema verification failed.");
  }

  const rls = await client.query(
    `select c.relname, c.relrowsecurity
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relname = any($1::text[])`,
    [[
      "product_catalog",
      "hockey_memberships",
      "hockey_families",
      "ahmv_schedule_snapshots",
      "ad_publishers",
      "managed_content_items",
      "content_contributions",
    ]],
  );
  if (rls.rowCount !== 7 || rls.rows.some((row) => row.relrowsecurity !== true)) {
    fail("Staging critical RLS verification failed.");
  }

  const plans = await client.query(
    `select
       plan."code",
       plan."status",
       plan."selfServeEligible",
       price."currency",
       price."unitAmountMinor",
       price."billingInterval",
       price."intervalCount"
     from "product_plans" plan
     join "product_catalog" product on product."id" = plan."productId"
     join "product_prices" price on price."planId" = plan."id" and price."active" = true
     where product."code" = 'ahmv'
       and plan."code" in ('parent_essential','parent_premium')
     order by plan."code"`,
  );
  const essential = plans.rows.find((row) => row.code === "parent_essential");
  const premium = plans.rows.find((row) => row.code === "parent_premium");
  if (
    plans.rowCount !== 2 ||
    essential?.status !== "active" ||
    essential?.selfServeEligible !== true ||
    essential?.currency !== "CAD" ||
    Number(essential?.unitAmountMinor) !== 1000 ||
    essential?.billingInterval !== "week" ||
    Number(essential?.intervalCount) !== 1 ||
    premium?.status !== "planned" ||
    premium?.selfServeEligible !== false ||
    premium?.currency !== "CAD" ||
    Number(premium?.unitAmountMinor) !== 3000 ||
    premium?.billingInterval !== "week" ||
    Number(premium?.intervalCount) !== 1
  ) {
    fail("Staging AHMV product catalog seed verification failed.");
  }

  const smartDeparture = await client.query(
    `select
       exists (
         select 1
         from "product_plans" p
         join "product_catalog" product on product."id" = p."productId"
         join "product_plan_entitlements" link on link."planId" = p."id"
         join "product_entitlements" e on e."id" = link."entitlementId"
         where product."code" = 'ahmv'
           and p."code" = 'parent_premium'
           and e."code" = 'smart_departure'
       ) as premium,
       exists (
         select 1
         from "product_plans" p
         join "product_catalog" product on product."id" = p."productId"
         join "product_plan_entitlements" link on link."planId" = p."id"
         join "product_entitlements" e on e."id" = link."entitlementId"
         where product."code" = 'ahmv'
           and p."code" = 'parent_essential'
           and e."code" = 'smart_departure'
       ) as essential`,
  );
  if (
    smartDeparture.rows[0]?.premium !== true ||
    smartDeparture.rows[0]?.essential !== false
  ) {
    fail("Staging Smart Departure entitlement verification failed.");
  }

  console.log("[staging-migrations] APPLY PASS. Staging schema is current and verified.");
} finally {
  await client.end();
}
