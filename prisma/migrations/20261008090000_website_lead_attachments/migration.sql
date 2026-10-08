-- Files attached by website visitors to their request (private storage).
CREATE TABLE "lead_attachments" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "leadId" UUID NOT NULL,
  "storageBucket" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'quarantined',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lead_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lead_attachments_status_check" CHECK ("status" IN ('quarantined','approved','rejected','deleted')),
  CONSTRAINT "lead_attachments_size_check" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 10485760)
);

CREATE UNIQUE INDEX "lead_attachment_storage_key" ON "lead_attachments"("storageBucket", "storagePath");
CREATE INDEX "lead_attachments_leadId_idx" ON "lead_attachments"("leadId");
CREATE INDEX "lead_attachments_clientId_createdAt_idx" ON "lead_attachments"("clientId", "createdAt");

ALTER TABLE "lead_attachments" ADD CONSTRAINT "lead_attachments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_attachments" ADD CONSTRAINT "lead_attachments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_attachments" ENABLE ROW LEVEL SECURITY;
