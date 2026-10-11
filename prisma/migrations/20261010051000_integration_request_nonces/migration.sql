-- Generic replay protection for signed TAKATAK server-to-server integrations.

CREATE TABLE "integration_request_nonces" (
  "id" UUID NOT NULL,
  "integrationId" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_request_nonces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_request_nonces_integrationId_nonce_key"
  ON "integration_request_nonces"("integrationId","nonce");
CREATE INDEX "integration_request_nonces_expiresAt_idx"
  ON "integration_request_nonces"("expiresAt");

ALTER TABLE "integration_request_nonces" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "integration_request_nonces" FROM PUBLIC;
REVOKE ALL ON TABLE "integration_request_nonces" FROM anon;
REVOKE ALL ON TABLE "integration_request_nonces" FROM authenticated;
