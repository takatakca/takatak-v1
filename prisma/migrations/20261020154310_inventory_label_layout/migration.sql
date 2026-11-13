-- Product-owned, tenant-scoped wraparound layout settings. Existing inventory
-- table RLS and restricted Data API grants also cover this JSON column.
ALTER TABLE "inventory_products" ADD COLUMN "labelConfig" JSONB;
