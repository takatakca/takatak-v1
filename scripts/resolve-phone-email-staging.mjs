import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import {
  PHONE_EMAIL_MIGRATION,
  PHONE_EMAIL_SUPABASE_NAME,
  PRODUCTION_PROJECT_REF,
  STAGING_PROJECT_REF,
  phoneEmailHistoryDecision,
} from "./phone-email-history.mjs";

const { Client } = pg;

function fail(message) {
  console.error("[phone-email-history] " + message);
  process.exit(1);
}

const confirmed = process.env.CONFIRM_PROJECT_REF?.trim() ?? "";
const databaseUrl = process.env.TAKATAK_STAGING_DATABASE_URL?.trim() ?? "";

if (confirmed !== STAGING_PROJECT_REF) {
  fail("Project confirmation mismatch.");
}
if (!databaseUrl) fail("TAKATAK_STAGING_DATABASE_URL is missing.");
if (!databaseUrl.includes(STAGING_PROJECT_REF)) {
  fail("Database URL is not the staging project.");
}
if (databaseUrl.includes(PRODUCTION_PROJECT_REF)) {
  fail("Refusing a production database URL.");
}

const repoSql = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    PHONE_EMAIL_MIGRATION,
    "migration.sql",
  ),
  "utf8",
);

const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const column = await client.query(
    `select is_nullable
       from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'email'`,
  );
  const nullable = column.rows[0]?.is_nullable === "YES";

  const history = await client.query(
    `select statements
       from supabase_migrations.schema_migrations
      where name = $1`,
    [PHONE_EMAIL_SUPABASE_NAME],
  );
  const statements = history.rows[0]?.statements;
  const historySql = Array.isArray(statements) ? statements.join("\n") : "";

  const recorded = await client.query(
    `select 1
       from public._prisma_migrations
      where migration_name = $1
        and finished_at is not null
        and rolled_back_at is null`,
    [PHONE_EMAIL_MIGRATION],
  );

  const decision = phoneEmailHistoryDecision({
    nullable,
    historySql,
    repoSql,
    alreadyRecorded: recorded.rowCount > 0,
  });
  console.log("[phone-email-history] " + decision.action + ": " + decision.reason);

  if (decision.action === "refuse") fail(decision.reason);
  if (decision.action === "noop") process.exit(0);

  const result = spawnSync(
    "npx",
    ["prisma", "migrate", "resolve", "--applied", PHONE_EMAIL_MIGRATION],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DIRECT_URL: databaseUrl,
      },
    },
  );
  if (result.status !== 0) fail("prisma migrate resolve failed.");

  const check = await client.query(
    `select is_nullable
       from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'email'`,
  );
  if (check.rows[0]?.is_nullable !== "YES") {
    fail("Column nullability changed unexpectedly.");
  }
  console.log("[phone-email-history] Prisma history recorded. Column was not altered.");
} finally {
  await client.end();
}
