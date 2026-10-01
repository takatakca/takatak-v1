import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required for legacy 1LV schema fixture.");
}

const client = new Client({
  connectionString: DATABASE_URL.replace("localhost", "127.0.0.1"),
  ssl: false,
});

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_MERCHANT_ID = "22222222-2222-4222-8222-222222222222";

await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.master_companies (
      "id" UUID NOT NULL,
      "legalName" TEXT,
      "displayName" TEXT NOT NULL,
      "primaryEmail" TEXT,
      "primaryPhone" TEXT,
      "country" TEXT,
      "province" TEXT,
      "status" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "master_companies_pkey" PRIMARY KEY ("id")
    );

    CREATE TABLE IF NOT EXISTS public.source_merchants (
      "id" UUID NOT NULL,
      "companyId" UUID NOT NULL,
      "sourceApplication" TEXT NOT NULL,
      "externalMerchantId" TEXT NOT NULL,
      "vertical" TEXT NOT NULL,
      "publicSlug" TEXT,
      "collectedFields" JSONB NOT NULL,
      "status" TEXT,
      "lastSynchronizedAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "source_merchants_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "source_merchants_companyId_fkey"
        FOREIGN KEY ("companyId")
        REFERENCES public.master_companies("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS
      "source_merchants_sourceApplication_externalMerchantId_key"
    ON public.source_merchants("sourceApplication", "externalMerchantId");

    ALTER TABLE public.master_companies ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.source_merchants ENABLE ROW LEVEL SECURITY;

    REVOKE ALL ON TABLE public.master_companies FROM PUBLIC, anon, authenticated;
    REVOKE ALL ON TABLE public.source_merchants FROM PUBLIC, anon, authenticated;
  `);

  await client.query(
    `
      INSERT INTO public.master_companies (
        "id",
        "legalName",
        "displayName",
        "primaryEmail",
        "primaryPhone",
        "country",
        "province",
        "status",
        "updatedAt"
      )
      VALUES ($1, 'Legacy Fixture Inc.', 'Legacy Fixture Store',
        'legacy-fixture@example.ca', '+15145550123', 'CA', 'QC', 'approved', now())
      ON CONFLICT ("id") DO NOTHING
    `,
    [COMPANY_ID],
  );

  await client.query(
    `
      INSERT INTO public.source_merchants (
        "id",
        "companyId",
        "sourceApplication",
        "externalMerchantId",
        "vertical",
        "publicSlug",
        "collectedFields",
        "status",
        "lastSynchronizedAt",
        "updatedAt"
      )
      VALUES ($1, $2, '1lv', 'legacy-vendor-1', 'marketplace',
        'legacy-fixture', '{"fixture":true}'::jsonb, 'approved', now(), now())
      ON CONFLICT ("id") DO NOTHING
    `,
    [SOURCE_MERCHANT_ID, COMPANY_ID],
  );

  console.log("1LV legacy production-schema fixture: SEEDED");
} finally {
  await client.end();
}
