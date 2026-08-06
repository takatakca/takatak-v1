/*
  Warnings:

  - A unique constraint covering the columns `[id,clientId]` on the table `business_brands` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LocationStatus" AS ENUM ('draft', 'active', 'paused', 'archived');

-- AlterTable
ALTER TABLE "business_brands" ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Toronto';

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Toronto';

-- CreateTable
CREATE TABLE "business_locations" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Canada',
    "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "LocationStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_locations_clientId_status_idx" ON "business_locations"("clientId", "status");

-- CreateIndex
CREATE INDEX "business_locations_businessBrandId_status_idx" ON "business_locations"("businessBrandId", "status");

-- CreateIndex
CREATE INDEX "business_locations_city_idx" ON "business_locations"("city");

-- CreateIndex
CREATE INDEX "business_locations_isPrimary_idx" ON "business_locations"("isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "business_brands_id_clientId_key" ON "business_brands"("id", "clientId");

-- AddForeignKey
ALTER TABLE "business_locations" ADD CONSTRAINT "business_locations_businessBrandId_clientId_fkey" FOREIGN KEY ("businessBrandId", "clientId") REFERENCES "business_brands"("id", "clientId") ON DELETE CASCADE ON UPDATE CASCADE;
