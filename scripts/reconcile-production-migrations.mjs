import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const { Client } = pg;

const EXPECTED_PROJECT_REF = "pcjfahhlozsseqqevimi";
const TARGET_MIGRATION = "20261001155500_1lv_master_bridge";

const RECONCILE_MIGRATIONS = [
  "20260930164500_add_rentauto_vertical_enums",
  "20260930171000_create_rentauto_domain_foundation",
  "20260930172000_shared_auth_master_identity_bridge",
  "20260930173000_rentauto_account_bootstrap",
  "20260930174000_rentauto_marketplace_booking_core",
  "20260930175000_rentauto_booking_authority",
  "20260930180000_rentauto_operational_lifecycle",
  "20260930181000_rentauto_edge_only_booking_rpc",
  "20260930182000_rentauto_source_profile_bootstrap",
  "20260930183000_rentauto_stripe_checkout_authority",
  "20260930184000_rentauto_trip_lifecycle_tracking_authority",
  "20260930185000_rentauto_client_compatibility_surface",
  "20260930190000_rentauto_anon_schema_usage",
  "20260930191000_rentauto_host_verification_submission",
  "20260930192000_rentauto_concierge_travel_planner",
  "20260930193000_rentauto_host_application_workflow",
  "20260930205500_rentauto_rls_performance_hardening",
  "20260930210000_fix_rentauto_review_trip_vehicle_policy",
  "20260930211000_sync_platform_admin_to_rentauto",
  "20260930211500_repair_source_sync_response_payload",
  "20260930212000_harden_platform_admin_sync",
  "20260930232000_rentauto_car_activation_readiness",
  "20260930232100_rentauto_car_document_verification_authority",
  "20260930232200_rentauto_vehicle_document_storage",
  "20260930234000_rentauto_host_trip_notifications",
  "20260930235000_rentauto_host_verification_authority",
  "20261001012100_rentauto_driver_verification_authority",
  "20261001015000_rentauto_request_to_book",
  "20261001021500_rentauto_driver_verification_reviewer_index",
  "20261001114000_takatak_phone_first_identity_authority",
  "20261001114500_takatak_phone_identity_update_trigger",
];

const KNOWN_PRODUCTION_ONLY_MIGRATIONS = [
  "20260924010000_bluesky_oauth_encrypted_store",
  "20260924030000_google_business_independent_provider",
  "20261001010000_web_site_provider",
  "20261001020000_web_site_uniqueness",
  "20261001030000_blog_provider",
  "20261001040000_blog_uniqueness",
  "20261001050000_twitch_account_uniqueness",
  "20261001060000_meta_ads_provider",
  "20261001070000_meta_ads_uniqueness",
  "20261001080000_google_ads_provider",
  "20261001090000_google_ads_uniqueness",
  "20261001100000_looker_studio_provider",
  "20261001110000_looker_studio_uniqueness",
];

const SERVICE_ROLE_HOTFIX_MIGRATIONS = new Set([
  "20260930232000_rentauto_car_activation_readiness",
  "20260930232100_rentauto_car_document_verification_authority",
]);

function fail(message) {
  console.error("[production-migrations] " + message);
  process.exit(1);
}

function migrationSlug(name) {
  return name.replace(/^\d+_/, "");
}

