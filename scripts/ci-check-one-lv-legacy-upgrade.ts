import assert from "node:assert/strict";
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

await client.connect();

try {
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

  assert.equal(source.rowCount, 1);
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

  assert.equal(master.rowCount, 1);
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

  console.log("1LV legacy production-schema upgrade: PASS");
} finally {
  await client.end();
}
