-- Workspace custom and denied permissions use this PostgreSQL enum.
ALTER TYPE "PermissionKey" ADD VALUE 'view_inventory';
ALTER TYPE "PermissionKey" ADD VALUE 'manage_inventory';

-- CreateTable
CREATE TABLE "inventory_products" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "ingredients" TEXT NOT NULL,
    "gtin" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "threshold" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "actorProfileId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "lot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_products_clientId_businessBrandId_idx" ON "inventory_products"("clientId", "businessBrandId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_products_id_clientId_key" ON "inventory_products"("id", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_products_businessBrandId_sku_key" ON "inventory_products"("businessBrandId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_products_clientId_gtin_key" ON "inventory_products"("clientId", "gtin");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_requestId_key" ON "inventory_movements"("requestId");

-- CreateIndex
CREATE INDEX "inventory_movements_clientId_createdAt_idx" ON "inventory_movements"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "inventory_products" ADD CONSTRAINT "inventory_products_businessBrandId_clientId_fkey" FOREIGN KEY ("businessBrandId", "clientId") REFERENCES "business_brands"("id", "clientId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_productId_clientId_fkey" FOREIGN KEY ("productId", "clientId") REFERENCES "inventory_products"("id", "clientId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Stock and money bounds remain enforced if application validation is bypassed.
ALTER TABLE "inventory_products" ADD CONSTRAINT "inventory_products_bounds_check"
  CHECK ("quantity" BETWEEN 0 AND 1000000000 AND "priceCents" BETWEEN 0 AND 1000000000 AND "threshold" BETWEEN 0 AND 1000000000);
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_delta_check"
  CHECK ("delta" <> 0 AND "delta" BETWEEN -1000000000 AND 1000000000);
-- Server-only access. Next.js verifies workspace membership and effective permission.
-- No direct anon/authenticated REST writes, even if Supabase default grants exist.
ALTER TABLE "inventory_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "inventory_products", "inventory_movements" FROM PUBLIC;
REVOKE ALL ON TABLE "inventory_products", "inventory_movements" FROM anon;
REVOKE ALL ON TABLE "inventory_products", "inventory_movements" FROM authenticated;
