-- Customer Intelligence / CRM foundation.
-- End-customer data is tenant-scoped and distinct from the TAKATAK Client tenant model.

CREATE TABLE "customer_profiles" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "businessBrandId" UUID,
  "externalKey" TEXT NOT NULL,
  "displayName" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT,
  "normalizedEmail" TEXT,
  "phone" TEXT,
  "normalizedPhone" TEXT,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "region" TEXT,
  "postalCode" TEXT,
  "country" TEXT,
  "evidenceStatus" TEXT NOT NULL DEFAULT 'observed',
  "firstSeenAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_reservations" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "businessBrandId" UUID,
  "customerProfileId" UUID,
  "reservationNumber" TEXT NOT NULL,
  "sourceSystem" TEXT NOT NULL,
  "accommodationCode" TEXT,
  "accommodationType" TEXT,
  "arrivalDate" DATE,
  "departureDate" DATE,
  "nights" INTEGER,
  "adults" INTEGER,
  "children" INTEGER,
  "statusText" TEXT,
  "totalMinor" INTEGER,
  "paidMinor" INTEGER,
  "balanceMinor" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "sourceDate" TIMESTAMP(3),
  "sourceMessageId" TEXT,
  "sourceUrl" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_source_evidence" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "customerProfileId" UUID,
  "customerReservationId" UUID,
  "externalKey" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceSystem" TEXT NOT NULL,
  "sourceAccount" TEXT,
  "sourceRecordId" TEXT,
  "sourceDate" TIMESTAMP(3),
  "subject" TEXT,
  "sourceUrl" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_source_evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_interactions" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "customerProfileId" UUID,
  "externalKey" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3),
  "direction" TEXT,
  "channel" TEXT NOT NULL DEFAULT 'email',
  "subject" TEXT,
  "snippet" TEXT,
  "sourceAccount" TEXT,
  "sourceMessageId" TEXT,
  "sourceUrl" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_interactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_import_batches" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "businessBrandId" UUID,
  "sourceName" TEXT NOT NULL,
  "sourceFileSha256" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'prepared',
  "sourcePeriodStart" TIMESTAMP(3),
  "sourcePeriodEnd" TIMESTAMP(3),
  "customerRows" INTEGER NOT NULL DEFAULT 0,
  "reservationRows" INTEGER NOT NULL DEFAULT 0,
  "evidenceRows" INTEGER NOT NULL DEFAULT 0,
  "interactionRows" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "importedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_profiles_clientId_externalKey_key" ON "customer_profiles"("clientId","externalKey");
CREATE INDEX "customer_profiles_clientId_idx" ON "customer_profiles"("clientId");
CREATE INDEX "customer_profiles_businessBrandId_idx" ON "customer_profiles"("businessBrandId");
CREATE INDEX "customer_profiles_normalizedEmail_idx" ON "customer_profiles"("normalizedEmail");
CREATE INDEX "customer_profiles_normalizedPhone_idx" ON "customer_profiles"("normalizedPhone");
CREATE INDEX "customer_profiles_lastSeenAt_idx" ON "customer_profiles"("lastSeenAt");

CREATE UNIQUE INDEX "customer_reservations_clientId_sourceSystem_reservationNumber_key" ON "customer_reservations"("clientId","sourceSystem","reservationNumber");
CREATE INDEX "customer_reservations_clientId_idx" ON "customer_reservations"("clientId");
CREATE INDEX "customer_reservations_businessBrandId_idx" ON "customer_reservations"("businessBrandId");
CREATE INDEX "customer_reservations_customerProfileId_idx" ON "customer_reservations"("customerProfileId");
CREATE INDEX "customer_reservations_arrivalDate_idx" ON "customer_reservations"("arrivalDate");
CREATE INDEX "customer_reservations_departureDate_idx" ON "customer_reservations"("departureDate");
CREATE INDEX "customer_reservations_sourceMessageId_idx" ON "customer_reservations"("sourceMessageId");

CREATE UNIQUE INDEX "customer_source_evidence_clientId_externalKey_key" ON "customer_source_evidence"("clientId","externalKey");
CREATE INDEX "customer_source_evidence_clientId_idx" ON "customer_source_evidence"("clientId");
CREATE INDEX "customer_source_evidence_customerProfileId_idx" ON "customer_source_evidence"("customerProfileId");
CREATE INDEX "customer_source_evidence_customerReservationId_idx" ON "customer_source_evidence"("customerReservationId");
CREATE INDEX "customer_source_evidence_sourceSystem_idx" ON "customer_source_evidence"("sourceSystem");
CREATE INDEX "customer_source_evidence_sourceRecordId_idx" ON "customer_source_evidence"("sourceRecordId");
CREATE INDEX "customer_source_evidence_sourceDate_idx" ON "customer_source_evidence"("sourceDate");

CREATE UNIQUE INDEX "customer_interactions_clientId_externalKey_key" ON "customer_interactions"("clientId","externalKey");
CREATE INDEX "customer_interactions_clientId_idx" ON "customer_interactions"("clientId");
CREATE INDEX "customer_interactions_customerProfileId_idx" ON "customer_interactions"("customerProfileId");
CREATE INDEX "customer_interactions_occurredAt_idx" ON "customer_interactions"("occurredAt");
CREATE INDEX "customer_interactions_sourceMessageId_idx" ON "customer_interactions"("sourceMessageId");

CREATE UNIQUE INDEX "customer_import_batches_clientId_sourceFileSha256_key" ON "customer_import_batches"("clientId","sourceFileSha256");
CREATE INDEX "customer_import_batches_clientId_idx" ON "customer_import_batches"("clientId");
CREATE INDEX "customer_import_batches_businessBrandId_idx" ON "customer_import_batches"("businessBrandId");
CREATE INDEX "customer_import_batches_status_idx" ON "customer_import_batches"("status");

ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customer_reservations" ADD CONSTRAINT "customer_reservations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_reservations" ADD CONSTRAINT "customer_reservations_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_reservations" ADD CONSTRAINT "customer_reservations_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "customer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customer_source_evidence" ADD CONSTRAINT "customer_source_evidence_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_source_evidence" ADD CONSTRAINT "customer_source_evidence_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "customer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_source_evidence" ADD CONSTRAINT "customer_source_evidence_customerReservationId_fkey" FOREIGN KEY ("customerReservationId") REFERENCES "customer_reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "customer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customer_import_batches" ADD CONSTRAINT "customer_import_batches_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_import_batches" ADD CONSTRAINT "customer_import_batches_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_source_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_profiles_select_by_workspace" ON public.customer_profiles
FOR SELECT TO authenticated USING (private.has_client_access("clientId"));
CREATE POLICY "customer_reservations_select_by_workspace" ON public.customer_reservations
FOR SELECT TO authenticated USING (private.has_client_access("clientId"));
CREATE POLICY "customer_source_evidence_select_by_workspace" ON public.customer_source_evidence
FOR SELECT TO authenticated USING (private.has_client_access("clientId"));
CREATE POLICY "customer_interactions_select_by_workspace" ON public.customer_interactions
FOR SELECT TO authenticated USING (private.has_client_access("clientId"));
CREATE POLICY "customer_import_batches_select_by_workspace" ON public.customer_import_batches
FOR SELECT TO authenticated USING (private.has_client_access("clientId"));

-- Keep Data API authorization membership-only. Platform-admin global views remain on the Prisma/server path.
DROP FUNCTION IF EXISTS public.customer_intelligence_has_access(uuid);