function canonicalSql(sql) {
  return sql
    .replace(/\r\n/g, "\n")
    .replace(/--[^\n]*/g, "")
    .replace(/COMMENT\s+ON\s+(?:SCHEMA|TABLE)\s+[\s\S]*?;/gi, "")
    .replace(/\s+/g, "")
    .replace(/"/g, "")
    .toLowerCase();
}

function removeServiceRoleHotfix(sql) {
  return sql.replace(
    /\s*OR\s+COALESCE\(auth\.role\(\)\s*=\s*'service_role',\s*false\);/gi,
    ";",
  );
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
const databaseUrl = process.env.TAKATAK_PRODUCTION_DATABASE_URL?.trim() ?? "";

if (confirmedProjectRef !== EXPECTED_PROJECT_REF) {
  fail(
    "Project confirmation mismatch. Expected " +
      EXPECTED_PROJECT_REF +
      ", received " +
      (confirmedProjectRef || "(empty)") +
      ".",
  );
}

if (!databaseUrl) {
  fail("TAKATAK_PRODUCTION_DATABASE_URL is missing.");
}

if (!databaseUrl.includes(EXPECTED_PROJECT_REF)) {
  fail(
    "Production database URL does not contain the expected TAKATAK project ref.",
  );
}

const migrationsRoot = join(process.cwd(), "prisma", "migrations");
if (!existsSync(migrationsRoot)) {
  fail("prisma/migrations is missing.");
}

const repoMigrations = readdirSync(migrationsRoot)
  .filter((name) => {
    const full = join(migrationsRoot, name);
    return /^\d+_/.test(name) && statSync(full).isDirectory();
  })
  .sort();

if (!repoMigrations.includes(TARGET_MIGRATION)) {
  fail("Target 1LV migration is missing from the repository.");
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
      "Production has incomplete Prisma migrations: " +
        incomplete.rows.map((row) => row.migration_name).join(", "),
    );
  }

  const prismaRows = await client.query(
    `select migration_name
       from public._prisma_migrations
       where finished_at is not null and rolled_back_at is null`,
  );
  let prismaApplied = new Set(
    prismaRows.rows.map((row) => String(row.migration_name)),
  );

  const productionOnly = new Set(KNOWN_PRODUCTION_ONLY_MIGRATIONS);

  const unexpectedlyRestored = KNOWN_PRODUCTION_ONLY_MIGRATIONS.filter(
    (name) => repoMigrations.includes(name),
  );
  if (unexpectedlyRestored.length > 0) {
    fail(
      "A production-only migration file reappeared locally. Verify its original checksum before removing the exception: " +
        unexpectedlyRestored.join(", "),
    );
  }

  const missingProductionOnly = KNOWN_PRODUCTION_ONLY_MIGRATIONS.filter(
    (name) => !prismaApplied.has(name),
  );
  if (missingProductionOnly.length > 0) {
    fail(
      "Expected production-only Prisma history entries are missing: " +
        missingProductionOnly.join(", "),
    );
  }

  const appliedMissingFromRepo = [...prismaApplied].filter(
    (name) => !repoMigrations.includes(name),
  );
  const unexpectedAppliedMissing = appliedMissingFromRepo.filter(
    (name) => !productionOnly.has(name),
  );
  if (unexpectedAppliedMissing.length > 0) {
    fail(
      "Unexpected applied migrations are missing from this checkout: " +
        unexpectedAppliedMissing.join(", "),
    );
  }

  const supabaseRows = await client.query(
    `select version, name, statements
       from supabase_migrations.schema_migrations`,
  );
  const supabaseByName = new Map(
    supabaseRows.rows.map((row) => [String(row.name), row]),
  );

  const hotfix = supabaseByName.get(
    "rentauto_vehicle_authority_service_role_fix",
  );
  if (!hotfix) {
    fail("Required Rentauto service-role hotfix is missing in production.");
  }

  const functions = await client.query(
    `select p.proname, pg_get_functiondef(p.oid) as definition
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'rentauto'
         and p.proname in (
           'enforce_car_activation_readiness',
           'enforce_car_document_verification_authority'
         )`,
  );

  if (
    functions.rowCount !== 2 ||
    functions.rows.some(
      (row) =>
        !String(row.definition).includes("auth.role() = 'service_role'"),
    )
  ) {
    fail("Rentauto vehicle authority service-role hotfix is not active.");
  }

  for (const migration of RECONCILE_MIGRATIONS) {
    const path = join(migrationsRoot, migration, "migration.sql");
    if (!existsSync(path)) {
      fail("Missing migration file: " + path);
    }

    const production = supabaseByName.get(migrationSlug(migration));
    if (!production) {
      fail(
        "Supabase production history is missing already-applied migration " +
          migration +
          ".",
      );
    }

    const repoSql = readFileSync(path, "utf8");
    const productionSql = Array.isArray(production.statements)
      ? production.statements.join("\n")
      : "";

    let matches =
      canonicalSql(repoSql) === canonicalSql(productionSql);

    if (!matches && SERVICE_ROLE_HOTFIX_MIGRATIONS.has(migration)) {
      matches =
        canonicalSql(removeServiceRoleHotfix(repoSql)) ===
        canonicalSql(productionSql);
    }

    if (!matches) {
      fail(
        "Production SQL does not match repository migration " +
          migration +
          ".",
      );
    }
  }

  const knownReconciliation = new Set(RECONCILE_MIGRATIONS);
  const unexpectedPending = repoMigrations.filter(
    (name) =>
      !prismaApplied.has(name) &&
      !knownReconciliation.has(name) &&
      name !== TARGET_MIGRATION,
  );

  if (unexpectedPending.length > 0) {
    fail(
      "Unexpected pending Prisma migrations exist: " +
        unexpectedPending.join(", "),
    );
  }

  const targetAlreadyApplied = prismaApplied.has(TARGET_MIGRATION);
  const missingHistory = RECONCILE_MIGRATIONS.filter(
    (name) => !prismaApplied.has(name),
  );

  console.log(
    "[production-migrations] Verified project:",
    EXPECTED_PROJECT_REF,
  );
  console.log(
    "[production-migrations] Supabase-applied / Prisma-unrecorded migrations:",
    missingHistory.length,
  );
  console.log(
    "[production-migrations] Known historical Prisma entries without local files:",
    KNOWN_PRODUCTION_ONLY_MIGRATIONS.length,
  );
  console.log(
    "[production-migrations] 1LV target already applied:",
    targetAlreadyApplied,
  );

  if (mode === "audit") {
    console.log(
      "[production-migrations] AUDIT PASS. No production mutation performed.",
    );
    process.exit(0);
  }

  for (const migration of missingHistory) {
    console.log(
      "[production-migrations] Marking already-applied migration in Prisma:",
      migration,
    );
    runPrisma(["resolve", "--applied", migration], databaseUrl);
  }

  const refreshedRows = await client.query(
    `select migration_name
       from public._prisma_migrations
       where finished_at is not null and rolled_back_at is null`,
  );
  prismaApplied = new Set(
    refreshedRows.rows.map((row) => String(row.migration_name)),
  );

  const pendingAfterResolve = repoMigrations.filter(
    (name) => !prismaApplied.has(name),
  );

  if (targetAlreadyApplied) {
    if (pendingAfterResolve.length !== 0) {
      fail(
        "Target migration is already applied, but other repository migrations remain pending: " +
          pendingAfterResolve.join(", "),
      );
    }

    console.log(
      "[production-migrations] Target migration already applied; skipping Prisma deploy.",
    );
  } else {
    if (
      pendingAfterResolve.length !== 1 ||
      pendingAfterResolve[0] !== TARGET_MIGRATION
    ) {
      fail(
        "After reconciliation, the only pending migration must be " +
          TARGET_MIGRATION +
          "; found: " +
          pendingAfterResolve.join(", "),
      );
    }

    runPrisma(["deploy"], databaseUrl);
  }

  const post = await client.query(
    `select migration_name
       from public._prisma_migrations
       where migration_name = $1
         and finished_at is not null
         and rolled_back_at is null`,
    [TARGET_MIGRATION],
  );
  if (post.rowCount !== 1) {
    fail("1LV target migration is not recorded as applied after deploy.");
  }

  const schemaCheck = await client.query(
    `select
       to_regclass('public.master_merchants') is not null as master_merchants,
       exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'source_merchants'
           and column_name = 'merchantId'
       ) as source_merchant_link,
       exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'source_synchronization_events'
           and column_name = 'payload'
       ) as event_payload,
       exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'master_identities'
           and column_name = 'authUserId'
           and data_type = 'uuid'
       ) as master_auth_user_link,
       exists (
         select 1
         from pg_indexes
         where schemaname = 'public'
           and tablename = 'master_identities'
           and indexname = 'master_identities_authUserId_key'
           and indexdef ilike '%UNIQUE%'
       ) as master_auth_user_unique,
       coalesce((
         select c.relrowsecurity
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = 'master_merchants'
       ), false) as master_merchants_rls,
       coalesce((
         select c.relrowsecurity
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = 'source_merchants'
       ), false) as source_merchants_rls,
       not has_table_privilege('anon', 'public.master_merchants', 'SELECT') as master_anon_denied,
       not has_table_privilege('authenticated', 'public.master_merchants', 'SELECT') as master_authenticated_denied,
       not has_table_privilege('anon', 'public.source_merchants', 'SELECT') as source_anon_denied,
       not has_table_privilege('authenticated', 'public.source_merchants', 'SELECT') as source_authenticated_denied`,
  );

  const state = schemaCheck.rows[0];
  if (
    !state?.master_merchants ||
    !state?.source_merchant_link ||
    !state?.event_payload ||
    !state?.master_auth_user_link ||
    !state?.master_auth_user_unique ||
    !state?.master_merchants_rls ||
    !state?.source_merchants_rls ||
    !state?.master_anon_denied ||
    !state?.master_authenticated_denied ||
    !state?.source_anon_denied ||
    !state?.source_authenticated_denied
  ) {
    fail("Post-deploy 1LV master bridge schema/RLS verification failed.");
  }

  console.log(
    "[production-migrations] APPLY PASS. Prisma history reconciled and 1LV master bridge deployed.",
  );
} finally {
  await client.end();
}
