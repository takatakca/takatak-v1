
-- CreateTable
CREATE TABLE "master_identities" (
    "id" UUID NOT NULL,
    "profileId" UUID,
    "firstName" TEXT,
    "lastName" TEXT,
    "primaryEmail" TEXT,
    "primaryEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "primaryPhone" TEXT,
    "primaryPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "accountStatus" TEXT,
    "registeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_profiles" (
    "id" UUID NOT NULL,
    "identityId" UUID NOT NULL,
    "sourceApplication" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "collectedFields" JSONB NOT NULL,
    "verifiedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consentRecords" JSONB,
    "accountStatus" TEXT,
    "lastSynchronizedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_addresses" (
    "id" UUID NOT NULL,
    "identityId" UUID NOT NULL,
    "sourceProfileId" UUID NOT NULL,
    "externalAddressId" TEXT NOT NULL,
    "addressType" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_payment_summaries" (
    "id" UUID NOT NULL,
    "identityId" UUID NOT NULL,
    "sourceProfileId" UUID NOT NULL,
    "sourceApplication" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "refundedAmountMinor" INTEGER,
    "currency" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "stripeCustomerReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_payment_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_synchronization_events" (
    "id" UUID NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "sourceApplication" TEXT NOT NULL,
    "sourceProfileId" UUID,
    "identityId" UUID,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_synchronization_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_identities_profileId_key" ON "master_identities"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "master_identities_primaryEmail_key" ON "master_identities"("primaryEmail");

-- CreateIndex
CREATE UNIQUE INDEX "master_identities_primaryPhone_key" ON "master_identities"("primaryPhone");

-- CreateIndex
CREATE INDEX "source_profiles_identityId_idx" ON "source_profiles"("identityId");

-- CreateIndex
CREATE INDEX "source_profiles_sourceApplication_idx" ON "source_profiles"("sourceApplication");

-- CreateIndex
CREATE UNIQUE INDEX "source_profiles_sourceApplication_externalUserId_key" ON "source_profiles"("sourceApplication", "externalUserId");

-- CreateIndex
CREATE INDEX "source_addresses_identityId_idx" ON "source_addresses"("identityId");

-- CreateIndex
CREATE UNIQUE INDEX "source_addresses_sourceProfileId_externalAddressId_key" ON "source_addresses"("sourceProfileId", "externalAddressId");

-- CreateIndex
CREATE INDEX "source_payment_summaries_identityId_transactionDate_idx" ON "source_payment_summaries"("identityId", "transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "source_payment_summaries_sourceApplication_bookingNumber_key" ON "source_payment_summaries"("sourceApplication", "bookingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "source_synchronization_events_eventId_key" ON "source_synchronization_events"("eventId");

-- CreateIndex
CREATE INDEX "source_synchronization_events_sourceApplication_createdAt_idx" ON "source_synchronization_events"("sourceApplication", "createdAt");

-- CreateIndex
CREATE INDEX "source_synchronization_events_status_idx" ON "source_synchronization_events"("status");

-- AddForeignKey
ALTER TABLE "source_profiles" ADD CONSTRAINT "source_profiles_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "master_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_addresses" ADD CONSTRAINT "source_addresses_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "master_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_addresses" ADD CONSTRAINT "source_addresses_sourceProfileId_fkey" FOREIGN KEY ("sourceProfileId") REFERENCES "source_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_payment_summaries" ADD CONSTRAINT "source_payment_summaries_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "master_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_payment_summaries" ADD CONSTRAINT "source_payment_summaries_sourceProfileId_fkey" FOREIGN KEY ("sourceProfileId") REFERENCES "source_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_synchronization_events" ADD CONSTRAINT "source_synchronization_events_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "master_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_synchronization_events" ADD CONSTRAINT "source_synchronization_events_sourceProfileId_fkey" FOREIGN KEY ("sourceProfileId") REFERENCES "source_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_identities"
ADD CONSTRAINT "master_identities_profileId_fkey"
FOREIGN KEY ("profileId")
REFERENCES "profiles"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Enable RLS on private CRM identity tables
ALTER TABLE "master_identities"
ENABLE ROW LEVEL SECURITY;

ALTER TABLE "source_profiles"
ENABLE ROW LEVEL SECURITY;

ALTER TABLE "source_addresses"
ENABLE ROW LEVEL SECURITY;

ALTER TABLE "source_payment_summaries"
ENABLE ROW LEVEL SECURITY;

ALTER TABLE "source_synchronization_events"
ENABLE ROW LEVEL SECURITY;

ALTER TABLE "source_synchronization_events"
ADD COLUMN "responsePayload" JSONB;