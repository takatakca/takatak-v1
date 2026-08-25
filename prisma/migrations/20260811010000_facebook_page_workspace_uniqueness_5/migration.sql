-- Step 5 — Workspace uniqueness for a connected Facebook Page
-- Same stable Meta Page ID may not be actively connected twice in one Client.

CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_facebook_page_per_client_key"
  ON "social_accounts"("clientId", "platform", "externalAccountId")
  WHERE "status" = 'connected'
    AND "platform" = 'facebook'
    AND "externalAccountId" IS NOT NULL;
