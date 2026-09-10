// Security Advisor equivalent: fail CI on public RLS/grant/helper regressions.
import { readFileSync } from "node:fs";

const FORBIDDEN = "pcjfahhlozsseqqevimi";

let failed = 0;
function assert(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

const SECRET_TABLES = [
  "profiles",
  "user_invitations",
  "social_oauth_states",
  "social_credentials",
  "social_content_items",
  "social_competitor_tracks",
  "social_provider_connections",
  "social_account_sync_states",
  "jobs",
  "job_logs",
  "stripe_webhook_events",
  "integration_accounts",
  "integration_events",
  "audit_logs",
  "ai_provider_events",
  "_prisma_migrations",
];

const AUTH_HELPERS = [
  "is_current_profile",
  "has_client_access",
  "has_any_workspace_membership",
  "current_profile_id",
];

async function main() {
  const haystack = JSON.stringify(process.env);
  assert(
    "catalog job is not using hosted project pcjfahhlozsseqqevimi",
    !haystack.includes(FORBIDDEN),
  );

  const { Pool } = await import("pg");
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }
  const pool = new Pool({ connectionString, max: 2 });
  const client = await pool.connect();
  try {
    const noRls = await client.query<{ relname: string }>(
      `SELECT c.relname
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind = 'r'
         AND NOT c.relrowsecurity
       ORDER BY c.relname`,
    );
    assert(
      "every public table has RLS enabled",
      noRls.rows.length === 0,
      noRls.rows.map((row) => row.relname).join(","),
    );

    const secretGrants = await client.query<{ table_name: string; grantee: string }>(
      `SELECT DISTINCT table_name, grantee
       FROM information_schema.role_table_grants
       WHERE table_schema = 'public'
         AND grantee IN ('anon', 'authenticated')
         AND table_name = ANY($1::text[])`,
      [SECRET_TABLES],
    );
    assert(
      "sensitive tables have no anon/authenticated Data API grants",
      secretGrants.rows.length === 0,
      secretGrants.rows.map((row) => `${row.grantee}:${row.table_name}`).join(","),
    );

    const exposedHelpers = await client.query<{ nspname: string; proname: string }>(
      `SELECT n.nspname, p.proname
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE p.prosecdef
         AND p.proname = ANY($1::text[])
         AND n.nspname = ANY($2::text[])`,
      [AUTH_HELPERS, ["public", "graphql_public"]],
    );
    assert(
      "authorization helpers are not in an exposed schema",
      exposedHelpers.rows.length === 0,
      exposedHelpers.rows.map((row) => `${row.nspname}.${row.proname}`).join(","),
    );

    const unsafeDefiner = await client.query<{ proname: string; nspname: string }>(
      `SELECT p.proname, n.nspname
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE p.prosecdef
         AND n.nspname IN ('public', 'private')
         AND p.proname = ANY($1::text[])
         AND NOT EXISTS (
           SELECT 1
           FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
           WHERE cfg ~* '^search_path=pg_catalog(,[[:space:]]*pg_temp)?$'
         )`,
      [AUTH_HELPERS],
    );
    assert(
      "authorization SECURITY DEFINER helpers pin search_path to pg_catalog",
      unsafeDefiner.rows.length === 0,
      unsafeDefiner.rows.map((row) => `${row.nspname}.${row.proname}`).join(","),
    );

    const migration = readFileSync(
      new URL("../prisma/migrations/20260909170000_public_rls_and_fk_indexes/migration.sql", import.meta.url),
      "utf8",
    );
    assert(
      "canonical RLS migration is the applied helper source",
      migration.includes("CREATE SCHEMA IF NOT EXISTS private"),
    );
  } finally {
    client.release();
    await pool.end();
  }

  if (failed > 0) {
    console.error(`\nADVISOR CATALOG: ${failed} FAILURE(S)`);
    process.exit(1);
  }
  console.log("\nADVISOR CATALOG: ALL PASSED");
}

main().catch((error) => {
  console.error("[advisor-catalog]", error instanceof Error ? error.message : error);
  process.exit(1);
});
