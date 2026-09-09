-- One connected TikTok account per workspace client.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_tiktok_account_per_client_key"
  ON "social_accounts"("clientId", "platform", "externalAccountId")
  WHERE "status" = 'connected'
    AND "platform" = 'tiktok'
    AND "externalAccountId" IS NOT NULL;

-- One connected TikTok account per TikTok connection.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_tiktok_per_connection_key"
  ON "social_accounts"("providerConnectionId")
  WHERE "status" = 'connected'
    AND "platform" = 'tiktok'
    AND "providerConnectionId" IS NOT NULL;
