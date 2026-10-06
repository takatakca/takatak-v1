-- SEO technical site audits (additive). TAKATAK fetches only websites that
-- belong to the workspace (domain assets / brand websites); results are
-- tenant-scoped by clientId. Server-side Prisma access only.

CREATE TABLE IF NOT EXISTS "seo_audits" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "host" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running'
    CHECK ("status" IN ('running','completed','failed')),
  "score" INTEGER CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 100)),
  "pagesScanned" INTEGER NOT NULL DEFAULT 0 CHECK ("pagesScanned" >= 0),
  "summary" JSONB,
  "failureReason" TEXT,
  "requestedProfileId" UUID,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seo_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seo_audits_clientId_fkey" FOREIGN KEY ("clientId")
    REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "seo_audit_issues" (
  "id" UUID NOT NULL,
  "auditId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "checkKey" TEXT NOT NULL,
  "severity" TEXT NOT NULL CHECK ("severity" IN ('critical','warning','notice')),
  "pageUrl" TEXT,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seo_audit_issues_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seo_audit_issues_auditId_fkey" FOREIGN KEY ("auditId")
    REFERENCES "seo_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "seo_audits_clientId_host_startedAt_idx"
  ON "seo_audits"("clientId", "host", "startedAt");
CREATE INDEX IF NOT EXISTS "seo_audits_clientId_status_idx"
  ON "seo_audits"("clientId", "status");
CREATE INDEX IF NOT EXISTS "seo_audit_issues_auditId_idx"
  ON "seo_audit_issues"("auditId");
CREATE INDEX IF NOT EXISTS "seo_audit_issues_clientId_idx"
  ON "seo_audit_issues"("clientId");

-- Data API stays closed: no policies, so anon/authenticated get nothing.
ALTER TABLE "seo_audits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seo_audit_issues" ENABLE ROW LEVEL SECURITY;
