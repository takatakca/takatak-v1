-- Cover 1LV marketplace source-merchant foreign keys flagged by the
-- production Supabase performance advisor.

CREATE INDEX IF NOT EXISTS "marketplace_relationships_sourceMerchantId_idx"
  ON "marketplace_relationships"("sourceMerchantId");

CREATE INDEX IF NOT EXISTS "source_marketplace_orders_sourceMerchantId_idx"
  ON "source_marketplace_orders"("sourceMerchantId");
