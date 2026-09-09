-- One connected Instagram professional account per workspace client.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_instagram_account_per_client_key"
  ON "social_accounts"("clientId", "platform", "externalAccountId")
  WHERE "status" = 'connected'
    AND "platform" = 'instagram'
    AND "externalAccountId" IS NOT NULL;

-- One connected Instagram professional account per Meta connection.
CREATE UNIQUE INDEX IF NOT EXISTS "sa_one_connected_instagram_per_connection_key"
  ON "social_accounts"("providerConnectionId")
  WHERE "status" = 'connected'
    AND "platform" = 'instagram'
    AND "providerConnectionId" IS NOT NULL;
