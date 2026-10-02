import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required for legacy 1LV upgrade check.");
}

const client = new Client({
  connectionString: DATABASE_URL.replace("localhost", "127.0.0.1"),
  ssl: false,
});

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_MERCHANT_ID = "22222222-2222-4222-8222-222222222222";
const MIGRATION_PATH = resolve(
  process.cwd(),
  "prisma/migrations/20261001155500_1lv_master_bridge/migration.sql",
);

async function verifyUpgradedState(label: string) {
  const source = await client.query(
    `
      SELECT
        "merchantId",
        "storeName",
        "storeSlug",
        "marketplaceStatus",
        "companyId",
        "vertical"
      FROM public.source_merchants
      WHERE "id" = $1
    `,
    [SOURCE_MERCHANT_ID],
  );

  assert.equal(source.rowCount, 1, `${label}: fixture source merchant exists`);
  assert.equal(source.rows[0].merchantId, COMPANY_ID);
  assert.equal(source.rows[0].storeName, "Legacy Fixture Store");
  assert.equal(source.rows[0].storeSlug, "legacy-fixture");
  assert.equal(source.rows[0].marketplaceStatus, "approved");
  assert.equal(source.rows[0].companyId, COMPANY_ID);
  assert.equal(source.rows[0].vertical, "marketplace");

  const master = await client.query(
    `
      SELECT "legalName", "primaryEmail", "primaryPhone"
      FROM public.master_merchants
      WHERE "id" = $1
    `,
    [COMPANY_ID],
  );

  assert.equal(master.rowCount, 1, `${label}: master merchant was backfilled`);
  assert.equal(master.rows[0].legalName, "Legacy Fixture Inc.");
  assert.equal(master.rows[0].primaryEmail, "legacy-fixture@example.ca");
  assert.equal(master.rows[0].primaryPhone, "+15145550123");

  const nullability = await client.query(`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'source_merchants'
      AND column_name IN ('merchantId', 'storeName', 'companyId', 'vertical')
  `);

  const nullable = new Map(
    nullability.rows.map((row) => [row.column_name, row.is_nullable]),
  );

  assert.equal(nullable.get("merchantId"), "NO");
  assert.equal(nullable.get("storeName"), "NO");
  assert.equal(nullable.get("companyId"), "YES");
  assert.equal(nullable.get("vertical"), "YES");

  const payloadColumn = await client.query(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'source_synchronization_events'
      AND column_name = 'payload'
  `);
  assert.equal(payloadColumn.rowCount, 1);

  const authUserColumn = await client.query(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'master_identities'
      AND column_name = 'authUserId'
      AND data_type = 'uuid'
  `);
  assert.equal(authUserColumn.rowCount, 1);

  const authUserUnique = await client.query(`
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'master_identities'
      AND indexname = 'master_identities_authUserId_key'
      AND indexdef ILIKE '%UNIQUE%'
  `);
  assert.equal(authUserUnique.rowCount, 1);

  const authUserBindingTrigger = await client.query(`
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'master_identity_auth_user_binding'
      AND tgrelid = 'public.master_identities'::regclass
      AND NOT tgisinternal
  `);
  assert.equal(authUserBindingTrigger.rowCount, 1);

  const fk = await client.query(`
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'source_merchants_merchantId_fkey'
      AND conrelid = 'public.source_merchants'::regclass
  `);
  assert.equal(fk.rowCount, 1);

  const leakedPrivileges = await client.query(`
    SELECT grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name IN ('master_merchants', 'source_merchants')
      AND grantee IN ('anon', 'authenticated')
  `);
  assert.equal(leakedPrivileges.rowCount, 0);

  const duplicateMaster = await client.query(
    `
      SELECT count(*)::int AS count
      FROM public.master_merchants
      WHERE "id" = $1
    `,
    [COMPANY_ID],
  );
  assert.equal(duplicateMaster.rows[0].count, 1);
}

async function main() {
  await client.connect();

  try {
    await verifyUpgradedState("first apply");

    const migrationSql = readFileSync(MIGRATION_PATH, "utf8");
    await client.query(migrationSql);

    await verifyUpgradedState("second apply");

    console.log("1LV legacy production-schema upgrade + idempotence: PASS");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
